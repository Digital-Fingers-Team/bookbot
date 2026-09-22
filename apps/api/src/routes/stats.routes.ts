import { Router, type Router as ExpressRouter } from "express";
import { requirePermission } from "../middleware/auth.middleware.js";
import { AccessRequest } from "../models/access-request.model.js";
import { Book } from "../models/book.model.js";
import { Chunk } from "../models/chunk.model.js";
import { Feedback } from "../models/feedback.model.js";
import { ReadingEvent } from "../models/reading-event.model.js";
import { UsageEvent } from "../models/usage-event.model.js";
import { asyncHandler } from "../utils/async-handler.js";

export const statsRouter: ExpressRouter = Router();

statsRouter.get(
  "/",
  requirePermission("analytics"),
  asyncHandler(async (_req, res) => {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [
      totalBooks,
      totalChunks,
      pageAggregation,
      unanswered,
      feedbackAggregation,
      recentReports,
      usageAggregation,
      revenueTotalAgg,
      revenueMonthAgg,
      pendingRequests
    ] = await Promise.all([
      Book.countDocuments(),
      Chunk.countDocuments(),
      Book.aggregate([{ $group: { _id: null, totalPages: { $sum: "$pageCount" } } }]),
      UsageEvent.find(
        // Exclude empty and mojibake questions (legacy bad-encoding rows whose
        // text decoded to U+FFFD replacement characters).
        { type: "chat", answered: false, question: { $nin: [null, ""], $not: /�/ } },
        { question: 1, createdAt: 1 }
      )
        .sort({ createdAt: -1 })
        .limit(40)
        .lean(),
      Feedback.aggregate([{ $group: { _id: "$vote", count: { $sum: 1 } } }]),
      Feedback.find({ vote: "down", note: { $nin: [null, ""] } }, { note: 1, answer: 1, createdAt: 1 })
        .sort({ createdAt: -1 })
        .limit(15)
        .lean(),
      UsageEvent.aggregate([
        {
          $group: {
            _id: "$type",
            total: { $sum: 1 },
            successful: { $sum: { $cond: [{ $eq: ["$status", "success"] }, 1, 0] } },
            failed: { $sum: { $cond: [{ $eq: ["$status", "failure"] }, 1, 0] } },
            totalTokens: { $sum: "$totalTokens" }
          }
        }
      ]),
      AccessRequest.aggregate([
        { $match: { status: "approved" } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]),
      AccessRequest.aggregate([
        { $match: { status: "approved", decidedAt: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]),
      AccessRequest.countDocuments({ status: "pending" })
    ]);

    res.json({
      totalBooks,
      totalChunks,
      totalPages: pageAggregation[0]?.totalPages ?? 0,
      revenue: {
        total: revenueTotalAgg[0]?.total ?? 0,
        thisMonth: revenueMonthAgg[0]?.total ?? 0,
        currency: "EGP",
        pendingRequests
      },
      unansweredQuestions: unanswered
        .filter((event) => event.question && !event.question.includes("�"))
        .slice(0, 15)
        .map((event) => ({
          question: event.question ?? "",
          createdAt: event.createdAt
        })),
      feedback: {
        up: feedbackAggregation.find((item) => item._id === "up")?.count ?? 0,
        down: feedbackAggregation.find((item) => item._id === "down")?.count ?? 0
      },
      reports: recentReports.map((report) => ({
        note: report.note ?? "",
        answer: report.answer ?? "",
        createdAt: report.createdAt
      })),
      usage: usageAggregation.reduce<Record<string, unknown>>((acc, item) => {
        acc[item._id] = {
          total: item.total,
          successful: item.successful,
          failed: item.failed,
          totalTokens: item.totalTokens
        };
        return acc;
      }, {})
    });
  })
);

/**
 * The reading audit trail: who opened which book, when, and from where.
 *
 * Paged rather than aggregated — the point is to trace one leak back to one
 * reader, so the raw rows are what an admin needs. Optionally narrowed to a
 * single book. Gated on "analytics" like the rest of this router.
 */
statsRouter.get(
  "/reading-log",
  requirePermission("analytics"),
  asyncHandler(async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const filter: Record<string, unknown> = {};
    if (typeof req.query.bookId === "string" && req.query.bookId) {
      filter.bookId = req.query.bookId;
    }
    // Cursor is the createdAt of the last row already shown, so paging stays
    // stable as new opens arrive at the top.
    if (typeof req.query.before === "string" && req.query.before) {
      const before = new Date(req.query.before);
      if (!Number.isNaN(before.getTime())) {
        filter.createdAt = { $lt: before };
      }
    }

    const events = await ReadingEvent.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("userId", "name email")
      .populate("bookId", "title")
      .lean();

    res.json({
      events: events.map((event) => {
        const reader = event.userId as { _id?: unknown; name?: string; email?: string } | null;
        const book = event.bookId as { _id?: unknown; title?: string } | null;
        return {
          // The reader or book may since have been deleted; the row still
          // matters, so report what is left rather than dropping it.
          userId: reader?._id ? String(reader._id) : null,
          userName: reader?.name ?? "",
          userEmail: reader?.email ?? "",
          bookId: book?._id ? String(book._id) : null,
          bookTitle: book?.title ?? "",
          ip: event.ip ?? "",
          userAgent: event.userAgent ?? "",
          createdAt: event.createdAt
        };
      }),
      nextCursor: events.length === limit ? events[events.length - 1]?.createdAt ?? null : null
    });
  })
);
