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
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          // Проверяем обновление сразу и раз в час: иначе исправление
          // доезжает до вернувшегося посетителя только через сутки.
          void reg.update();
          setInterval(() => void reg.update(), 60 * 60 * 1000);
        })
        .catch(() => {
          /* приложение обязано работать и без него */
        });
    };

    /*
     * Новый worker берёт управление — перезагружаем страницу один раз, чтобы
     * человек сразу увидел свежую версию.
     *
     * Только если worker уже был. При самой первой установке controllerchange
     * тоже срабатывает, и без этой проверки каждый новый посетитель получал бы
     * лишнюю перезагрузку на ровном месте.
     */
    const hadController = Boolean(navigator.serviceWorker.controller);
    let reloaded = false;
    const onChange = () => {
      if (!hadController || reloaded) return;
      reloaded = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onChange);
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register);

    return () => {
      window.removeEventListener("load", register);
      navigator.serviceWorker.removeEventListener("controllerchange", onChange);
    };
  }, []);

  return null;
}
