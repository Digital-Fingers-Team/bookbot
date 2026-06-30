import { Schema, model, type InferSchemaType } from "mongoose";

// A user's request to be granted access to a book or a whole category, backed
// by an uploaded payment receipt. An admin reviews it and approves (which grants
// the access) or rejects it.
const accessRequestSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    targetType: { type: String, enum: ["book", "category"], required: true },
    // bookId (as string) when targetType=book, or the category name when =category.
    targetValue: { type: String, required: true, trim: true },
    // Human-readable label captured at request time (book title / category name).
    targetLabel: { type: String, trim: true, default: "" },
    // Stored receipt image filename (under RECEIPTS_DIR).
    receiptFile: { type: String, required: true, trim: true },
    receiptMime: { type: String, trim: true, default: "" },
    note: { type: String, trim: true, default: "", maxlength: 1000 },
    // Amount owed at request time (captured from the book's price) for revenue
    // reporting. Categories have no price model yet, so they record 0.
    amount: { type: Number, default: 0, min: 0 },
    currency: { type: String, trim: true, default: "EGP" },
    status: { type: String, enum: ["pending", "approved", "rejected"], required: true, default: "pending", index: true },
    adminNote: { type: String, trim: true, default: "", maxlength: 1000 },
    decidedBy: { type: Schema.Types.ObjectId, ref: "User" },
    decidedAt: { type: Date },
    // False after an admin decision until the user has seen it (drives the
    // in-app "your request was approved/rejected" notification).
    seenByUser: { type: Boolean, default: true }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

accessRequestSchema.index({ createdAt: -1 });

export type AccessRequestDocument = InferSchemaType<typeof accessRequestSchema>;
export const AccessRequest = model("AccessRequest", accessRequestSchema);
