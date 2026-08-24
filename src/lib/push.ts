import webpush from "web-push";
import { db } from "./db";
import { distanceM } from "./geo";
import type { Report } from "./types";

/**
 * Push-уведомления.
 *
 * Раньше предупреждение о воде приходило, только пока открыта вкладка — то
 * есть почти никогда. Настоящий push работает и с закрытым браузером, и это
 * для сервиса про паводок принципиально.
 *
 * Отправляем событийно: как только появляется новое сообщение, ищем подписки,
 * чьи наблюдаемые точки попали в радиус, и шлём им уведомление. Отдельного
 * планировщика не нужно — тревога и так возникает ровно в момент события.
 */

const SUBJECT = "mailto:112@tasqyn.kz";
/** Не чаще одного уведомления в 3 часа на точку — иначе их просто отключат. */
const COOLDOWN_MS = 3 * 60 * 60 * 1000;

export function pushConfigured(): boolean {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY,
  );
}

export function vapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}

function configure() {
  webpush.setVapidDetails(
    SUBJECT,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
}

/** Координаты округляем до ~100 м: точный дом серверу знать незачем. */
export const coarse = (v: number) => Math.round(v * 1000) / 1000;

interface Payload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

const TEXTS: Record<string, (n: number) => Payload> = {
  ru: (n) => ({
    title: "Вода рядом с вашим адресом",
    body:
      n === 1
        ? "Сосед отметил воду рядом. Откройте карту."
        : `Рядом ${n} новых сообщения о воде. Откройте карту.`,
    url: "/map",
    tag: "tasqyn-water",
  }),
  kk: (n) => ({
    title: "Мекенжайыңыздың жанында су",
    body:
      n === 1
        ? "Көрші жақын жерде су белгіледі. Картаны ашыңыз."
        : `Жақын жерде су туралы ${n} жаңа хабарлама. Картаны ашыңыз.`,
    url: "/map",
    tag: "tasqyn-water",
  }),
  en: (n) => ({
    title: "Water near your place",
    body:
      n === 1
        ? "A neighbour reported water nearby. Open the map."
        : `${n} new water reports nearby. Open the map.`,
    url: "/map",
    tag: "tasqyn-water",
  }),
};

/**
 * Стоит ли вообще будить человека этим сообщением.
 * Лужа по щиколотку — не повод; перекрытая дорога, просьба о помощи и
 * вода по колено и глубже — повод.
 */
function worthPushing(r: Report): boolean {
  if (r.kind === "help" || r.kind === "road") return true;
  if (r.kind === "water") return (r.level ?? 0) >= 2;
  return false;
}

export async function notifyNearby(
  report: Report,
  authorDevice: string,
): Promise<number> {
  if (!pushConfigured() || !worthPushing(report)) return 0;
  configure();

  const c = await db();
  const now = Date.now();

  const areas = await c.execute({
    sql: `SELECT a.id AS area_id, a.lat, a.lng, a.radius_m, a.notified_at,
                 s.id AS sub_id, s.endpoint, s.p256dh, s.auth, s.locale, s.device_id
          FROM push_areas a JOIN push_subs s ON s.id = a.sub_id`,
    args: [],
  });

  // Сколько подходящих сообщений рядом за последний час — чтобы в тексте
  // стояло осмысленное число, а не всегда «1».
  const recent = await c.execute({
    sql: `SELECT lat, lng, kind, level FROM reports
          WHERE created_at >= ? AND status != 'disputed' AND status != 'resolved'`,
    args: [now - 60 * 60 * 1000],
  });

  let sent = 0;
  const dead: string[] = [];

  for (const row of areas.rows) {
    const lat = Number(row.lat);
    const lng = Number(row.lng);
    const radius = Number(row.radius_m);

    if (distanceM(lat, lng, report.lat, report.lng) > radius) continue;
    if (now - Number(row.notified_at) < COOLDOWN_MS) continue;
    // Не будим человека его же сообщением.
    if (String(row.device_id) === authorDevice) continue;

    const nearbyCount = recent.rows.filter((r) => {
      const k = String(r.kind);
      const lvl = r.level == null ? 0 : Number(r.level);
      const ok = k === "help" || k === "road" || (k === "water" && lvl >= 2);
      return ok && distanceM(lat, lng, Number(r.lat), Number(r.lng)) <= radius;
    }).length;

    const locale = String(row.locale ?? "ru");
    const payload = (TEXTS[locale] ?? TEXTS.ru)(Math.max(1, nearbyCount));

    try {
      await webpush.sendNotification(
        {
          endpoint: String(row.endpoint),
          keys: { p256dh: String(row.p256dh), auth: String(row.auth) },
        },
        JSON.stringify(payload),
        { TTL: 3600, urgency: "high" },
      );
      sent++;
      await c.execute({
        sql: `UPDATE push_areas SET notified_at = ? WHERE id = ?`,
        args: [now, String(row.area_id)],
      });
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      // 404/410 — подписка мертва, браузер её отозвал.
      if (code === 404 || code === 410) dead.push(String(row.sub_id));
    }
  }

  for (const id of dead) {
    await c.execute({ sql: `DELETE FROM push_areas WHERE sub_id = ?`, args: [id] });
    await c.execute({ sql: `DELETE FROM push_subs WHERE id = ?`, args: [id] });
  }

  return sent;
}
