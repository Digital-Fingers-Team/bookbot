import { Router, type Router as ExpressRouter } from "express";
import { randomUUID } from "node:crypto";
import multer from "multer";
import { isValidObjectId } from "mongoose";
import { storage } from "../services/storage/storage.service.js";
import { requireAdmin, requireAuth } from "../middleware/auth.middleware.js";
import { AccessRequest } from "../models/access-request.model.js";
import { Book } from "../models/book.model.js";
import { Category } from "../models/category.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { readableBookTitle } from "../utils/file-name.js";

const RECEIPT_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "application/pdf": "pdf"
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!RECEIPT_EXT[file.mimetype]) {
      cb(new ApiError(400, "INVALID_RECEIPT", "Please upload an image (PNG/JPG/WebP) or PDF receipt."));
      return;
    }
    cb(null, true);
  }
});

export const accessRequestsRouter: ExpressRouter = Router();

/** Submit an access request with a payment receipt (book or category). */
accessRequestsRouter.post(
  "/",
  requireAuth,
  upload.single("receipt"),
  asyncHandler(async (req, res) => {
    const file = req.file;
    if (!file) {
      throw new ApiError(400, "MISSING_RECEIPT", "Please attach your payment receipt.");
    }

    const targetType = req.body?.targetType === "category" ? "category" : req.body?.targetType === "book" ? "book" : "";
    const targetValue = typeof req.body?.targetValue === "string" ? req.body.targetValue.trim() : "";
    const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 1000) : "";
    if (!targetType || !targetValue) {
      throw new ApiError(400, "INVALID_TARGET", "Please choose a book or a category to request.");
    }

    // Resolve a human-readable label and validate the target exists. For books
    // we capture the price as the amount owed (server-side, so it can't be faked).
    let targetLabel = targetValue;
    let amount = 0;
    if (targetType === "book") {
      if (!isValidObjectId(targetValue)) {
        throw new ApiError(400, "INVALID_BOOK_ID", "The book id is invalid.");
      }
      const book = await Book.findById(targetValue, { title: 1, originalFileName: 1, price: 1 }).lean();
      if (!book) {
        throw new ApiError(404, "BOOK_NOT_FOUND", "This book was not found.");
      }
      targetLabel = readableBookTitle({ title: book.title, originalFileName: book.originalFileName, firstPageText: "" });
      amount = book.price ?? 0;
    } else {
      const exists = await Category.exists({ name: targetValue });
      if (!exists) {
        throw new ApiError(404, "CATEGORY_NOT_FOUND", "This category was not found.");
      }
    }

    const receiptFile = `receipts/${randomUUID()}.${RECEIPT_EXT[file.mimetype]}`;
    await storage.put(receiptFile, file.buffer, file.mimetype);

    const created = await AccessRequest.create({
      userId: req.user!.id,
      targetType,
      targetValue,
      targetLabel,
      receiptFile,
      receiptMime: file.mimetype,
      note,
      amount,
      currency: "EGP",
      status: "pending",
      seenByUser: true
    });

    res.status(201).json({ id: String(created._id), status: "pending" });
  })
);

/** List requests: admins see everyone's; users see their own. */
accessRequestsRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const isAdmin = req.user!.role === "admin";
    const filter: Record<string, unknown> = isAdmin ? {} : { userId: req.user!.id };
    if (typeof req.query.status === "string" && ["pending", "approved", "rejected"].includes(req.query.status)) {
      filter.status = req.query.status;
    }

    const requests = await AccessRequest.find(filter).sort({ createdAt: -1 }).limit(200).lean();
    const userIds = [...new Set(requests.map((r) => String(r.userId)))];
    const users = isAdmin ? await User.find({ _id: { $in: userIds } }, { name: 1, email: 1 }).lean() : [];
    const userById = new Map(users.map((u) => [String(u._id), u]));

    res.json({
      requests: requests.map((r) => ({
        id: String(r._id),
        targetType: r.targetType,
        targetValue: r.targetValue,
        targetLabel: r.targetLabel ?? "",
        note: r.note ?? "",
        amount: r.amount ?? 0,
        currency: r.currency ?? "EGP",
        status: r.status,
        adminNote: r.adminNote ?? "",
        createdAt: r.createdAt,
        decidedAt: r.decidedAt ?? null,
        ...(isAdmin
          ? {
              user: {
                id: String(r.userId),
                name: userById.get(String(r.userId))?.name ?? "",
                email: userById.get(String(r.userId))?.email ?? ""
              }
            }
          : {})
      }))
    });
  })
);

/** How many of the user's requests were decided but not yet seen (notification). */
accessRequestsRouter.get(
  "/unseen-count",
  requireAuth,
  asyncHandler(async (req, res) => {
    const count = await AccessRequest.countDocuments({
      userId: req.user!.id,
      status: { $in: ["approved", "rejected"] },
      seenByUser: false
    });
    res.json({ count });
  })
);

/** Mark the user's decided requests as seen (clears the notification). */
accessRequestsRouter.post(
  "/mark-seen",
  requireAuth,
  asyncHandler(async (req, res) => {
    await AccessRequest.updateMany(
      { userId: req.user!.id, seenByUser: false },
      { $set: { seenByUser: true } }
    );
    res.json({ ok: true });
  })
);

/** Stream the receipt image (owner or admin). */
accessRequestsRouter.get(
  "/:id/receipt",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!isValidObjectId(req.params.id)) {
      throw new ApiError(400, "INVALID_REQUEST_ID", "The request id is invalid.");
    }
    const request = await AccessRequest.findById(req.params.id).lean();
    if (!request) {
      throw new ApiError(404, "REQUEST_NOT_FOUND", "This request was not found.");
    }
    if (req.user!.role !== "admin" && String(request.userId) !== req.user!.id) {
      throw new ApiError(403, "FORBIDDEN", "You can't view this receipt.");
    }

    // Tolerate legacy bare filenames stored before the "receipts/" key prefix.
    const key = request.receiptFile.includes("/") ? request.receiptFile : `receipts/${request.receiptFile}`;
    let buffer: Buffer;
    try {
      buffer = await storage.get(key);
    } catch {
      throw new ApiError(404, "RECEIPT_NOT_FOUND", "This receipt file could not be found.");
    }

    res.setHeader("Content-Type", request.receiptMime || "application/octet-stream");
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.send(buffer);
  })
);

/** Approve a request: grant the access and mark it approved (admin only). */
accessRequestsRouter.post(
  "/:id/approve",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const request = await findPending(req.params.id);

    if (request.targetType === "book") {
      await User.updateOne({ _id: request.userId }, { $addToSet: { allowedBookIds: request.targetValue } });
    } else {
      await User.updateOne({ _id: request.userId }, { $addToSet: { allowedCategories: request.targetValue } });
    }

    request.status = "approved";
    request.decidedBy = req.user!.id as never;
    request.decidedAt = new Date();
    request.seenByUser = false;
    if (typeof req.body?.adminNote === "string") {
      request.adminNote = req.body.adminNote.trim().slice(0, 1000);
    }
    await request.save();

    res.json({ id: String(request._id), status: "approved" });
  })
);

/** Reject a request (admin only). */
accessRequestsRouter.post(
  "/:id/reject",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const request = await findPending(req.params.id);
    request.status = "rejected";
    request.decidedBy = req.user!.id as never;
    request.decidedAt = new Date();
    request.seenByUser = false;
    if (typeof req.body?.adminNote === "string") {
      request.adminNote = req.body.adminNote.trim().slice(0, 1000);
    }
    await request.save();

    res.json({ id: String(request._id), status: "rejected" });
  })
);

async function findPending(id: unknown) {
  if (typeof id !== "string" || !isValidObjectId(id)) {
    throw new ApiError(400, "INVALID_REQUEST_ID", "The request id is invalid.");
  }
  const request = await AccessRequest.findById(id);
  if (!request) {
    throw new ApiError(404, "REQUEST_NOT_FOUND", "This request was not found.");
  }
  if (request.status !== "pending") {
    throw new ApiError(409, "ALREADY_DECIDED", "This request has already been decided.");
  }
  return request;
}
