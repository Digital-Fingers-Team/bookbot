import { Types } from "mongoose";
import { Notification, type NotificationEventType } from "../../models/notification.model.js";
import { User } from "../../models/user.model.js";
import { sendPushToUsers } from "./push.service.js";

export type NotificationInput = {
  type: NotificationEventType;
  title: string;
  message: string;
  href?: string;
};

/**
 * Deliver to one person — the reader an admin just answered, say. Same
 * best-effort contract as notifyAdmins: the triggering action must still
 * succeed if the notification or its push fails.
 */
export async function notifyUser(recipientId: unknown, input: NotificationInput): Promise<void> {
  try {
    const id = new Types.ObjectId(String(recipientId));
    const title = input.title.slice(0, 160);
    const message = input.message.slice(0, 500);
    const href = input.href?.slice(0, 200);

    await Notification.create({ recipientId: id, type: input.type, title, message, href });
    await sendPushToUsers([id], { title, message, href });
  } catch (error) {
    console.warn("[notifications] could not notify user:", error);
  }
}

/**
 * Notifications are best-effort side effects. A database hiccup should never
 * make a successful upload, request, or registration fail for the user.
 */
export async function notifyAdmins(input: NotificationInput): Promise<void> {
  try {
    const admins = await User.find({ role: "admin" }, { _id: 1 }).lean();
    if (!admins.length) return;

    const title = input.title.slice(0, 160);
    const message = input.message.slice(0, 500);
    const href = input.href?.slice(0, 200);

    await Notification.insertMany(
      admins.map((admin) => ({
        recipientId: admin._id,
        type: input.type,
        title,
        message,
        href
      }))
    );

    // The stored row is the record; the push is the nudge. Awaited so failures
    // surface in the same catch, but sendPushToUsers never throws on its own.
    await sendPushToUsers(admins.map((admin) => admin._id), { title, message, href });
  } catch (error) {
    console.warn("[notifications] could not create admin notification:", error);
  }
}
