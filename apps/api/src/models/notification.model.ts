import { Schema, model, type InferSchemaType } from "mongoose";

export const NOTIFICATION_EVENT_TYPES = [
  "book_ready",
  "book_failed",
  "access_request",
  "feedback",
  "user_registered"
] as const;

export type NotificationEventType = (typeof NOTIFICATION_EVENT_TYPES)[number];

const notificationSchema = new Schema(
  {
    recipientId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: NOTIFICATION_EVENT_TYPES, required: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    message: { type: String, required: true, trim: true, maxlength: 500 },
    href: { type: String, trim: true, maxlength: 200 },
    readAt: { type: Date }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

notificationSchema.index({ recipientId: 1, readAt: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, createdAt: -1 });

export type NotificationDocument = InferSchemaType<typeof notificationSchema>;
export const Notification = model("Notification", notificationSchema);
