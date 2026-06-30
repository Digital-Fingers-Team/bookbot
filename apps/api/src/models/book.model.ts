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
    pageCount: { type: Number, required: true, default: 0 },
    status: {
      type: String,
      enum: ["processing", "ready", "failed"],
      required: true,
      default: "processing",
      index: true
    },
    processedPages: { type: Number, required: true, default: 0 },
    // When processing finished and the book became readable ("activation" date).
    readyAt: { type: Date },
    error: { type: String, trim: true },
    category: { type: String, trim: true, default: "" },
    author: { type: String, trim: true, default: "" },
    // Sale price shown under the book (admin-set on upload or later). 0 = free.
    price: { type: Number, default: 0, min: 0 },
    // Short admin-written blurb used by the discovery assistant to recommend
    // books to visitors before they have access (metadata only, no content).
    description: { type: String, trim: true, default: "", maxlength: 600 },
    // Curated by an admin to appear in the homepage showcase carousel.
    featured: { type: Boolean, default: false, index: true },
    // --- OMP (Arado) push: mirrors the processed book into OMP as a submission ---
    ompSubmissionId: { type: Number },
    ompPushStatus: { type: String, enum: ["pending", "pushed", "failed"], index: true },
    ompPushedAt: { type: Date },
    ompPushError: { type: String, trim: true }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

bookSchema.index({ createdAt: -1 });

export type BookDocument = InferSchemaType<typeof bookSchema>;
export const Book = model("Book", bookSchema);
