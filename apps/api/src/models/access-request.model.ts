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
    status: { type: String, enum: ["pending", "approved", "rejected"], required: true, default: "pending", index: true },
    adminNote: { type: String, trim: true, default: "", maxlength: 1000 },
    decidedBy: { type: Schema.Types.ObjectId, ref: "User" },
    decidedAt: { type: Date }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

accessRequestSchema.index({ createdAt: -1 });

export type AccessRequestDocument = InferSchemaType<typeof accessRequestSchema>;
export const AccessRequest = model("AccessRequest", accessRequestSchema);
