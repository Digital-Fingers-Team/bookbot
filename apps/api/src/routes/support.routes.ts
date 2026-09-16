import { randomUUID } from "node:crypto";
import { Router, type Router as ExpressRouter } from "express";
import multer from "multer";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.middleware.js";
import { SupportMessage } from "../models/support-message.model.js";
import { SUPPORT_TOPICS, SupportThread } from "../models/support-thread.model.js";
import { User } from "../models/user.model.js";
import { notifyAdmins, notifyUser } from "../services/notifications/notification.service.js";
import { storage } from "../services/storage/storage.service.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { matchesAttachmentMimeType } from "../utils/file-signature.js";
import { requireObjectId } from "../utils/object-id.js";
import { cursorFilter, nextCursorAt, parsePageParams } from "../utils/pagination.js";
import type { PublicUser } from "../services/auth/auth.service.js";

const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
// A single reader flooding the inbox with threads is the one abuse vector an
// authenticated contact form still has, so cap how many they can leave open.
const MAX_OPEN_THREADS_PER_USER = 10;
// Support threads are short by nature; this only guards against a pathological
// one making the transcript response unbounded.
const MESSAGE_LIMIT = 200;

const ATTACHMENT_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
  "text/plain": "txt",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx"
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ATTACHMENT_BYTES, files: MAX_ATTACHMENTS },
  fileFilter: (_req, file, cb) => {
    if (!ATTACHMENT_EXT[file.mimetype]) {
      cb(new ApiError(400, "INVALID_ATTACHMENT", "You can attach images, PDFs, text, Word, or Excel files."));
      return;
    }
    cb(null, true);
  }
});

const newThreadSchema = z.object({
  subject: z.string().trim().min(3).max(160),
  topic: z.enum(SUPPORT_TOPICS).default("general"),
  body: z.string().trim().max(4000).default("")
});

export const supportRouter: ExpressRouter = Router();

/** Open a new conversation with the admin team. */
supportRouter.post(
  "/threads",
  requireAuth,
  upload.array("attachments", MAX_ATTACHMENTS),
  asyncHandler(async (req, res) => {
    const parsed = newThreadSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, "INVALID_THREAD", "Please add a subject and a message.", parsed.error.flatten());
    }

    const files = asFiles(req.files);
    if (!parsed.data.body && files.length === 0) {
      throw new ApiError(400, "EMPTY_MESSAGE", "Please write a message or attach a file.");
    }

    const openThreads = await SupportThread.countDocuments({ userId: req.user!.id, status: "open" });
    if (openThreads >= MAX_OPEN_THREADS_PER_USER) {
      throw new ApiError(
        429,
        "TOO_MANY_OPEN_THREADS",
        "You already have several open conversations. Please continue one of them instead."
      );
    }

    const attachments = await storeAttachments(files);
    let thread;
    try {
      thread = await SupportThread.create({
        userId: req.user!.id,
        subject: parsed.data.subject,
        topic: parsed.data.topic,
        status: "open"
      });
    } catch (error) {
      await discardAttachments(attachments);
      throw error;
    }

    const message = await appendMessage(String(thread._id), req.user!, parsed.data.body, attachments);

    await notifyAdmins({
      type: "support_message",
      title: `New message: ${parsed.data.subject}`,
      message: `${req.user!.name} started a conversation${parsed.data.body ? `: ${parsed.data.body}` : "."}`,
      href: `/support?thread=${String(thread._id)}`
    });

    const created = await SupportThread.findById(thread._id).lean();
    res.status(201).json({
      thread: serializeThread(created!, { name: req.user!.name, email: req.user!.email }),
      message: serializeMessage(message)
    });
  })
);

/**
 * List conversations. Admins see every reader's thread (this is the support
 * inbox); everyone else sees only their own.
 */
supportRouter.get(
  "/threads",
  requireAuth,
  asyncHandler(async (req, res) => {
    const isAdmin = isSupportAgent(req.user!);
    const { limit, cursor } = parsePageParams(req.query, 20, 50);

    const filter: Record<string, unknown> = isAdmin ? {} : { userId: req.user!.id };
    if (req.query.status === "open" || req.query.status === "closed") {
      filter.status = req.query.status;
    }
    // "Needs reply" is the admin's triage queue: open threads whose last word
    // came from the reader.
    if (isAdmin && req.query.needsReply === "true") {
      filter.status = "open";
      filter.lastSenderRole = "user";
    }
    const search = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (search) {
      filter.subject = { $regex: escapeRegex(search.slice(0, 80)), $options: "i" };
    }

    const threads = await SupportThread.find({ ...filter, ...cursorFilter(cursor, "lastMessageAt") })
      .sort({ lastMessageAt: -1, _id: -1 })
      .limit(limit)
      .lean();

    // Admin rows show who wrote in; a reader's own list already knows.
    const authors = isAdmin ? await loadAuthors(threads.map((thread) => String(thread.userId))) : new Map();

    res.json({
      nextCursor: nextCursorAt(threads, limit, (thread) => thread.lastMessageAt),
      threads: threads.map((thread) =>
        serializeThread(thread, isAdmin ? authors.get(String(thread.userId)) : { name: req.user!.name, email: req.user!.email })
      )
    });
  })
);

/** How many conversations are waiting on the caller (nav badge). */
supportRouter.get(
  "/unread-count",
  requireAuth,
  asyncHandler(async (req, res) => {
    const count = isSupportAgent(req.user!)
      ? await SupportThread.countDocuments({ unreadForAdmin: { $gt: 0 } })
        : await SupportThread.countDocuments({ userId: req.user!.id, unreadForUser: { $gt: 0 } });
    res.json({ count });
  })
);

/** Read one conversation. Opening it clears the caller's unread counter. */
supportRouter.get(
  "/threads/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const isAdmin = isSupportAgent(req.user!);
    const thread = await findThreadForCaller(req.params.id, req.user!);

    // Mark read for whichever side is looking, not both.
    const updated = await SupportThread.findByIdAndUpdate(
      thread._id,
      { $set: isAdmin ? { unreadForAdmin: 0 } : { unreadForUser: 0 } },
      { new: true }
    ).lean();

    // Fetch the newest slice, then hand it back in reading order.
    const recent = await SupportMessage.find({ threadId: thread._id })
      .sort({ createdAt: -1, _id: -1 })
      .limit(MESSAGE_LIMIT)
      .lean();
    recent.reverse();

    const author = isAdmin ? (await loadAuthors([String(thread.userId)])).get(String(thread.userId)) : { name: req.user!.name, email: req.user!.email };

    res.json({
      thread: serializeThread(updated ?? thread, author),
      truncated: (updated ?? thread).messageCount > recent.length,
      messages: recent.map(serializeMessage)
    });
  })
);

/** Reply in a conversation (reader or admin). */
supportRouter.post(
  "/threads/:id/messages",
  requireAuth,
  upload.array("attachments", MAX_ATTACHMENTS),
  asyncHandler(async (req, res) => {
    const thread = await findThreadForCaller(req.params.id, req.user!);
    const body = typeof req.body?.body === "string" ? req.body.body.trim().slice(0, 4000) : "";
    const files = asFiles(req.files);
    if (!body && files.length === 0) {
      throw new ApiError(400, "EMPTY_MESSAGE", "Please write a message or attach a file.");
    }

    const attachments = await storeAttachments(files);
    const message = await appendMessage(String(thread._id), req.user!, body, attachments);

    // Each side hears about the other's message, and only the other's.
    if (isSupportAgent(req.user!)) {
      await notifyUser(thread.userId, {
        type: "support_message",
        title: `Reply: ${thread.subject}`,
        message: body || "The support team replied with an attachment.",
        href: `/support?thread=${String(thread._id)}`
      });
    } else {
      await notifyAdmins({
        type: "support_message",
        title: `Reply: ${thread.subject}`,
        message: `${req.user!.name} replied${body ? `: ${body}` : " with an attachment."}`,
        href: `/support?thread=${String(thread._id)}`
      });
    }

    res.status(201).json({ message: serializeMessage(message) });
  })
);

/** Close a resolved conversation, or reopen one. */
supportRouter.post(
  "/threads/:id/status",
  requireAuth,
  asyncHandler(async (req, res) => {
    const thread = await findThreadForCaller(req.params.id, req.user!);
    const status = req.body?.status;
    if (status !== "open" && status !== "closed") {
      throw new ApiError(400, "INVALID_STATUS", "status must be \"open\" or \"closed\".");
    }

    const updated = await SupportThread.findByIdAndUpdate(
      thread._id,
      status === "closed"
        ? { $set: { status, closedAt: new Date(), closedBy: req.user!.id } }
        : { $set: { status }, $unset: { closedAt: 1, closedBy: 1 } },
      { new: true }
    ).lean();

    res.json({ id: String(updated!._id), status: updated!.status });
  })
);

/**
 * Serve one attachment. The blob key never reaches the client, so this is the
 * only way in — and it re-checks that the caller owns the thread or is an admin.
 */
supportRouter.get(
  "/attachments/:messageId/:index",
  requireAuth,
  asyncHandler(async (req, res) => {
    const messageId = requireObjectId(req.params.messageId, "INVALID_MESSAGE_ID", "The message id is invalid.");
    const index = Number(req.params.index);
    const message = await SupportMessage.findById(messageId).lean();
    if (!message) {
      throw new ApiError(404, "MESSAGE_NOT_FOUND", "This message was not found.");
    }

    // Authorization lives on the thread, not the message.
    await findThreadForCaller(String(message.threadId), req.user!);

    const attachment = message.attachments?.[index];
    if (!attachment) {
      throw new ApiError(404, "ATTACHMENT_NOT_FOUND", "This attachment was not found.");
    }

    const buffer = await storage.get(attachment.key).catch(() => null);
    if (!buffer) {
      throw new ApiError(404, "ATTACHMENT_NOT_FOUND", "This attachment is no longer available.");
    }

    res.setHeader("Content-Type", attachment.mime);
    res.setHeader("Content-Length", String(buffer.length));
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.send(buffer);
  })
);

/**
 * Who answers on behalf of the organization. An admin without the `support`
 * permission is treated as an ordinary reader here: they see their own
 * conversations and nobody else's.
 */
function isSupportAgent(user: PublicUser) {
  return user.role === "admin" && user.adminPermissions.includes("support");
}

/** Load a thread the caller is allowed to see, or fail the way the route should. */
async function findThreadForCaller(id: unknown, user: PublicUser) {
  const threadId = requireObjectId(id, "INVALID_THREAD_ID", "The conversation id is invalid.");
  const thread = await SupportThread.findById(threadId).lean();
  // Admins reach every thread; everyone else only their own. A thread that
  // isn't theirs reads as missing rather than forbidden, so the endpoint can't
  // be used to probe which conversation ids exist.
  if (!thread || (!isSupportAgent(user) && String(thread.userId) !== String(user.id))) {
    throw new ApiError(404, "THREAD_NOT_FOUND", "This conversation was not found.");
  }
  return thread;
}

/**
 * Append a message and roll the thread's summary forward in one place, so the
 * counters, preview, and "whose turn" flag can never drift from the transcript.
 */
async function appendMessage(
  threadId: string,
  sender: PublicUser,
  body: string,
  attachments: { key: string; name: string; mime: string; size: number }[]
) {
  const senderRole = isSupportAgent(sender) ? "admin" : "user";
  const message = await SupportMessage.create({
    threadId,
    senderId: sender.id,
    senderRole,
    senderName: sender.name,
    body,
    attachments
  });

  await SupportThread.findByIdAndUpdate(threadId, {
    $set: {
      lastMessageAt: message.createdAt ?? new Date(),
      lastMessagePreview: preview(body, attachments),
      lastSenderRole: senderRole,
      // Any new message revives a closed conversation — neither side should
      // have to open a second thread to follow up on the same issue.
      status: "open",
      // Writing in a thread means you have read it, so clear your own side even
      // if you replied straight from the list without opening it.
      ...(senderRole === "admin" ? { unreadForAdmin: 0 } : { unreadForUser: 0 })
    },
    $unset: { closedAt: 1, closedBy: 1 },
    $inc: { messageCount: 1, ...(senderRole === "admin" ? { unreadForUser: 1 } : { unreadForAdmin: 1 }) }
  });

  return message;
}

function preview(body: string, attachments: { name: string }[]) {
  const text = body.replace(/\s+/g, " ").trim();
  if (text) {
    return text.slice(0, 200);
  }
  return attachments.length === 1 ? attachments[0]!.name.slice(0, 200) : `${attachments.length} attachments`;
}

function asFiles(files: unknown): Express.Multer.File[] {
  return Array.isArray(files) ? (files as Express.Multer.File[]) : [];
}

/**
 * Validate the real bytes (a declared mimetype is trivially faked) and persist
 * each attachment. Returns the rows to embed on the message.
 */
async function storeAttachments(files: Express.Multer.File[]) {
  const stored: { key: string; name: string; mime: string; size: number }[] = [];
  try {
    for (const file of files) {
      if (!matchesAttachmentMimeType(file.buffer, file.mimetype)) {
        throw new ApiError(400, "INVALID_ATTACHMENT", `"${file.originalname}" doesn't match the file type it claims.`);
      }
      const key = `support/${randomUUID()}.${ATTACHMENT_EXT[file.mimetype]}`;
      await storage.put(key, file.buffer, file.mimetype);
      stored.push({
        key,
        name: safeFileName(file.originalname),
        mime: file.mimetype,
        size: file.size
      });
    }
  } catch (error) {
    // Never leave orphaned blobs behind when one file in a batch is rejected.
    await discardAttachments(stored);
    throw error;
  }
  return stored;
}

async function discardAttachments(attachments: { key: string }[]) {
  await Promise.all(attachments.map((attachment) => storage.delete(attachment.key).catch(() => undefined)));
}

/** Keep the display name recognisable without letting it carry a path. */
function safeFileName(name: string) {
  return (name.split(/[\\/]/).pop() ?? "file").slice(0, 200) || "file";
}

async function loadAuthors(userIds: string[]) {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) {
    return new Map<string, { name: string; email: string }>();
  }
  const users = await User.find({ _id: { $in: unique } }, { name: 1, email: 1 }).lean();
  return new Map(users.map((user) => [String(user._id), { name: user.name, email: user.email }]));
}

function serializeThread(
  thread: {
    _id: unknown;
    userId: unknown;
    subject: string;
    topic: string;
    status: string;
    lastMessageAt?: Date | null;
    lastMessagePreview?: string | null;
    lastSenderRole?: string | null;
    messageCount?: number | null;
    unreadForUser?: number | null;
    unreadForAdmin?: number | null;
    createdAt?: Date | null;
  },
  author?: { name: string; email: string }
) {
  return {
    id: String(thread._id),
    subject: thread.subject,
    topic: thread.topic,
    status: thread.status,
    lastMessageAt: thread.lastMessageAt ?? thread.createdAt ?? null,
    lastMessagePreview: thread.lastMessagePreview ?? "",
    lastSenderRole: thread.lastSenderRole ?? "user",
    messageCount: thread.messageCount ?? 0,
    unreadForUser: thread.unreadForUser ?? 0,
    unreadForAdmin: thread.unreadForAdmin ?? 0,
    user: { id: String(thread.userId), name: author?.name ?? "", email: author?.email ?? "" },
    createdAt: thread.createdAt ?? null
  };
}

function serializeMessage(message: {
  _id: unknown;
  senderRole: string;
  senderName: string;
  body?: string | null;
  attachments?: { name: string; mime: string; size: number }[] | null;
  createdAt?: Date | null;
}) {
  const id = String(message._id);
  return {
    id,
    senderRole: message.senderRole,
    senderName: message.senderName,
    body: message.body ?? "",
    attachments: (message.attachments ?? []).map((attachment, index) => ({
      name: attachment.name,
      mime: attachment.mime,
      size: attachment.size,
      url: `/api/support/attachments/${id}/${index}`
    })),
    createdAt: message.createdAt ?? null
  };
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
