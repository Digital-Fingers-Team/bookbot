import { Schema, Types, model, type InferSchemaType } from "mongoose";

const chunkSchema = new Schema(
  {
    bookId: { type: Schema.Types.ObjectId, ref: "Book", required: true, index: true },
    bookName: { type: String, required: true, trim: true },
    pageNumber: { type: Number, required: true, min: 1 },
    chunkIndex: { type: Number, required: true, min: 0 },
    chunkText: { type: String, required: true },
    normalizedText: { type: String, required: true },
    embedding: { type: [Number], required: true },
    embeddingModel: { type: String, required: true, trim: true },
    embeddingDimensions: { type: Number, required: true, min: 1 },
    chunkingVersion: { type: String, required: true, trim: true },
    embeddingVersion: { type: String, required: true, trim: true },
    processingVersion: { type: String, required: true, trim: true }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

chunkSchema.index({ bookId: 1, chunkIndex: 1 }, { unique: true });

chunkSchema.index(
  {
    chunkText: "text",
    normalizedText: "text",
    bookName: "text"
  },
  {
    weights: {
      chunkText: 10,
      normalizedText: 8,
      bookName: 3
    },
    name: "chunk_hybrid_text_index"
  }
);

export type ChunkDocument = InferSchemaType<typeof chunkSchema> & {
  _id: Types.ObjectId;
  bookId: Types.ObjectId;
};

export const Chunk = model("Chunk", chunkSchema);
