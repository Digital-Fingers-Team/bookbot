import { Router, type Router as ExpressRouter } from "express";
import { requireAdmin } from "../middleware/auth.middleware.js";
import { Book } from "../models/book.model.js";
import { Chunk } from "../models/chunk.model.js";
import { UsageEvent } from "../models/usage-event.model.js";
import { asyncHandler } from "../utils/async-handler.js";

export const statsRouter: ExpressRouter = Router();

statsRouter.get(
  "/",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const [totalBooks, totalChunks, pageAggregation, unanswered, usageAggregation] = await Promise.all([
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
