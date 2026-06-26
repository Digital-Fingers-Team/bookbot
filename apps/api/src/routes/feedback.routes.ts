import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";
import { Feedback } from "../models/feedback.model.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";

const feedbackSchema = z.object({
  vote: z.enum(["up", "down"]),
  note: z.string().trim().max(1000).optional(),
  question: z.string().trim().max(500).optional(),
  answer: z.string().trim().max(2000).optional()
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
    res.status(201).json({ received: true });
  })
);
