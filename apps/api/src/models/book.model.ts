import { Schema, model, type InferSchemaType } from "mongoose";

const bookSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    originalFileName: { type: String, required: true, trim: true },
    originalPdfPath: { type: String, trim: true },
    storageProvider: { type: String, required: true, default: "local", trim: true },
    uploadChecksum: { type: String, trim: true, index: true },
    uploadedAt: { type: Date, required: true, default: Date.now },
    chunkingVersion: { type: String, required: true, default: "v2", trim: true },
    embeddingVersion: { type: String, required: true, default: "text-embedding-3-small", trim: true },
    processingVersion: { type: String, required: true, default: "2026-06", trim: true },
    chunkCount: { type: Number, required: true, default: 0 },
    pageCount: { type: Number, required: true, default: 0 }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

bookSchema.index({ createdAt: -1 });

export type BookDocument = InferSchemaType<typeof bookSchema>;
export const Book = model("Book", bookSchema);
