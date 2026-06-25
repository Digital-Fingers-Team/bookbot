import { Router, type Router as ExpressRouter } from "express";
import { Types, isValidObjectId } from "mongoose";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.middleware.js";
import { Conversation } from "../models/conversation.model.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";

const sourceInput = z.object({
  bookId: z.string().trim().max(64).optional(),
  bookName: z.string().trim().max(300).optional(),
  pageNumber: z.number().int().optional(),
  supportingText: z.string().max(2000).optional()
});

const messageInput = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(20000).default(""),
  sources: z.array(sourceInput).max(50).optional()
});

const saveSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  messages: z.array(messageInput).max(200)
});

export const conversationsRouter: ExpressRouter = Router();

conversationsRouter.use(requireAuth);

function userObjectId(req: { user?: { id: string } }): Types.ObjectId {
  return new Types.ObjectId(req.user!.id);
}

// List the signed-in user's conversations (newest first), without the message bodies.
conversationsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const conversations = await Conversation.aggregate([
      { $match: { userId: userObjectId(req) } },
      { $sort: { updatedAt: -1 } },
      { $limit: 100 },
      { $project: { title: 1, updatedAt: 1, messageCount: { $size: "$messages" } } }
    ]);

    res.json({
      conversations: conversations.map((conversation) => ({
        id: String(conversation._id),
        title: conversation.title,
        updatedAt: conversation.updatedAt,
        messageCount: conversation.messageCount
      }))
    });
  })
);

conversationsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    if (!isValidObjectId(req.params.id)) {
      throw new ApiError(400, "INVALID_CONVERSATION_ID", "The conversation id is invalid.");
    }

    const conversation = await Conversation.findOne({ _id: req.params.id, userId: req.user!.id }).lean();
    if (!conversation) {
      throw new ApiError(404, "CONVERSATION_NOT_FOUND", "This conversation was not found.");
    }

    res.json({
      id: String(conversation._id),
      title: conversation.title,
      messages: conversation.messages,
      updatedAt: conversation.updatedAt
    });
  })
);

conversationsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = saveSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, "INVALID_CONVERSATION", "The conversation payload is invalid.", parsed.error.flatten());
    }

    const conversation = await Conversation.create({
      userId: req.user!.id,
      title: parsed.data.title ?? firstUserTitle(parsed.data.messages),
      messages: parsed.data.messages
    });

    res.status(201).json({ id: String(conversation._id), title: conversation.title });
  })
);

conversationsRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    if (!isValidObjectId(req.params.id)) {
      throw new ApiError(400, "INVALID_CONVERSATION_ID", "The conversation id is invalid.");
    }

    const parsed = saveSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, "INVALID_CONVERSATION", "The conversation payload is invalid.", parsed.error.flatten());
    }

    const conversation = await Conversation.findOneAndUpdate(
      { _id: req.params.id, userId: req.user!.id },
      { title: parsed.data.title ?? firstUserTitle(parsed.data.messages), messages: parsed.data.messages },
      { new: true }
    );

    if (!conversation) {
      throw new ApiError(404, "CONVERSATION_NOT_FOUND", "This conversation was not found.");
    }

    res.json({ id: String(conversation._id), title: conversation.title });
  })
);

conversationsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    if (!isValidObjectId(req.params.id)) {
      throw new ApiError(400, "INVALID_CONVERSATION_ID", "The conversation id is invalid.");
    }

    await Conversation.deleteOne({ _id: req.params.id, userId: req.user!.id });
    res.json({ deleted: true });
  })
);

function firstUserTitle(messages: { role: string; content: string }[]) {
  const first = messages.find((message) => message.role === "user")?.content?.trim();
  if (!first) {
    return "محادثة جديدة";
  }
  return first.length > 80 ? `${first.slice(0, 80)}…` : first;
}
