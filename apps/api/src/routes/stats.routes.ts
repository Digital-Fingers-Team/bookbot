import { Router, type Router as ExpressRouter } from "express";
import { requireAdmin } from "../middleware/auth.middleware.js";
import { Book } from "../models/book.model.js";
import { Chunk } from "../models/chunk.model.js";
import { Feedback } from "../models/feedback.model.js";
import { UsageEvent } from "../models/usage-event.model.js";
import { asyncHandler } from "../utils/async-handler.js";

export const statsRouter: ExpressRouter = Router();

statsRouter.get(
  "/",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const [totalBooks, totalChunks, pageAggregation, unanswered, feedbackAggregation, recentReports, usageAggregation] =
      await Promise.all([
      Book.countDocuments(),
      Chunk.countDocuments(),
      Book.aggregate([{ $group: { _id: null, totalPages: { $sum: "$pageCount" } } }]),
      UsageEvent.find(
        { type: "chat", answered: false, question: { $nin: [null, ""] } },
        { question: 1, createdAt: 1 }
      )
        .sort({ createdAt: -1 })
        .limit(15)
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
      ])
    ]);

    res.json({
      totalBooks,
      totalChunks,
      totalPages: pageAggregation[0]?.totalPages ?? 0,
      unansweredQuestions: unanswered.map((event) => ({
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
