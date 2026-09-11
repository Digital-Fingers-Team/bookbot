/**
 * AradoBot service worker — Web Push only.
 *
 * Registered from lib/push.ts, and only ever on HTTPS (or localhost): browsers
 * refuse to register a service worker on a plain-HTTP origin, which is why push
 * stays dormant until the deployment has a certificate.
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = payload.title || "AradoBot";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.message || "",
      icon: "/logo.jpeg",
      badge: "/logo.jpeg",
      // Collapses repeat notifications for the same target instead of stacking.
      tag: payload.href || "aradobot",
      data: { href: payload.href || "/notifications" }
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = (event.notification.data && event.notification.data.href) || "/notifications";

  // Focus an already-open tab rather than piling up new windows.
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(href) && "focus" in client) return client.focus();
      }
      const target = new URL(href, self.location.origin).href;
      return self.clients.openWindow ? self.clients.openWindow(target) : undefined;
    })
  );
});
