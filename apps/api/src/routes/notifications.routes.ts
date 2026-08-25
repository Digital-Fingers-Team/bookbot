import { Router, type Router as ExpressRouter } from "express";
import { isValidObjectId } from "mongoose";
import { requireAdmin } from "../middleware/auth.middleware.js";
import { Notification } from "../models/notification.model.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { cursorFilter, nextCursor, parsePageParams } from "../utils/pagination.js";

export const notificationsRouter: ExpressRouter = Router();

notificationsRouter.get(
  "/",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { limit, cursor } = parsePageParams(req.query, 30, 100);
    const filter = {
      recipientId: req.user!.id,
      ...(req.query.unread === "true" ? { readAt: { $exists: false } } : {}),
      ...cursorFilter(cursor)
    };
    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .lean();

    res.json({
      nextCursor: nextCursor(notifications, limit),
      notifications: notifications.map((notification) => ({
        id: String(notification._id),
        type: notification.type,
        title: notification.title,
        message: notification.message,
        href: notification.href ?? null,
        readAt: notification.readAt ?? null,
        createdAt: notification.createdAt
      }))
    });
  })
);

notificationsRouter.get(
  "/unread-count",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const count = await Notification.countDocuments({ recipientId: req.user!.id, readAt: { $exists: false } });
    res.json({ count });
  })
);

notificationsRouter.post(
  "/mark-all-read",
  requireAdmin,
  asyncHandler(async (req, res) => {
    await Notification.updateMany(
      { recipientId: req.user!.id, readAt: { $exists: false } },
      { $set: { readAt: new Date() } }
    );
    res.json({ ok: true });
  })
);

notificationsRouter.post(
  "/:id/read",
  requireAdmin,
  asyncHandler(async (req, res) => {
    if (!isValidObjectId(req.params.id)) {
      throw new ApiError(400, "INVALID_NOTIFICATION_ID", "The notification id is invalid.");
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipientId: req.user!.id },
      { $set: { readAt: new Date() } },
      { new: true }
    ).lean();
    if (!notification) {
      throw new ApiError(404, "NOTIFICATION_NOT_FOUND", "This notification was not found.");
    }

    res.json({ id: String(notification._id), readAt: notification.readAt ?? null });
  })
);
