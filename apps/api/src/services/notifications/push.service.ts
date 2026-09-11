import webpush from "web-push";
import type { Types } from "mongoose";
import { env } from "../../config/env.js";
import { PushSubscription } from "../../models/push-subscription.model.js";

export type PushPayload = {
  title: string;
  message: string;
  href?: string;
};

let configured: boolean | null = null;

/**
 * Web Push stays dormant until both VAPID keys are set, so the feature can ship
 * before the deployment has HTTPS (browsers refuse to register a service worker
 * over plain HTTP anyway). Generate a pair with `npx web-push generate-vapid-keys`.
 */
export function isPushConfigured(): boolean {
  if (configured !== null) return configured;
  configured = Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
  if (configured) {
    webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!);
  }
  return configured;
}

export function pushPublicKey(): string | null {
  return isPushConfigured() ? env.VAPID_PUBLIC_KEY! : null;
}

/**
 * Best-effort, like the notification rows themselves: a push service being down
 * must never fail the upload or request that triggered it.
 */
export async function sendPushToUsers(userIds: Types.ObjectId[], payload: PushPayload): Promise<void> {
  if (!isPushConfigured() || !userIds.length) return;
  try {
    const subscriptions = await PushSubscription.find({ userId: { $in: userIds } }).lean();
    if (!subscriptions.length) return;

    const body = JSON.stringify({
      title: payload.title,
      message: payload.message,
      href: payload.href ?? "/notifications"
    });

    await Promise.all(
      subscriptions.map(async (subscription) => {
        // Rows always carry keys (the schema requires them), but lean() types
        // the nested object as optional.
        if (!subscription.keys?.p256dh || !subscription.keys?.auth) return;
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth }
            },
            body
          );
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          // 404/410 mean the browser dropped the registration for good.
          if (status === 404 || status === 410) {
            await PushSubscription.deleteOne({ endpoint: subscription.endpoint }).catch(() => undefined);
            return;
          }
          console.warn("[push] delivery failed:", status ?? error);
        }
      })
    );
  } catch (error) {
    console.warn("[push] could not send notifications:", error);
  }
}
