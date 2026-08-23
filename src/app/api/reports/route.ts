import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getHydro } from "@/lib/hydro";
import { rateLimit } from "@/lib/ratelimit";
import {
  createReport,
  listReports,
  newId,
  validateReport,
} from "@/lib/reports";
import { assessRisk } from "@/lib/risk";
import type { ReportKind, Stats } from "@/lib/types";
import { REPORT_KINDS } from "@/lib/types";

export const dynamic = "force-dynamic";

const PERIODS: Record<string, number | undefined> = {
  "6h": 6 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  all: undefined,
};

function device(req: NextRequest): string {
  return req.headers.get("x-device") ?? "";
}

async function buildStats(): Promise<Stats> {
  const c = await db();
  const day = Date.now() - 24 * 60 * 60 * 1000;
  const res = await c.execute({
    sql: `SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS last24,
            SUM(CASE WHEN created_at >= ? AND status != 'resolved'
                      AND status != 'disputed' THEN 1 ELSE 0 END) AS active,
            SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) AS confirmed,
            SUM(CASE WHEN kind = 'help' AND created_at >= ?
                      AND status != 'resolved' THEN 1 ELSE 0 END) AS help,
            SUM(CASE WHEN kind = 'road' AND created_at >= ?
                      AND status != 'resolved' THEN 1 ELSE 0 END) AS roads
          FROM reports`,
    args: [day, day, day, day],
  });
  const r = res.rows[0] ?? {};

  const levels = await c.execute({
    sql: `SELECT level, COUNT(*) AS n FROM reports
          WHERE kind = 'water' AND created_at >= ? GROUP BY level`,
    args: [day],
  });
  const byLevel: Record<string, number> = {};
  for (const row of levels.rows) {
    if (row.level != null) byLevel[String(row.level)] = Number(row.n);
  }

  return {
    total: Number(r.total ?? 0),
    last24h: Number(r.last24 ?? 0),
    active: Number(r.active ?? 0),
    confirmed: Number(r.confirmed ?? 0),
    helpNeeded: Number(r.help ?? 0),
    roadsBlocked: Number(r.roads ?? 0),
    byLevel,
    updatedAt: Date.now(),
  };
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const period = url.searchParams.get("period") ?? "24h";
    const kindsParam = url.searchParams.get("kinds");
    const kinds = kindsParam
      ? (kindsParam.split(",").filter((k) =>
          REPORT_KINDS.includes(k as ReportKind),
        ) as ReportKind[])
      : undefined;

    const [reports, stats, hydro] = await Promise.all([
      listReports({
        sinceMs: PERIODS[period],
        kinds,
        deviceId: device(req) || undefined,
        limit: 1000,
      }),
      buildStats(),
      getHydro().catch(() => null),
    ]);

    // Оценку риска считаем всегда по последним суткам, независимо от фильтра:
    // тревога по городу не должна зависеть от того, что человек выбрал в UI.
    const forRisk =
      period === "24h" && !kinds
        ? reports
        : await listReports({ sinceMs: PERIODS["24h"], limit: 1000 });

    return NextResponse.json(
      { reports, stats, hydro, risk: assessRisk(hydro, forRisk) },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    console.error("GET /api/reports", e);
    return NextResponse.json({ error: "generic" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const dev = device(req);
    if (!dev) return NextResponse.json({ error: "no_device" }, { status: 400 });

    if (!rateLimit(`report:${dev}`, 10, 10 * 60 * 1000)) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }

    const body = await req.json();
    const input = {
      kind: body.kind as ReportKind,
      level: body.level ?? null,
      lat: Number(body.lat),
      lng: Number(body.lng),
      address: body.address ?? null,
      comment: body.comment ?? null,
      deviceId: dev,
    };

    const problem = validateReport(input);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });

    let photoId: string | null = null;
    if (typeof body.photo === "string" && body.photo.startsWith("data:image/")) {
      const match = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(body.photo);
      if (match) {
        const [, mime, data] = match;
        if (data.length * 0.75 > 1_500_000) {
          return NextResponse.json({ error: "photo_too_large" }, { status: 413 });
        }
        photoId = newId();
        const c = await db();
        await c.execute({
          sql: `INSERT INTO photos (id, mime, data, created_at) VALUES (?, ?, ?, ?)`,
          args: [photoId, mime, data, Date.now()],
        });
      }
    }

    const report = await createReport({ ...input, photoId });
    return NextResponse.json({ report }, { status: 201 });
  } catch (e) {
    console.error("POST /api/reports", e);
    return NextResponse.json({ error: "generic" }, { status: 500 });
  }
}
