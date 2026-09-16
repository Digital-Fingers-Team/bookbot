import { Schema, model, type InferSchemaType } from "mongoose";

export const SUPPORT_TOPICS = ["general", "access", "technical", "content", "billing"] as const;
export type SupportTopic = (typeof SUPPORT_TOPICS)[number];

export const SUPPORT_STATUSES = ["open", "closed"] as const;

/**
 * One "contact us" conversation between a reader and the admin team.
 *
 * Messages live in their own collection (support-message.model.ts) rather than
 * embedded here: a support thread has no natural length limit, while an inbox
 * row only ever needs the denormalised summary below. Keeping them apart means
 * listing threads stays cheap however long individual threads grow.
 */
const supportThreadSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    subject: { type: String, required: true, trim: true, maxlength: 160 },
    topic: { type: String, enum: SUPPORT_TOPICS, required: true, default: "general" },
    status: { type: String, enum: SUPPORT_STATUSES, required: true, default: "open" },

    // --- Denormalised summary, rewritten on every message ---
    lastMessageAt: { type: Date, required: true, default: Date.now },
    lastMessagePreview: { type: String, default: "", maxlength: 200 },
    // Whose turn it is. A thread whose last word came from the reader is one the
    // admins still owe an answer, which is what drives the "needs reply" filter.
    lastSenderRole: { type: String, enum: ["user", "admin"], required: true, default: "user" },
    messageCount: { type: Number, required: true, default: 0 },

    // Unread counters, incremented for the *other* side on each message and
    // zeroed when that side opens the thread. Cheaper than a per-message read
    // marker, and enough for both the nav badge and the per-row dot.
    unreadForUser: { type: Number, required: true, default: 0 },
    unreadForAdmin: { type: Number, required: true, default: 0 },

    closedAt: { type: Date },
    closedBy: { type: Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

// The reader's own list, newest activity first.
supportThreadSchema.index({ userId: 1, lastMessageAt: -1, _id: -1 });
// The admin inbox, and its status / needs-reply filters over the same order.
supportThreadSchema.index({ status: 1, lastMessageAt: -1, _id: -1 });
supportThreadSchema.index({ lastMessageAt: -1, _id: -1 });

export type SupportThreadDocument = InferSchemaType<typeof supportThreadSchema>;
export const SupportThread = model("SupportThread", supportThreadSchema);
