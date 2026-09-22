import { Schema, model, type InferSchemaType } from "mongoose";

/**
 * One row per time a reader opens a book in the reader.
 *
 * Deliberately separate from UsageEvent: that model is shaped for token and
 * latency accounting and carries neither reader nor book, while this one exists
 * so an admin can answer "who had this book open, and when" after a leak. It is
 * an audit trail, so it keeps the network details a reader cannot edit (ip,
 * userAgent) alongside the identity.
 */
const readingEventSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    bookId: { type: Schema.Types.ObjectId, ref: "Book", required: true, index: true },
    page: { type: Number, default: 1 },
    ip: { type: String, trim: true, maxlength: 64 },
    userAgent: { type: String, trim: true, maxlength: 512 }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// The admin view reads newest-first, both across the library and per book.
readingEventSchema.index({ createdAt: -1 });
readingEventSchema.index({ bookId: 1, createdAt: -1 });

export type ReadingEventDocument = InferSchemaType<typeof readingEventSchema>;
export const ReadingEvent = model("ReadingEvent", readingEventSchema);
