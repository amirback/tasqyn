import { URALSK } from "./geo";
import type {
  HydroDay,
  HydroSnapshot,
  HydroTrend,
  Outlook,
  UpstreamPoint,
} from "./types";

/**
 * Официальный слой данных.
 *
 * Расход воды в Жайыке — из GloFAS, системы паводкового мониторинга
 * Copernicus, через открытый Open-Meteo Flood API. Погода — оттуда же.
 * Оба источника открыты, работают без ключа и обновляются ежедневно.
 *
 * Важно понимать границу: GloFAS — это глобальная модель. Она даёт расход
 * воды в реке, а не уровень у конкретного дома, и её прогноз — расчёт,
 * а не официальное предупреждение ДЧС. Мы показываем её числа как есть
 * и нигде не выдаём за официальные.
 */

const FLOOD_API = "https://flood-api.open-meteo.com/v1/flood";
const WEATHER_API = "https://api.open-meteo.com/v1/forecast";

/**
 * Точки на русле Жайыка выше Уральска.
 *
 * Координаты подобраны так, чтобы попадать в ячейки сетки GloFAS, которые
 * действительно лежат на реке: расход в них растёт вниз по течению
 * (Оренбург → Илек → Рубёжка → Уральск), как и должно быть.
 */
const UPSTREAM: { key: string; lat: number; lng: number; distanceKm: number }[] =
  [
    { key: "orenburg", lat: 51.725, lng: 54.875, distanceKm: 350 },
    { key: "ilek", lat: 51.475, lng: 53.125, distanceKm: 200 },
    { key: "rubezhka", lat: 51.375, lng: 52.325, distanceKm: 110 },
  ];

let cache: { at: number; data: HydroSnapshot } | null = null;
const TTL = 30 * 60 * 1000; // GloFAS обновляется раз в сутки, чаще ходить незачем

function trendOf(values: (number | null)[]): HydroTrend {
  const clean = values.filter((v): v is number => Number.isFinite(v as number));
  if (clean.length < 4) return "stable";
  const half = Math.floor(clean.length / 2);
  const avg = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  const older = avg(clean.slice(0, half));
  const newer = avg(clean.slice(half));
  const delta = (newer - older) / Math.max(older, 0.001);
  if (delta > 0.05) return "rising";
  if (delta < -0.05) return "falling";
  return "stable";
}

function pct(now: number | null, base: number | null): number | null {
  if (now == null || base == null || base <= 0) return null;
  return Math.round(((now - base) / base) * 100);
}

interface FloodSeries {
  time: string[];
  discharge: (number | null)[];
  mean: (number | null)[];
}

async function fetchFlood(
  lat: number,
  lng: number,
): Promise<FloodSeries | null> {
  try {
    const res = await fetch(
      `${FLOOD_API}?latitude=${lat}&longitude=${lng}` +
        `&daily=river_discharge,river_discharge_mean&past_days=14&forecast_days=14`,
      { signal: AbortSignal.timeout(12000) },
    );
    if (!res.ok) return null;
    const j = await res.json();
    if (!j?.daily?.time) return null;
    return {
      time: j.daily.time,
      discharge: j.daily.river_discharge ?? [],
      mean: j.daily.river_discharge_mean ?? [],
    };
  } catch {
    return null;
  }
}

/** Индекс сегодняшнего дня в ряду; если ряд начинается позже — первый день. */
function todayIndex(time: string[]): number {
  const today = new Date().toISOString().slice(0, 10);
  const i = time.findIndex((d) => d >= today);
  return i < 0 ? Math.max(0, time.length - 1) : i;
}

function upstreamFrom(
  key: string,
  distanceKm: number,
  series: FloodSeries | null,
): UpstreamPoint {
  if (!series) {
    return {
      key,
      distanceKm,
      discharge: null,
      normal: null,
      anomalyPct: null,
      trend: "stable",
    };
  }
  const i = todayIndex(series.time);
  const discharge = series.discharge[i] ?? null;
  const normal = series.mean[i] ?? null;
  return {
    key,
    distanceKm,
    discharge,
    normal,
    anomalyPct: pct(discharge, normal),
    // Тренд считаем по прошлой неделе — это уже случившийся факт, не прогноз.
    trend: trendOf(series.discharge.slice(Math.max(0, i - 7), i + 1)),
  };
}

export async function getHydro(): Promise<HydroSnapshot> {
  if (cache && Date.now() - cache.at < TTL) return cache.data;

  const weatherUrl =
    `${WEATHER_API}?latitude=${URALSK.lat}&longitude=${URALSK.lng}` +
    `&daily=precipitation_sum,rain_sum,snowfall_sum,temperature_2m_max,` +
    `temperature_2m_min&past_days=14&forecast_days=14&timezone=auto`;

  const [localRes, weatherRes, ...upstreamRes] = await Promise.all([
    fetchFlood(URALSK.lat, URALSK.lng),
    fetch(weatherUrl, { signal: AbortSignal.timeout(12000) })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
    ...UPSTREAM.map((p) => fetchFlood(p.lat, p.lng)),
  ]);

  const dates: string[] = localRes?.time ?? weatherRes?.daily?.time ?? [];
  const wDates: string[] = weatherRes?.daily?.time ?? [];
  const w = weatherRes?.daily ?? {};

  const days: HydroDay[] = dates.map((date, i) => {
    const wi = wDates.indexOf(date);
    return {
      date,
      discharge: localRes?.discharge[i] ?? null,
      dischargeMean: localRes?.mean[i] ?? null,
      precipitation: wi >= 0 ? (w.precipitation_sum?.[wi] ?? null) : null,
      tempMax: wi >= 0 ? (w.temperature_2m_max?.[wi] ?? null) : null,
    };
  });

  const i = dates.length ? todayIndex(dates) : 0;
  const current = days[i] ?? null;
  const now = current?.discharge ?? null;
  const normal = current?.dischargeMean ?? null;

  const sum = (arr: (number | null)[] | undefined, from: number, to: number) => {
    if (!arr) return null;
    const slice = arr.slice(from, to).filter((v): v is number => v != null);
    if (!slice.length) return null;
    return Math.round(slice.reduce((s, v) => s + v, 0) * 10) / 10;
  };

  const wi = wDates.length ? todayIndex(wDates) : 0;
  const precip3d = sum(w.precipitation_sum, wi, wi + 3);
  const precip7d = sum(w.precipitation_sum, wi, wi + 7);
  const snow7d = sum(w.snowfall_sum, wi, wi + 7);

  // Переход через ноль — то, что запускает снеготаяние в пойме весной.
  let thawDays = 0;
  for (let k = wi; k < Math.min(wi + 7, wDates.length); k++) {
    const tMax = w.temperature_2m_max?.[k];
    const tMin = w.temperature_2m_min?.[k];
    if (tMax != null && tMin != null && tMax > 0 && tMin <= 0) thawDays++;
  }

  // Пик прогноза — максимум расхода на ближайшие 14 дней.
  let peakDischarge: number | null = null;
  let peakDate: string | null = null;
  for (let k = i; k < days.length; k++) {
    const q = days[k].discharge;
    if (q != null && (peakDischarge == null || q > peakDischarge)) {
      peakDischarge = q;
      peakDate = days[k].date;
    }
  }

  const sources =
    (localRes ? 1 : 0) +
    (weatherRes ? 1 : 0) +
    upstreamRes.filter(Boolean).length;

  const outlook: Outlook | null = sources
    ? {
        peakDischarge,
        peakDate,
        peakChangePct: pct(peakDischarge, now),
        precip3d,
        precip7d,
        snow7d,
        thawDays,
        upstream: UPSTREAM.map((p, idx) =>
          upstreamFrom(p.key, p.distanceKm, upstreamRes[idx]),
        ),
        sources,
      }
    : null;

  const data: HydroSnapshot = {
    updatedAt: Date.now(),
    place: URALSK.name,
    discharge: now,
    normal,
    anomalyPct: pct(now, normal),
    trend: trendOf(days.slice(Math.max(0, i - 7), i + 1).map((d) => d.discharge)),
    precip3d,
    days,
    outlook,
  };

  cache = { at: Date.now(), data };
  return data;
}
