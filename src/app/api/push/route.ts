import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { insidePilot } from "@/lib/geo";
import { coarse, pushConfigured, vapidPublicKey } from "@/lib/push";
import { newId } from "@/lib/reports";

export const dynamic = "force-dynamic";

/** Открытый ключ VAPID — он публичный по назначению, его отдаём всем. */
export async function GET() {
  return NextResponse.json({
    enabled: pushConfigured(),
    publicKey: vapidPublicKey(),
  });
}

interface Area {
  lat: number;
  lng: number;
  radiusM: number;
}

/**
 * Сохраняем подписку браузера и точки наблюдения.
 * Каждый вызов полностью заменяет прежний набор точек этого устройства —
 * так список на сервере не расходится с тем, что человек видит у себя.
 */
export async function POST(req: NextRequest) {
  if (!pushConfigured()) {
    return NextResponse.json({ error: "push_disabled" }, { status: 503 });
  }
  const device = req.headers.get("x-device") ?? "";
  if (!device) return NextResponse.json({ error: "no_device" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const sub = body?.subscription;
  const areas: Area[] = Array.isArray(body?.areas) ? body.areas : [];
  const locale = ["ru", "kk", "en"].includes(body?.locale) ? body.locale : "ru";

  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return NextResponse.json({ error: "bad_subscription" }, { status: 400 });
  }

  const clean = areas
    .filter(
      (a) =>
        typeof a?.lat === "number" &&
        typeof a?.lng === "number" &&
        insidePilot(a.lat, a.lng),
    )
    .slice(0, 10)
    .map((a) => ({
      lat: coarse(a.lat),
      lng: coarse(a.lng),
      radiusM: Math.min(Math.max(Number(a.radiusM) || 1000, 200), 5000),
    }));

  const c = await db();
  const now = Date.now();

  await c.execute({
    sql: `INSERT INTO push_subs (id, device_id, endpoint, p256dh, auth, locale, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(endpoint) DO UPDATE SET
            device_id = excluded.device_id,
            p256dh = excluded.p256dh,
            auth = excluded.auth,
            locale = excluded.locale`,
    args: [newId(), device, sub.endpoint, sub.keys.p256dh, sub.keys.auth, locale, now],
  });

  const found = await c.execute({
    sql: `SELECT id FROM push_subs WHERE endpoint = ?`,
    args: [sub.endpoint],
  });
  const subId = String(found.rows[0]?.id ?? "");
  if (!subId) return NextResponse.json({ error: "generic" }, { status: 500 });

  await c.execute({ sql: `DELETE FROM push_areas WHERE sub_id = ?`, args: [subId] });
  for (const a of clean) {
    await c.execute({
      sql: `INSERT INTO push_areas (id, sub_id, lat, lng, radius_m, notified_at, created_at)
            VALUES (?, ?, ?, ?, ?, 0, ?)`,
      args: [newId(), subId, a.lat, a.lng, a.radiusM, now],
    });
  }

  return NextResponse.json({ ok: true, areas: clean.length });
}

/** Отписка: человек выключил уведомления — убираем всё, что о нём знали. */
export async function DELETE(req: NextRequest) {
  const device = req.headers.get("x-device") ?? "";
  if (!device) return NextResponse.json({ error: "no_device" }, { status: 400 });

  const c = await db();
  const subs = await c.execute({
    sql: `SELECT id FROM push_subs WHERE device_id = ?`,
    args: [device],
  });
  for (const row of subs.rows) {
    await c.execute({
      sql: `DELETE FROM push_areas WHERE sub_id = ?`,
      args: [String(row.id)],
    });
  }
  await c.execute({ sql: `DELETE FROM push_subs WHERE device_id = ?`, args: [device] });
  return NextResponse.json({ ok: true });
}
