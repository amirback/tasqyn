/**
 * Демонстрационные данные для показа продукта.
 *
 *   node scripts/seed.mjs          — добавить ~45 сообщений по Уральску
 *   node scripts/seed.mjs --clear  — стереть ВСЁ и засеять заново
 *
 * ВАЖНО: каждое такое сообщение помечено словом «[демо]» в комментарии.
 * На боевом сервере, где люди принимают решения об эвакуации, выдуманные
 * точки недопустимы — перед реальным запуском базу нужно очистить.
 */

import { createClient } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";

const remote = process.env.TURSO_DATABASE_URL;
let client;
if (remote) {
  client = createClient({ url: remote, authToken: process.env.TURSO_AUTH_TOKEN });
} else {
  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  client = createClient({ url: `file:${path.join(dir, "tasqyn.db")}` });
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY, kind TEXT NOT NULL, level INTEGER,
    lat REAL NOT NULL, lng REAL NOT NULL, address TEXT, comment TEXT,
    photo_id TEXT, device_id TEXT NOT NULL,
    confirms INTEGER NOT NULL DEFAULT 0, disputes INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'new',
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS photos (
    id TEXT PRIMARY KEY, mime TEXT NOT NULL, data TEXT NOT NULL,
    created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS votes (
    report_id TEXT NOT NULL, device_id TEXT NOT NULL, value INTEGER NOT NULL,
    created_at INTEGER NOT NULL, PRIMARY KEY (report_id, device_id))`,
  `CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY, device_id TEXT NOT NULL, label TEXT NOT NULL,
    lat REAL NOT NULL, lng REAL NOT NULL, radius_m INTEGER NOT NULL,
    created_at INTEGER NOT NULL)`,
];

/** Реальные районы Уральска, где паводок бьёт в первую очередь. */
const AREAS = [
  { name: "Зачаганск", lat: 51.19, lng: 51.331, spread: 0.011, risk: 3 },
  { name: "п. Меловые горки", lat: 51.211, lng: 51.349, spread: 0.007, risk: 3 },
  { name: "Круглоозёрное", lat: 51.132, lng: 51.392, spread: 0.008, risk: 3 },
  { name: "мкр. Строитель", lat: 51.245, lng: 51.36, spread: 0.008, risk: 2 },
  { name: "Центр", lat: 51.2265, lng: 51.3855, spread: 0.009, risk: 1 },
  { name: "п. Деркул", lat: 51.2, lng: 51.458, spread: 0.009, risk: 2 },
  { name: "мкр. Северо-Восток", lat: 51.256, lng: 51.42, spread: 0.01, risk: 1 },
  { name: "мкр. Сарыарка", lat: 51.263, lng: 51.348, spread: 0.008, risk: 2 },
];

const STREETS = [
  "ул. Курмангазы", "пр. Достык", "ул. Мухита", "ул. Жангир хана",
  "ул. Сарайшык", "ул. Абулхаир хана", "ул. Штыбы", "ул. Айтиева",
  "ул. Т. Масина", "ул. Гагарина", "ул. Молдагуловой", "ул. Есенжанова",
];

const COMMENTS = {
  water: [
    "[демо] Двор затопило за ночь, вода прибывает",
    "[демо] Вода стоит у ворот, машину переставили",
    "[демо] Подтопило огород, до дома метр",
    "[демо] Вода зашла в подвал",
    "[демо] Со вчерашнего поднялось сантиметров на двадцать",
  ],
  road: [
    "[демо] Проезд закрыт, объезжайте через центр",
    "[демо] Легковая не проходит, только грузовые",
    "[демо] Дорогу размыло, стоят машины",
    "[демо] Перекрёсток под водой",
  ],
  help: [
    "[демо] Нужна лодка, на улице пожилые",
    "[демо] Нужны мешки с песком",
    "[демо] Нужен насос откачать подвал",
  ],
  safe: [
    "[демо] Есть трактор, могу вывезти",
    "[демо] Сухое место, могу принять две семьи",
    "[демо] Раздаём мешки у школы",
  ],
};

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const jitter = (v, s) => v + (Math.random() - 0.5) * 2 * s;
const id = () =>
  (Date.now().toString(36) + Math.random().toString(36).slice(2, 10)).toUpperCase();

async function main() {
  for (const sql of SCHEMA) await client.execute(sql);

  if (process.argv.includes("--clear")) {
    await client.execute("DELETE FROM votes");
    await client.execute("DELETE FROM reports");
    await client.execute("DELETE FROM photos");
    console.log("🗑️  База очищена");
  }

  const now = Date.now();
  let added = 0;

  for (const area of AREAS) {
    // Чем выше риск района, тем больше сообщений оттуда приходит.
    const count = 2 + area.risk * 2 + Math.floor(Math.random() * 3);

    for (let i = 0; i < count; i++) {
      const roll = Math.random();
      let kind = "water";
      if (roll > 0.94) kind = "safe";
      else if (roll > 0.86) kind = "help";
      else if (roll > 0.68) kind = "road";

      // Глубина тянется к риску района, но не жёстко.
      const level =
        kind === "water"
          ? Math.max(1, Math.min(4, area.risk + Math.floor(Math.random() * 2)))
          : null;

      const ageH = Math.random() * 22;
      const createdAt = Math.round(now - ageH * 3600_000);
      const confirms = Math.floor(Math.random() * 5);
      const disputes = Math.random() > 0.85 ? Math.floor(Math.random() * 3) : 0;

      let status = "new";
      if (disputes >= 2 && disputes > confirms) status = "disputed";
      else if (confirms >= 2 && confirms > disputes) status = "confirmed";
      if (Math.random() > 0.9) status = "resolved";

      await client.execute({
        sql: `INSERT INTO reports
              (id, kind, level, lat, lng, address, comment, photo_id, device_id,
               confirms, disputes, status, created_at, updated_at)
              VALUES (?,?,?,?,?,?,?,NULL,?,?,?,?,?,?)`,
        args: [
          id(),
          kind,
          level,
          jitter(area.lat, area.spread),
          jitter(area.lng, area.spread),
          `${pick(STREETS)}, ${area.name}`,
          pick(COMMENTS[kind]),
          `seed-${Math.floor(Math.random() * 200)}`,
          confirms,
          disputes,
          status,
          createdAt,
          createdAt,
        ],
      });
      added++;
    }
  }

  const total = await client.execute("SELECT COUNT(*) AS n FROM reports");
  console.log(`✅ Добавлено ${added} демо-сообщений. Всего в базе: ${total.rows[0].n}`);
  console.log("⚠️  Это выдуманные данные для показа. Перед боевым запуском: node scripts/seed.mjs --clear");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
