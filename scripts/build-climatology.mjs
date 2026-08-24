/**
 * Строит климатическую норму расхода Жайыка по 20 годам наблюдений GloFAS.
 *
 *   node scripts/build-climatology.mjs
 *
 * Зачем. У Open-Meteo есть поле river_discharge_mean, и его легко принять за
 * сезонную норму. Но для прошедших дат оно равно самому расходу — сравнение
 * давало ровно 0% всегда. Настоящую норму надо считать самим: берём один и
 * тот же календарный день за много лет и смотрим распределение.
 *
 * Результат — src/data/climatology.json: на каждый день года медиана и
 * перцентили. Файл лежит в репозитории, поэтому на боевом сервере никаких
 * долгих запросов к истории не происходит.
 */
import fs from "node:fs";
import path from "node:path";

const POINTS = [
  { key: "uralsk", lat: 51.2333, lng: 51.3667 },
  { key: "rubezhka", lat: 51.375, lng: 52.325 },
  { key: "ilek", lat: 51.475, lng: 53.125 },
  { key: "orenburg", lat: 51.725, lng: 54.875 },
];

const FROM = "2004-01-01";
const TO = "2023-12-31";
/** Окно сглаживания: день ± 5 суток, иначе кривая шумит. */
const WINDOW = 5;

const quantile = (sorted, q) => {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return lo === hi
    ? sorted[lo]
    : sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
};

const round = (v) => (v == null ? null : Math.round(v * 10) / 10);

async function fetchSeries(p) {
  const url =
    `https://flood-api.open-meteo.com/v1/flood?latitude=${p.lat}&longitude=${p.lng}` +
    `&daily=river_discharge&start_date=${FROM}&end_date=${TO}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!res.ok) throw new Error(`${p.key}: HTTP ${res.status}`);
  const j = await res.json();
  if (!j?.daily?.time) throw new Error(`${p.key}: пустой ответ`);
  return j.daily;
}

/** Номер дня в году без учёта високосного сдвига: ключ вида "04-12". */
const dayKey = (iso) => iso.slice(5);

async function main() {
  const out = { builtAt: new Date().toISOString(), from: FROM, to: TO, points: {} };

  for (const p of POINTS) {
    process.stdout.write(`${p.key}… `);
    const daily = await fetchSeries(p);

    // Собираем значения по календарному дню
    const byDay = new Map();
    for (let i = 0; i < daily.time.length; i++) {
      const v = daily.river_discharge[i];
      if (!Number.isFinite(v)) continue;
      const k = dayKey(daily.time[i]);
      if (!byDay.has(k)) byDay.set(k, []);
      byDay.get(k).push(v);
    }

    const keys = [...byDay.keys()].sort();
    const idx = new Map(keys.map((k, i) => [k, i]));
    const days = {};

    for (const k of keys) {
      // Скользящее окно по календарю
      const pool = [];
      for (let d = -WINDOW; d <= WINDOW; d++) {
        const j = (idx.get(k) + d + keys.length) % keys.length;
        pool.push(...byDay.get(keys[j]));
      }
      pool.sort((a, b) => a - b);
      days[k] = {
        p50: round(quantile(pool, 0.5)),
        p75: round(quantile(pool, 0.75)),
        p90: round(quantile(pool, 0.9)),
        p95: round(quantile(pool, 0.95)),
        max: round(pool[pool.length - 1]),
        n: pool.length,
      };
    }

    // Распределение годовых максимумов: именно оно говорит, какой расход
    // для этой реки вообще означает большую воду. Перцентиль внутри дня
    // на это не отвечает — в августе 4 нормы это всё ещё меженный ручей.
    const yearMax = {};
    for (let i = 0; i < daily.time.length; i++) {
      const v = daily.river_discharge[i];
      if (!Number.isFinite(v)) continue;
      const y = daily.time[i].slice(0, 4);
      if (!yearMax[y] || v > yearMax[y]) yearMax[y] = v;
    }
    const peaks = Object.values(yearMax).sort((a, b) => a - b);

    out.points[p.key] = {
      lat: p.lat,
      lng: p.lng,
      days,
      annualPeak: {
        p25: round(quantile(peaks, 0.25)),
        p50: round(quantile(peaks, 0.5)),
        p75: round(quantile(peaks, 0.75)),
        p90: round(quantile(peaks, 0.9)),
        years: peaks.length,
      },
    };
    console.log(`${keys.length} дней, ${byDay.get(keys[0]).length} лет`);
    await new Promise((r) => setTimeout(r, 1200));
  }

  const file = path.join(process.cwd(), "src", "data", "climatology.json");
  fs.writeFileSync(file, JSON.stringify(out));
  const kb = Math.round(fs.statSync(file).size / 1024);
  console.log(`\n✅ ${file} (${kb} КБ)`);

  console.log("\nГодовые пики Жайыка у Уральска за 20 лет:");
  const ap = out.points.uralsk.annualPeak;
  console.log(`  четверть лет ниже ${ap.p25} · половина ниже ${ap.p50} · четверть выше ${ap.p75} · самые большие ${ap.p90}+ м³/с`);

  const u = out.points.uralsk.days;
  console.log("\nПроверка по Уральску (медиана / p90 / p95 / максимум за 20 лет):");
  for (const d of ["03-20", "04-01", "04-12", "04-20", "05-10", "08-24"]) {
    const x = u[d];
    console.log(`  ${d}  ${String(x.p50).padStart(7)} / ${String(x.p90).padStart(7)} / ${String(x.p95).padStart(7)} / ${String(x.max).padStart(7)}`);
  }
}

main().catch((e) => {
  console.error("ОШИБКА:", e.message);
  process.exit(1);
});
