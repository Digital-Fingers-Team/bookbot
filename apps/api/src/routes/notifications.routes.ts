import { Router, type Router as ExpressRouter } from "express";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.middleware.js";
import { Notification } from "../models/notification.model.js";
import { PushSubscription } from "../models/push-subscription.model.js";
import { isPushConfigured, pushPublicKey } from "../services/notifications/push.service.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { cursorFilter, nextCursor, parsePageParams } from "../utils/pagination.js";

export const notificationsRouter: ExpressRouter = Router();

notificationsRouter.get(
  "/",
  requireAuth,
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
  requireAuth,
  asyncHandler(async (req, res) => {
    const count = await Notification.countDocuments({ recipientId: req.user!.id, readAt: { $exists: false } });
    res.json({ count });
  })
);

notificationsRouter.post(
  "/mark-all-read",
  requireAuth,
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
  requireAuth,
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

/**
 * Web Push registration. The public key is what the browser needs to subscribe;
 * a null key tells the client the feature is off, so it can hide the toggle
 * instead of failing when VAPID keys aren't configured yet.
 */
notificationsRouter.get(
  "/push/public-key",
  requireAuth,
  asyncHandler(async (_req, res) => {
    res.json({ publicKey: pushPublicKey() });
  })
);

const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({
    p256dh: z.string().min(1).max(200),
    auth: z.string().min(1).max(100)
  })
});

notificationsRouter.post(
  "/push/subscribe",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!isPushConfigured()) {
      throw new ApiError(503, "PUSH_NOT_CONFIGURED", "Push notifications are not configured on this server.");
    }
    const parsed = pushSubscriptionSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, "INVALID_PUSH_SUBSCRIPTION", "This push subscription is invalid.");
    }

    // Re-subscribing on a browser that already registered, or one whose
    // registration moved to another account, must not create a duplicate.
    await PushSubscription.findOneAndUpdate(
      { endpoint: parsed.data.endpoint },
      {
        $set: {
          userId: req.user!.id,
          keys: parsed.data.keys,
          userAgent: String(req.headers["user-agent"] ?? "").slice(0, 300)
        }
      },
      { upsert: true }
    );

    res.json({ ok: true });
  })
);

notificationsRouter.post(
  "/push/unsubscribe",
  requireAuth,
  asyncHandler(async (req, res) => {
    const endpoint = typeof req.body?.endpoint === "string" ? req.body.endpoint : "";
    if (endpoint) {
      await PushSubscription.deleteOne({ endpoint, userId: req.user!.id });
    }
    res.json({ ok: true });
  })
);
