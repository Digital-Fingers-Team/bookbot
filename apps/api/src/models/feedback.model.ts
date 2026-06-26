import { Schema, model, type InferSchemaType } from "mongoose";

const feedbackSchema = new Schema(
  {
    vote: { type: String, enum: ["up", "down"], required: true },
    note: { type: String, trim: true },
    question: { type: String, trim: true },
    answer: { type: String, trim: true }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

feedbackSchema.index({ createdAt: -1 });

export type FeedbackDocument = InferSchemaType<typeof feedbackSchema>;
export const Feedback = model("Feedback", feedbackSchema);
