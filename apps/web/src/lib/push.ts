import { getPushPublicKey, subscribeToPush, unsubscribeFromPush } from "./api";

/**
 * Web Push needs a secure context (HTTPS, or localhost during development) and
 * a browser with both the Service Worker and Push APIs. Everything here returns
 * a state rather than throwing, so the UI can simply hide the toggle where push
 * cannot work — an HTTP deployment included.
 */
export function isPushSupported(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.isSecureContext && "serviceWorker" in navigator && "PushManager" in window);
}

export function pushPermission(): NotificationPermission | "unsupported" {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission;
}

/** base64url → Uint8Array, the format PushManager expects for the VAPID key. */
function decodeKey(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  // Backed by an explicit ArrayBuffer: PushManager.subscribe rejects the
  // SharedArrayBuffer-capable default type.
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register("/sw.js").then(() => navigator.serviceWorker.ready);
}

export async function currentPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const existing = await navigator.serviceWorker.getRegistration();
  if (!existing) return null;
  return existing.pushManager.getSubscription();
}

/** Asks for permission, registers the worker, and stores the subscription. */
export async function enablePush(token?: string): Promise<"enabled" | "denied" | "unsupported" | "unavailable"> {
  if (!isPushSupported()) return "unsupported";

  const { publicKey } = await getPushPublicKey(token).catch(() => ({ publicKey: null }));
  if (!publicKey) return "unavailable";

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";

  const worker = await registration();
  const subscription =
    (await worker.pushManager.getSubscription()) ??
    (await worker.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeKey(publicKey)
    }));

  await subscribeToPush(subscription.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }, token);
  return "enabled";
}

export async function disablePush(token?: string): Promise<void> {
  const subscription = await currentPushSubscription();
  if (!subscription) return;
  // Drop the server row first: a browser-side unsubscribe that succeeds while
  // the row survives would leave us pushing to a dead endpoint.
  await unsubscribeFromPush(subscription.endpoint, token).catch(() => undefined);
  await subscription.unsubscribe().catch(() => undefined);
}
