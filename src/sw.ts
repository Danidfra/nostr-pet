/// <reference lib="webworker" />
export {};
declare let self: ServiceWorkerGlobalScope;
declare global {
  interface NotificationOptions {
    renotify?: boolean;
    timestamp?: number; // se você também estiver usando 'timestamp'
  }
}

import {cleanupOutdatedCaches, precacheAndRoute, createHandlerBoundToURL} from 'workbox-precaching';
import {registerRoute, NavigationRoute} from 'workbox-routing';
import {CacheFirst, StaleWhileRevalidate} from 'workbox-strategies';
import {ExpirationPlugin} from 'workbox-expiration';
import {CacheableResponsePlugin} from 'workbox-cacheable-response';

// Atualização imediata do SW
self.skipWaiting();
self.clients.claim();

// Precaching (o Vite injeta a lista aqui)
precacheAndRoute(self.__WB_MANIFEST);

// Limpa caches antigos
cleanupOutdatedCaches();

// SPA fallback para /index.html (evita /api e /static)
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/index.html'), {
    denylist: [/^\/api\//, /^\/static\//],
  }),
);

// Cache de imagens do tumblr (30 dias)
registerRoute(
  /^https:\/\/static\.tumblr\.com\/.*\.(jpe?g|png|gif|svg|webp)$/i,
  new CacheFirst({
    cacheName: 'static-assets',
    plugins: [
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
  'GET',
);

// Cache de imagens genéricas (7 dias)
registerRoute(
  /^https:\/\/.*\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
  new CacheFirst({
    cacheName: 'image-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
  'GET',
);

// Cache de JS/CSS/fonts (7 dias)
registerRoute(
  /^https:\/\/.*\.(?:js|css|woff|woff2|ttf|eot)$/i,
  new CacheFirst({
    cacheName: 'static-resources',
    plugins: [
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
  'GET',
);

// API: Stale-While-Revalidate (5 min)
registerRoute(
  /^https?:\/\/.*\/api\/.*$/i,
  new StaleWhileRevalidate({
    cacheName: 'api-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 5 * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
  'GET',
);

// Recursos externos genéricos (24h)
registerRoute(
  /^https?:\/\/.*\/.*$/i,
  new StaleWhileRevalidate({
    cacheName: 'external-resources',
    plugins: [
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 24 * 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
  'GET',
);

// --- Push Notifications ---
self.addEventListener('push', (event: PushEvent) => {
  try {
    console.log('[SW] push received');
    const data = event.data ? (event.data.json() as any) : {};
    const title = data.title || 'Blobbi';
    const body = data.body || '';
    const tag = data.tag || 'blobbi-status';
    const renotify = data.renotify === true;

    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-72.png',
        tag,
        renotify,
        data: data.data || {},
      }),
    );
  } catch (err) {
    console.error('[SW] push error:', err);
  }
});

// --- Click em Notificação ---
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const targetUrl =
    (event.notification.data && (event.notification.data as any).url) || '/blobbi';

  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of all) {
        if ((client as WindowClient).url.includes(self.location.origin)) {
          await (client as WindowClient).focus();
          if ('navigate' in client && targetUrl) {
            // @ts-expect-error: navigate pode existir
            await (client as any).navigate(targetUrl);
          }
          return;
        }
      }
      if (self.clients.openWindow && targetUrl) {
        await self.clients.openWindow(targetUrl);
      }
    })(),
  );
});