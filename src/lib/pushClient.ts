"use client";

import { deviceId } from "./device";
import { loadPlaces } from "./places";

/**
 * Подписка браузера на push.
 *
 * Отличие от прежних уведомлений принципиальное: те показывались, только пока
 * открыта вкладка, то есть почти никогда. Push доходит и с закрытым браузером.
 *
 * Цена — серверу приходится знать, где смотреть. Отправляем координаты,
 * округлённые до ~100 м, без названия места: «дом» и «мама» остаются в
 * телефоне и на сервер не уходят.
 */

export type PushState = "unsupported" | "denied" | "off" | "on";

const round = (v: number) => Math.round(v * 1000) / 1000;

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null;
  try {
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

export async function pushState(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  return sub ? "on" : "off";
}

/** VAPID-ключ приходит в base64url, а PushManager ждёт байты. */
function urlBase64ToBytes(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer;
}

function areasPayload() {
  return loadPlaces().map((p) => ({
    lat: round(p.lat),
    lng: round(p.lng),
    radiusM: p.radiusM,
  }));
}

async function send(subscription: PushSubscription, locale: string) {
  const res = await fetch("/api/push", {
    method: "POST",
    headers: { "content-type": "application/json", "x-device": deviceId() },
    body: JSON.stringify({
      subscription: subscription.toJSON(),
      areas: areasPayload(),
      locale,
    }),
  });
  if (!res.ok) throw new Error("не удалось сохранить подписку");
}

/** Включает push: спрашивает разрешение и регистрирует подписку. */
export async function enablePush(locale: string): Promise<PushState> {
  if (!pushSupported()) return "unsupported";

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return permission === "denied" ? "denied" : "off";
  }

  const keyRes = await fetch("/api/push");
  const { enabled, publicKey } = await keyRes.json();
  if (!enabled || !publicKey) throw new Error("push не настроен на сервере");

  const reg = await registration();
  if (!reg) return "unsupported";

  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToBytes(publicKey),
    }));

  await send(sub, locale);
  return "on";
}

export async function disablePush(): Promise<PushState> {
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) await sub.unsubscribe();
  await fetch("/api/push", {
    method: "DELETE",
    headers: { "x-device": deviceId() },
  }).catch(() => {});
  return "off";
}

/** Пересылает актуальный список адресов, если push уже включён. */
export async function syncAreas(locale: string): Promise<void> {
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await send(sub, locale).catch(() => {});
}
