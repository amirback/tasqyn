/**
 * Service worker Tasqyn.
 *
 * Задача одна: если человек уже открывал приложение, оно должно открыться и
 * без сети — чтобы можно было составить сообщение и отдать его очереди.
 *
 * Чего он НЕ делает: не кеширует скрипты и стили приложения. Раньше кешировал,
 * и это вышло боком — после обновления сайта у вернувшегося посетителя ещё
 * долго открывалась старая сборка со старыми багами. Ради экономии пары
 * сотен килобайт такое не делают, тем более в сервисе про паводок, где
 * исправление должно доезжать до людей сразу.
 */

const DEV =
  self.location.hostname === "localhost" || self.location.hostname === "127.0.0.1";

const VERSION = "tasqyn-v3";
const SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;

const SHELL_URLS = ["/", "/map", "/report", "/alerts"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      // Одна недоступная страница не должна ронять всю установку.
      .then((cache) => Promise.allSettled(SHELL_URLS.map((u) => cache.add(u))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  if (DEV) return;

  const url = new URL(request.url);

  /*
   * Навигация: сначала сеть, при отказе — сохранённая копия. Так человек без
   * связи всё равно попадает в приложение, а со связью всегда получает
   * свежую страницу.
   */
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() =>
          caches
            .match(request)
            .then((hit) => hit || caches.match("/map") || caches.match("/")),
        ),
    );
    return;
  }

  // Фото неизменяемы: id выдаётся один раз вместе с сообщением.
  if (url.origin === self.location.origin && url.pathname.startsWith("/api/photo/")) {
    event.respondWith(cacheFirst(request, RUNTIME));
    return;
  }

  // Остальное API всегда из сети: устаревшая карта паводка опаснее пустого экрана.
  if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) return;

  // Тайлы карты — тяжёлые и неизменяемые, их кешировать полезно.
  if (url.hostname.endsWith("openfreemap.org")) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME));
    return;
  }

  /*
   * Всё остальное — скрипты, стили, шрифты приложения — отдаём браузеру как
   * есть. У Next.js имена файлов содержат хеш содержимого, обычный HTTP-кеш
   * справляется с этим лучше и, главное, не переживает обновление сайта.
   */
});

function cacheFirst(request, cacheName) {
  return caches.match(request).then(
    (hit) =>
      hit ||
      fetch(request).then((res) => {
        const copy = res.clone();
        caches.open(cacheName).then((c) => c.put(request, copy));
        return res;
      }),
  );
}

function staleWhileRevalidate(request, cacheName) {
  return caches.match(request).then((hit) => {
    const network = fetch(request)
      .then((res) => {
        if (res.ok || res.type === "opaque") {
          const copy = res.clone();
          caches.open(cacheName).then((c) => c.put(request, copy));
        }
        return res;
      })
      .catch(() => hit);
    return hit || network;
  });
}

/* ── Push-уведомления ─────────────────────────────────────── */

self.addEventListener("push", (event) => {
  let payload = {
    title: "Tasqyn",
    body: "Рядом появилось сообщение о воде.",
    url: "/map",
    tag: "tasqyn-water",
  };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    /* прилетело неJSON — покажем текст по умолчанию */
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: payload.tag,
      renotify: true,
      data: { url: payload.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/map";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      // Если вкладка Tasqyn уже открыта — не плодим новые.
      for (const client of list) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
