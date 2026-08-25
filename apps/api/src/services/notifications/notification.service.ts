import { Notification, type NotificationEventType } from "../../models/notification.model.js";
import { User } from "../../models/user.model.js";

export type NotificationInput = {
  type: NotificationEventType;
  title: string;
  message: string;
  href?: string;
};

/**
 * Notifications are best-effort side effects. A database hiccup should never
 * make a successful upload, request, or registration fail for the user.
 */
export async function notifyAdmins(input: NotificationInput): Promise<void> {
  try {
    const admins = await User.find({ role: "admin" }, { _id: 1 }).lean();
    if (!admins.length) return;

    await Notification.insertMany(
      admins.map((admin) => ({
        recipientId: admin._id,
        type: input.type,
        title: input.title.slice(0, 160),
        message: input.message.slice(0, 500),
        href: input.href?.slice(0, 200)
      }))
    );
  } catch (error) {
    console.warn("[notifications] could not create admin notification:", error);
  }
}
