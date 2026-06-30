import { Router, type Router as ExpressRouter } from "express";
import { requireAdmin } from "../middleware/auth.middleware.js";
import { AccessRequest } from "../models/access-request.model.js";
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
