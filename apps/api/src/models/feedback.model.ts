import { Schema, model, type InferSchemaType } from "mongoose";

// Cited evidence (what the answer actually quoted) and raw retrieved chunks
// (everything retrieval surfaced, cited or not) — snapshotted at feedback time
// so an admin can tell a bad retrieval apart from a bad generation.
const sourceSchema = new Schema(
  { bookName: String, pageNumber: Number, supportingText: String },
  { _id: false }
);
const evidenceSchema = new Schema(
  { bookName: String, pageNumber: Number, chunkText: String, score: Number },
  { _id: false }
);

const feedbackSchema = new Schema(
  {
    vote: { type: String, enum: ["up", "down"], required: true },
    note: { type: String, trim: true },
    question: { type: String, trim: true },
    answer: { type: String, trim: true },
    sources: { type: [sourceSchema], default: [] },
    evidence: { type: [evidenceSchema], default: [] },
    // Lets admins triage dislikes: mark one reviewed without deleting the record.
    resolved: { type: Boolean, default: false }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

feedbackSchema.index({ createdAt: -1 });
feedbackSchema.index({ vote: 1, resolved: 1, createdAt: -1 });

export type FeedbackDocument = InferSchemaType<typeof feedbackSchema>;
export const Feedback = model("Feedback", feedbackSchema);
