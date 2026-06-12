import { Schema, model, type InferSchemaType } from "mongoose";

const usageEventSchema = new Schema(
  {
    type: { type: String, enum: ["upload", "chat"], required: true, index: true },
    status: { type: String, enum: ["success", "failure"], required: true },
    model: { type: String },
    chunkCount: { type: Number, default: 0 },
    pageCount: { type: Number, default: 0 },
    latencyMs: { type: Number, default: 0 },
    promptTokens: { type: Number, default: 0 },
    completionTokens: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

usageEventSchema.index({ createdAt: -1 });

export type UsageEventDocument = InferSchemaType<typeof usageEventSchema>;
export const UsageEvent = model("UsageEvent", usageEventSchema);
