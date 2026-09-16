import { Schema, model, type InferSchemaType } from "mongoose";

// `key` is the blob-storage key and never leaves the server: attachments are
// served through /api/support/attachments/:messageId/:index, which re-checks
// that the caller is a party to the thread.
const attachmentSchema = new Schema(
  {
    key: { type: String, required: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    mime: { type: String, required: true, maxlength: 120 },
    size: { type: Number, required: true }
  },
  { _id: false }
);

const supportMessageSchema = new Schema(
  {
    threadId: { type: Schema.Types.ObjectId, ref: "SupportThread", required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    senderRole: { type: String, enum: ["user", "admin"], required: true },
    // Snapshotted so rendering a thread never has to populate users, and so the
    // reader still sees which admin answered after that admin is renamed.
    senderName: { type: String, required: true, trim: true, maxlength: 120 },
    body: { type: String, default: "", trim: true, maxlength: 4000 },
    attachments: { type: [attachmentSchema], default: [] }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Threads are read oldest-first, like any chat transcript.
supportMessageSchema.index({ threadId: 1, createdAt: 1, _id: 1 });

export type SupportMessageDocument = InferSchemaType<typeof supportMessageSchema>;
export const SupportMessage = model("SupportMessage", supportMessageSchema);
