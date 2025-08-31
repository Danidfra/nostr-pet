/// <reference lib="webworker" />
export {};
declare let self: ServiceWorkerGlobalScope;

// Light extension to allow renotify/timestamp in TS
declare global {
  interface NotificationOptions {
    renotify?: boolean;
    timestamp?: number;
  }
}

/** Optional data that may come inside payload.data */
interface BlobbiPushData {
  url?: string;
  severity?: "care" | "serious";
  type?: "confirmation" | "test" | "status";
  [k: string]: unknown;
}

/** Full payload that the backend sends in push */
interface BlobbiPushPayload {
  title?: string;
  body?: string;
  tag?: string;
  renotify?: boolean;
  data?: BlobbiPushData;
  timestamp?: number;
}

/** WindowClient with optional navigate (some browsers expose it) */
interface WindowClientWithNavigate extends WindowClient {
  navigate(url: string): Promise<WindowClient | null>;
}
function hasNavigate(c: WindowClient): c is WindowClientWithNavigate {
  return 'navigate' in c;
}

import {
  cleanupOutdatedCaches,
  precacheAndRoute,
  createHandlerBoundToURL,
} from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { CacheFirst, StaleWhileRevalidate } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";

// Immediate SW update
self.skipWaiting();
self.clients.claim();

// Precaching (Vite injects the list here)
precacheAndRoute(self.__WB_MANIFEST);

// Clean old caches
cleanupOutdatedCaches();

// SPA fallback to /index.html (avoid /api and /static)
registerRoute(
  new NavigationRoute(createHandlerBoundToURL("/index.html"), {
    denylist: [/^\/api\//, /^\/static\//],
  }),
);

// Tumblr image cache (30 days)
registerRoute(
  /^https:\/\/static\.tumblr\.com\/.*\.(jpe?g|png|gif|svg|webp)$/i,
  new CacheFirst({
    cacheName: "static-assets",
    plugins: [
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
  "GET",
);

// Generic image cache (7 days)
registerRoute(
  /^https:\/\/.*\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
  new CacheFirst({
    cacheName: "image-cache",
    plugins: [
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
  "GET",
);

// JS/CSS/fonts cache (7 days)
registerRoute(
  /^https:\/\/.*\.(?:js|css|woff|woff2|ttf|eot)$/i,
  new CacheFirst({
    cacheName: "static-resources",
    plugins: [
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
  "GET",
);

// API: Stale-While-Revalidate (5 min)
registerRoute(
  /^https?:\/\/.*\/api\/.*$/i,
  new StaleWhileRevalidate({
    cacheName: "api-cache",
    plugins: [
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 5 * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
  "GET",
);

// Generic external resources (24h)
registerRoute(
  /^https?:\/\/.*\/.*$/i,
  new StaleWhileRevalidate({
    cacheName: "external-resources",
    plugins: [
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 24 * 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
  "GET",
);

// --- Push Notifications ---
self.addEventListener("push", (event: PushEvent) => {
  try {
    const payload: BlobbiPushPayload = event.data ? (event.data.json() as BlobbiPushPayload) : {};
    const title = payload.title ?? "Blobbi";
    const body = payload.body ?? "";
    const tag = payload.tag ?? "blobbi-status";
    const renotify = payload.renotify === true;
    const data: BlobbiPushData = payload.data ?? {};

    event.waitUntil((async () => {
      // Close old notifications with the same tag
      const existing = await self.registration.getNotifications({ tag });
      existing.forEach((n) => n.close());

      await self.registration.showNotification(title, {
        body,
        icon: "/icons/icon-192.png",
        badge: "/icons/badge-72.png",
        tag,
        renotify,
        data,
        timestamp: payload.timestamp ?? Date.now(),
        // Optional vibration
        // vibrate: [100, 50, 100],
      });
    })());
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[SW] push error:", err);
  }
});

// --- Notification click ---
self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();

  const ndata = event.notification.data as { url?: string } | undefined;
  const targetUrl = (ndata?.url && typeof ndata.url === "string") ? ndata.url : "/blobbi";

  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of all) {
      const win = client; // WindowClient
      if (win.url.includes(self.location.origin)) {
        await win.focus();
        if (hasNavigate(win) && targetUrl) {
          await win.navigate(targetUrl);
        }
        return;
      }
    }
    if (self.clients.openWindow && targetUrl) {
      await self.clients.openWindow(targetUrl);
    }
  })());
});