import { Schema, Types, model, type InferSchemaType } from "mongoose";

const chunkSchema = new Schema(
  {
    bookId: { type: Schema.Types.ObjectId, ref: "Book", required: true, index: true },
    bookName: { type: String, required: true, trim: true },
    pageNumber: { type: Number, required: true, min: 1 },
    chunkText: { type: String, required: true },
    normalizedText: { type: String, required: true }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

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
