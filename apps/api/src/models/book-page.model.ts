import { Schema, Types, model, type InferSchemaType } from "mongoose";

/**
 * Raw per-page extracted text for non-PDF books (EPUB/DOCX/TXT), used by the
 * in-app text reader. PDF books never populate this collection — they read
 * on-demand from the stored original via `PdfJsRenderer` instead.
 */
const bookPageSchema = new Schema(
  {
    bookId: { type: Schema.Types.ObjectId, ref: "Book", required: true, index: true },
    pageNumber: { type: Number, required: true, min: 1 },
    text: { type: String, required: true }
  },
  { timestamps: false }
);

bookPageSchema.index({ bookId: 1, pageNumber: 1 }, { unique: true });

export type BookPageDocument = InferSchemaType<typeof bookPageSchema> & {
  _id: Types.ObjectId;
  bookId: Types.ObjectId;
};

export const BookPage = model("BookPage", bookPageSchema);
