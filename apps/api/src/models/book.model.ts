import { Schema, model, type InferSchemaType } from "mongoose";

const bookSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    originalFileName: { type: String, required: true, trim: true },
    chunkCount: { type: Number, required: true, default: 0 },
    pageCount: { type: Number, required: true, default: 0 }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

bookSchema.index({ createdAt: -1 });

export type BookDocument = InferSchemaType<typeof bookSchema>;
export const Book = model("Book", bookSchema);
