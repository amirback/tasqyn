import { createClient, type Client } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";

/**
 * Одна база — два режима.
 *  • Локально: файл data/tasqyn.db, создаётся сам, ничего настраивать не надо.
 *  • В облаке: Turso (тот же SQLite), если заданы TURSO_DATABASE_URL и токен.
 * Диалект один и тот же, поэтому кода для «второго режима» не существует.
 */

let client: Client | null = null;
let ready: Promise<void> | null = null;

function connect(): Client {
  const remote = process.env.TURSO_DATABASE_URL;
  if (remote) {
    return createClient({
      url: remote,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  /**
   * На Vercel файловая система только для чтения, кроме /tmp. Пишем туда,
   * чтобы сервис не падал, но данные там живут лишь до перезапуска функции:
   * для боевого пилота обязательно задать TURSO_DATABASE_URL.
   */
  const dir = process.env.VERCEL
    ? "/tmp/tasqyn"
    : path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  return createClient({ url: `file:${path.join(dir, "tasqyn.db")}` });
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS reports (
    id          TEXT PRIMARY KEY,
    kind        TEXT NOT NULL,
    level       INTEGER,
    lat         REAL NOT NULL,
    lng         REAL NOT NULL,
    address     TEXT,
    comment     TEXT,
    photo_id    TEXT,
    device_id   TEXT NOT NULL,
    confirms    INTEGER NOT NULL DEFAULT 0,
    disputes    INTEGER NOT NULL DEFAULT 0,
    status      TEXT NOT NULL DEFAULT 'new',
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_reports_created ON reports (created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_reports_kind ON reports (kind)`,
  `CREATE TABLE IF NOT EXISTS photos (
    id         TEXT PRIMARY KEY,
    mime       TEXT NOT NULL,
    data       TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS votes (
    report_id  TEXT NOT NULL,
    device_id  TEXT NOT NULL,
    value      INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (report_id, device_id)
  )`,
  `CREATE TABLE IF NOT EXISTS subscriptions (
    id         TEXT PRIMARY KEY,
    device_id  TEXT NOT NULL,
    label      TEXT NOT NULL,
    lat        REAL NOT NULL,
    lng        REAL NOT NULL,
    radius_m   INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_subs_device ON subscriptions (device_id)`,
];

async function migrate(c: Client) {
  for (const sql of SCHEMA) await c.execute(sql);
}

/** Возвращает готовый к работе клиент, применив схему ровно один раз. */
export async function db(): Promise<Client> {
  if (!client) client = connect();
  if (!ready) ready = migrate(client);
  await ready;
  return client;
}
