import { NextResponse, type NextRequest } from "next/server";
import { DASH_COOKIE, isDashboardToken } from "@/lib/auth";
import { listReports } from "@/lib/reports";
import { WATER_LEVEL_CM, type WaterLevel } from "@/lib/types";

export const dynamic = "force-dynamic";

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Выгрузка для штаба: Excel в ведомстве всё равно откроют быстрее любого API. */
export async function GET(req: NextRequest) {
  if (!isDashboardToken(req.cookies.get(DASH_COOKIE)?.value)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const reports = await listReports({ limit: 2000, includeDisputed: true });
  const header = [
    "id",
    "время",
    "тип",
    "глубина_см",
    "широта",
    "долгота",
    "адрес",
    "статус",
    "подтверждений",
    "опровержений",
    "комментарий",
  ];

  const rows = reports.map((r) =>
    [
      r.id,
      new Date(r.createdAt).toISOString(),
      r.kind,
      r.level ? WATER_LEVEL_CM[r.level as WaterLevel] : "",
      r.lat.toFixed(6),
      r.lng.toFixed(6),
      r.address ?? "",
      r.status,
      r.confirms,
      r.disputes,
      r.comment ?? "",
    ]
      .map(csvCell)
      .join(";"),
  );

  // BOM — иначе Excel открывает кириллицу кракозябрами.
  const csv = "﻿" + [header.join(";"), ...rows].join("\r\n");
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="tasqyn-uralsk-${stamp}.csv"`,
    },
  });
}
