import { Router, type Router as ExpressRouter } from "express";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { requireAdmin } from "../middleware/auth.middleware.js";
import { Feedback } from "../models/feedback.model.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { cursorFilter, nextCursor, parsePageParams } from "../utils/pagination.js";
import { notifyAdmins } from "../services/notifications/notification.service.js";

const sourceSchema = z.object({
  bookName: z.string().trim().max(200),
  pageNumber: z.number().int().nonnegative(),
  supportingText: z.string().trim().max(400)
});
const evidenceSchema = z.object({
  bookName: z.string().trim().max(200),
  pageNumber: z.number().int().nonnegative(),
  chunkText: z.string().trim().max(400),
  score: z.number().optional()
});

const feedbackSchema = z.object({
  vote: z.enum(["up", "down"]),
  note: z.string().trim().max(1000).optional(),
  question: z.string().trim().max(500).optional(),
  answer: z.string().trim().max(2000).optional(),
  sources: z.array(sourceSchema).max(8).optional(),
  evidence: z.array(evidenceSchema).max(8).optional()
});

export const feedbackRouter: ExpressRouter = Router();

// Anonymous answer feedback (👍/👎 + optional "report an error" note).
feedbackRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = feedbackSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, "INVALID_FEEDBACK", "Invalid feedback.", parsed.error.flatten());
    }

    await Feedback.create(parsed.data);
    if (parsed.data.vote === "down") {
      await notifyAdmins({
        type: "feedback",
        title: "New negative answer feedback",
        message: parsed.data.note?.trim() || "A user marked an answer as not helpful and it needs review.",
        href: "/feedback"
      });
    }
    res.status(201).json({ received: true });
  })
);

/** Browse feedback, disliked answers first, for admin triage. */
feedbackRouter.get(
  "/",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const filter: Record<string, unknown> = {};
    if (req.query.vote === "up" || req.query.vote === "down") {
      filter.vote = req.query.vote;
    }
    if (req.query.resolved === "true" || req.query.resolved === "false") {
      filter.resolved = req.query.resolved === "true";
    }

    const { limit, cursor } = parsePageParams(req.query, 20, 50);
    const items = await Feedback.find({ ...filter, ...cursorFilter(cursor) })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .lean();

    res.json({
      nextCursor: nextCursor(items, limit),
      items: items.map((item) => ({
        id: String(item._id),
        vote: item.vote,
        note: item.note ?? "",
        question: item.question ?? "",
        answer: item.answer ?? "",
        sources: (item.sources ?? []).map((s) => ({
          bookName: s.bookName ?? "",
          pageNumber: s.pageNumber ?? 0,
          supportingText: s.supportingText ?? ""
        })),
        evidence: (item.evidence ?? []).map((e) => ({
          bookName: e.bookName ?? "",
          pageNumber: e.pageNumber ?? 0,
          chunkText: e.chunkText ?? "",
          score: e.score
        })),
        resolved: item.resolved ?? false,
        createdAt: item.createdAt
      }))
    });
  })
);

/** How many disliked answers still need admin review (nav badge). */
feedbackRouter.get(
  "/unresolved-count",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const count = await Feedback.countDocuments({ vote: "down", resolved: false });
    res.json({ count });
  })
);

/** Mark a piece of feedback reviewed/unreviewed (admin triage). */
feedbackRouter.patch(
  "/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    if (!isValidObjectId(req.params.id)) {
      throw new ApiError(400, "INVALID_FEEDBACK_ID", "The feedback id is invalid.");
    }
    if (typeof req.body?.resolved !== "boolean") {
      throw new ApiError(400, "INVALID_BODY", "resolved must be a boolean.");
    }

    const updated = await Feedback.findByIdAndUpdate(
      req.params.id,
      { $set: { resolved: req.body.resolved } },
      { new: true }
    ).lean();
    if (!updated) {
      throw new ApiError(404, "FEEDBACK_NOT_FOUND", "This feedback was not found.");
    }

    res.json({ id: String(updated._id), resolved: updated.resolved ?? false });
  })
);
