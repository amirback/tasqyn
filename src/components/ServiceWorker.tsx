"use client";

import { useEffect } from "react";

/**
 * Регистрируем service worker везде: без него не работают push-уведомления,
 * а проверить их иначе негде. Кеширование сам worker на localhost отключает,
 * поэтому горячей перезагрузке он больше не мешает.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* приложение обязано работать и без него */
      });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
