import { Schema, model, type InferSchemaType } from "mongoose";

// Per-user state for a book: whether it's favorited and where reading was left off.
const bookStateSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    bookId: { type: Schema.Types.ObjectId, ref: "Book", required: true, index: true },
    favorite: { type: Boolean, default: false },
    lastPage: { type: Number, default: 1 },
    lastOpenedAt: { type: Date }
  },
  { timestamps: true }
);

bookStateSchema.index({ userId: 1, bookId: 1 }, { unique: true });

export type BookStateDocument = InferSchemaType<typeof bookStateSchema>;
export const BookState = model("BookState", bookStateSchema);
