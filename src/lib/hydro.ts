import { URALSK } from "./geo";
import type { HydroDay, HydroSnapshot, HydroTrend } from "./types";

/**
 * Официальный слой данных.
 *
 * Расход воды в Жайыке берём из GloFAS (система паводкового мониторинга
 * Copernicus) через Open-Meteo Flood API, осадки — из Open-Meteo Forecast.
 * Оба открыты, работают без ключа и не требуют договора — на MVP этого хватает,
 * а на фазе 2 сюда же подставляется гидропост Казгидромета.
 */

const FLOOD_API = "https://flood-api.open-meteo.com/v1/flood";
const WEATHER_API = "https://api.open-meteo.com/v1/forecast";

let cache: { at: number; data: HydroSnapshot } | null = null;
const TTL = 30 * 60 * 1000; // данные обновляются раз в сутки, чаще ходить незачем

function trendOf(values: number[]): HydroTrend {
  const clean = values.filter((v) => Number.isFinite(v));
  if (clean.length < 4) return "stable";
  const half = Math.floor(clean.length / 2);
  const older = clean.slice(0, half);
  const newer = clean.slice(half);
  const avg = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  const delta = (avg(newer) - avg(older)) / Math.max(avg(older), 0.001);
  if (delta > 0.05) return "rising";
  if (delta < -0.05) return "falling";
  return "stable";
}

export async function getHydro(
  lat = URALSK.lat,
  lng = URALSK.lng,
): Promise<HydroSnapshot> {
  if (cache && Date.now() - cache.at < TTL) return cache.data;

  const floodUrl =
    `${FLOOD_API}?latitude=${lat}&longitude=${lng}` +
    `&daily=river_discharge,river_discharge_mean&past_days=14&forecast_days=14`;
  const weatherUrl =
    `${WEATHER_API}?latitude=${lat}&longitude=${lng}` +
    `&daily=precipitation_sum,temperature_2m_max&past_days=14&forecast_days=14&timezone=auto`;

  const [floodRes, weatherRes] = await Promise.allSettled([
    fetch(floodUrl, { signal: AbortSignal.timeout(12000) }).then((r) => r.json()),
    fetch(weatherUrl, { signal: AbortSignal.timeout(12000) }).then((r) => r.json()),
  ]);

  const flood = floodRes.status === "fulfilled" ? floodRes.value : null;
  const weather = weatherRes.status === "fulfilled" ? weatherRes.value : null;

  const dates: string[] = flood?.daily?.time ?? weather?.daily?.time ?? [];
  const discharge: (number | null)[] = flood?.daily?.river_discharge ?? [];
  const dischargeMean: (number | null)[] =
    flood?.daily?.river_discharge_mean ?? [];
  const wDates: string[] = weather?.daily?.time ?? [];
  const precip: (number | null)[] = weather?.daily?.precipitation_sum ?? [];
  const temp: (number | null)[] = weather?.daily?.temperature_2m_max ?? [];

  const days: HydroDay[] = dates.map((date, i) => {
    const wi = wDates.indexOf(date);
    return {
      date,
      discharge: discharge[i] ?? null,
      dischargeMean: dischargeMean[i] ?? null,
      precipitation: wi >= 0 ? (precip[wi] ?? null) : null,
      tempMax: wi >= 0 ? (temp[wi] ?? null) : null,
    };
  });

  const today = new Date().toISOString().slice(0, 10);
  const todayIdx = Math.max(
    0,
    days.findIndex((d) => d.date >= today),
  );
  const current = days[todayIdx] ?? days[days.length - 1] ?? null;
  const normal = current?.dischargeMean ?? null;
  const now = current?.discharge ?? null;

  const past = days
    .slice(Math.max(0, todayIdx - 7), todayIdx + 1)
    .map((d) => d.discharge ?? NaN);

  const precip3d = days
    .slice(todayIdx, todayIdx + 3)
    .reduce<number | null>(
      (sum, d) => (d.precipitation == null ? sum : (sum ?? 0) + d.precipitation),
      null,
    );

  const data: HydroSnapshot = {
    updatedAt: Date.now(),
    place: URALSK.name,
    discharge: now,
    normal,
    anomalyPct:
      now != null && normal != null && normal > 0
        ? Math.round(((now - normal) / normal) * 100)
        : null,
    trend: trendOf(past),
    precip3d: precip3d == null ? null : Math.round(precip3d * 10) / 10,
    days,
  };

  cache = { at: Date.now(), data };
  return data;
}
