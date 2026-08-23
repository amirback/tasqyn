import { db } from "./db";
import { insidePilot } from "./geo";
import {
  type Report,
  type ReportKind,
  type ReportStatus,
  type WaterLevel,
  REPORT_KINDS,
} from "./types";

/** Через сколько сообщение считается неактуальным и уходит с активной карты. */
export const ACTIVE_WINDOW_MS = 24 * 60 * 60 * 1000;

export function newId(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
  ).toUpperCase();
}

type Row = Record<string, unknown>;

function toReport(r: Row, deviceId?: string, vote?: number): Report {
  return {
    id: String(r.id),
    kind: String(r.kind) as ReportKind,
    level: r.level == null ? null : (Number(r.level) as WaterLevel),
    lat: Number(r.lat),
    lng: Number(r.lng),
    address: r.address == null ? null : String(r.address),
    comment: r.comment == null ? null : String(r.comment),
    photoId: r.photo_id == null ? null : String(r.photo_id),
    confirms: Number(r.confirms ?? 0),
    disputes: Number(r.disputes ?? 0),
    status: String(r.status) as ReportStatus,
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
    mine: deviceId ? String(r.device_id) === deviceId : undefined,
    myVote: vote ?? 0,
  };
}

/**
 * Статус достоверности пересчитывается после каждого голоса.
 * Правило простое и объяснимое: два подтверждения перевешивают,
 * два оспаривания — топят. Никакой скрытой магии, её здесь и не нужно.
 */
export function deriveStatus(
  confirms: number,
  disputes: number,
  current: ReportStatus,
): ReportStatus {
  if (current === "resolved") return "resolved";
  if (disputes >= 2 && disputes > confirms) return "disputed";
  if (confirms >= 2 && confirms > disputes) return "confirmed";
  return "new";
}

export interface CreateReportInput {
  kind: ReportKind;
  level?: number | null;
  lat: number;
  lng: number;
  address?: string | null;
  comment?: string | null;
  photoId?: string | null;
  deviceId: string;
}

export function validateReport(input: Partial<CreateReportInput>): string | null {
  if (!input.kind || !REPORT_KINDS.includes(input.kind as ReportKind)) {
    return "bad_kind";
  }
  if (
    typeof input.lat !== "number" ||
    typeof input.lng !== "number" ||
    Number.isNaN(input.lat) ||
    Number.isNaN(input.lng)
  ) {
    return "bad_coords";
  }
  if (!insidePilot(input.lat, input.lng)) return "outside_pilot";
  if (input.kind === "water") {
    const lvl = Number(input.level);
    if (!(lvl >= 1 && lvl <= 4)) return "bad_level";
  }
  if (input.comment && input.comment.length > 500) return "comment_too_long";
  if (!input.deviceId) return "no_device";
  return null;
}

export async function createReport(input: CreateReportInput): Promise<Report> {
  const c = await db();
  const now = Date.now();
  const id = newId();
  await c.execute({
    sql: `INSERT INTO reports
          (id, kind, level, lat, lng, address, comment, photo_id, device_id,
           confirms, disputes, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 'new', ?, ?)`,
    args: [
      id,
      input.kind,
      input.kind === "water" ? Number(input.level) : null,
      input.lat,
      input.lng,
      input.address ?? null,
      input.comment?.trim() || null,
      input.photoId ?? null,
      input.deviceId,
      now,
      now,
    ],
  });
  const created = await getReport(id, input.deviceId);
  if (!created) throw new Error("insert failed");
  return created;
}

export async function getReport(
  id: string,
  deviceId?: string,
): Promise<Report | null> {
  const c = await db();
  const res = await c.execute({
    sql: `SELECT * FROM reports WHERE id = ?`,
    args: [id],
  });
  const row = res.rows[0] as Row | undefined;
  if (!row) return null;
  let vote = 0;
  if (deviceId) {
    const v = await c.execute({
      sql: `SELECT value FROM votes WHERE report_id = ? AND device_id = ?`,
      args: [id, deviceId],
    });
    vote = v.rows[0] ? Number(v.rows[0].value) : 0;
  }
  return toReport(row, deviceId, vote);
}

export interface ListOptions {
  sinceMs?: number;
  kinds?: ReportKind[];
  limit?: number;
  deviceId?: string;
  includeDisputed?: boolean;
}

export async function listReports(opts: ListOptions = {}): Promise<Report[]> {
  const c = await db();
  const where: string[] = [];
  const args: (string | number)[] = [];

  if (opts.sinceMs) {
    where.push("created_at >= ?");
    args.push(Date.now() - opts.sinceMs);
  }
  if (opts.kinds?.length) {
    where.push(`kind IN (${opts.kinds.map(() => "?").join(",")})`);
    args.push(...opts.kinds);
  }
  if (!opts.includeDisputed) {
    // Оспоренное большинством не показываем на общей карте, но и не удаляем:
    // в панели ДЧС оно видно, потому что ложные сообщения — тоже сигнал.
    where.push("status != 'disputed'");
  }

  const limit = Math.min(opts.limit ?? 500, 2000);
  const res = await c.execute({
    sql: `SELECT * FROM reports
          ${where.length ? "WHERE " + where.join(" AND ") : ""}
          ORDER BY created_at DESC LIMIT ?`,
    args: [...args, limit],
  });

  let votes = new Map<string, number>();
  if (opts.deviceId && res.rows.length) {
    const v = await c.execute({
      sql: `SELECT report_id, value FROM votes WHERE device_id = ?`,
      args: [opts.deviceId],
    });
    votes = new Map(
      v.rows.map((r) => [String(r.report_id), Number(r.value)]),
    );
  }

  return res.rows.map((r) =>
    toReport(r as Row, opts.deviceId, votes.get(String(r.id)) ?? 0),
  );
}

/** Голос соседа: 1 — «подтверждаю», -1 — «неточно». Повторный клик снимает. */
export async function voteReport(
  reportId: string,
  deviceId: string,
  value: 1 | -1,
): Promise<Report | null> {
  const c = await db();
  const report = await c.execute({
    sql: `SELECT device_id, status FROM reports WHERE id = ?`,
    args: [reportId],
  });
  const row = report.rows[0];
  if (!row) return null;
  if (String(row.device_id) === deviceId) return null; // за себя не голосуют

  const prev = await c.execute({
    sql: `SELECT value FROM votes WHERE report_id = ? AND device_id = ?`,
    args: [reportId, deviceId],
  });
  const prevValue = prev.rows[0] ? Number(prev.rows[0].value) : 0;

  if (prevValue === value) {
    await c.execute({
      sql: `DELETE FROM votes WHERE report_id = ? AND device_id = ?`,
      args: [reportId, deviceId],
    });
  } else {
    await c.execute({
      sql: `INSERT INTO votes (report_id, device_id, value, created_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(report_id, device_id)
            DO UPDATE SET value = excluded.value, created_at = excluded.created_at`,
      args: [reportId, deviceId, value, Date.now()],
    });
  }

  const tally = await c.execute({
    sql: `SELECT
            SUM(CASE WHEN value = 1 THEN 1 ELSE 0 END)  AS confirms,
            SUM(CASE WHEN value = -1 THEN 1 ELSE 0 END) AS disputes
          FROM votes WHERE report_id = ?`,
    args: [reportId],
  });
  const confirms = Number(tally.rows[0]?.confirms ?? 0);
  const disputes = Number(tally.rows[0]?.disputes ?? 0);
  const status = deriveStatus(
    confirms,
    disputes,
    String(row.status) as ReportStatus,
  );

  await c.execute({
    sql: `UPDATE reports SET confirms = ?, disputes = ?, status = ?, updated_at = ?
          WHERE id = ?`,
    args: [confirms, disputes, status, Date.now(), reportId],
  });

  return getReport(reportId, deviceId);
}

/** Автор может закрыть своё сообщение: «вода ушла». */
export async function resolveReport(
  reportId: string,
  deviceId: string,
): Promise<Report | null> {
  const c = await db();
  const res = await c.execute({
    sql: `UPDATE reports SET status = 'resolved', updated_at = ?
          WHERE id = ? AND device_id = ?`,
    args: [Date.now(), reportId, deviceId],
  });
  if (res.rowsAffected === 0) return null;
  return getReport(reportId, deviceId);
}

export async function deleteReport(
  reportId: string,
  deviceId: string,
): Promise<boolean> {
  const c = await db();
  const res = await c.execute({
    sql: `DELETE FROM reports WHERE id = ? AND device_id = ?`,
    args: [reportId, deviceId],
  });
  return res.rowsAffected > 0;
}
