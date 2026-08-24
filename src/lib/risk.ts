import { peakBandOf, type PeakBand } from "./climatology";
import type { HydroSnapshot, Report, RiskAssessment, RiskLevel } from "./types";

/**
 * Уровень тревоги по городу.
 *
 * Считаем прозрачно и показываем пользователю все слагаемые: он должен видеть,
 * ПОЧЕМУ ему говорят «опасно». Непрозрачный скор в теме, где по экрану решают,
 * уезжать или нет, доверия не заслуживает.
 *
 * Пороги по реке взяты не с потолка, а из 20 лет архива GloFAS
 * (см. scripts/build-climatology.mjs). Ключевой урок этих данных: относительное
 * отклонение обманывает. В августе расход вчетверо выше медианы того же дня —
 * и это по-прежнему межень. Поэтому опасность меряется по распределению
 * ГОДОВЫХ пиков реки: `typical` — обычный весенний максимум, `high` — выше
 * трёх четвертей лет, `severe` — уровень самых больших паводков, включая
 * апрель 2024 года, когда Уральск затопило.
 *
 * И главное ограничение, которое стоит держать в голове: расход в реке
 * описывает реку, а не улицы. Сообщения жителей весят здесь не меньше модели.
 */

const RIVER_NOW: Record<PeakBand, number> = {
  unknown: 0,
  base: 0,
  low: 4,
  typical: 12,
  high: 24,
  severe: 34,
};

const RIVER_FORECAST: Record<PeakBand, number> = {
  unknown: 0,
  base: 0,
  low: 2,
  typical: 8,
  high: 18,
  severe: 26,
};

const REASON_BY_BAND: Partial<Record<PeakBand, string>> = {
  low: "risk.reason.riverLow",
  typical: "risk.reason.riverTypical",
  high: "risk.reason.riverHigh",
  severe: "risk.reason.riverSevere",
};

export function assessRisk(
  hydro: HydroSnapshot | null,
  reports: Report[],
): RiskAssessment {
  const reasons: string[] = [];
  let score = 0;

  /* ── Река сейчас ─────────────────────────────────────── */
  const nowBand = peakBandOf(hydro?.discharge ?? null, "uralsk");
  score += RIVER_NOW[nowBand];
  const nowReason = REASON_BY_BAND[nowBand];
  if (nowReason && nowBand !== "low") reasons.push(nowReason);

  /* ── Река по прогнозу на две недели ──────────────────── */
  const peak = hydro?.outlook?.peakDischarge ?? null;
  const peakBand = peakBandOf(peak, "uralsk");
  // Прогноз добавляет вес, только если он хуже сегодняшнего дня.
  if (RIVER_FORECAST[peakBand] > RIVER_FORECAST[nowBand]) {
    score += RIVER_FORECAST[peakBand] - RIVER_FORECAST[nowBand];
    reasons.push("risk.reason.forecastRise");
  }

  /* ── Что идёт сверху ─────────────────────────────────── */
  const upstream = hydro?.outlook?.upstream ?? [];
  const upstreamAlarm = upstream.some(
    (u) =>
      u.trend === "rising" &&
      (peakBandOf(u.discharge, u.key) === "high" ||
        peakBandOf(u.discharge, u.key) === "severe"),
  );
  if (upstreamAlarm) {
    score += 12;
    reasons.push("risk.reason.upstreamRising");
  }

  /* ── Погода ──────────────────────────────────────────── */
  const precip = hydro?.outlook?.precip3d ?? null;
  if (precip != null && precip >= 25) {
    score += 10;
    reasons.push("risk.reason.rainHigh");
  } else if (precip != null && precip >= 8) {
    score += 5;
    reasons.push("risk.reason.rainMid");
  }

  const thaw = hydro?.outlook?.thawDays ?? 0;
  if (thaw >= 3) {
    score += 8;
    reasons.push("risk.reason.thaw");
  }

  /* ── Сообщения жителей: данные с земли ───────────────── */
  const day = Date.now() - 24 * 60 * 60 * 1000;
  const fresh = reports.filter(
    (r) =>
      r.createdAt >= day && r.status !== "disputed" && r.status !== "resolved",
  );
  const water = fresh.filter((r) => r.kind === "water");
  const roads = fresh.filter((r) => r.kind === "road");
  const help = fresh.filter((r) => r.kind === "help");

  const activity = water.length + roads.length * 1.5 + help.length * 3;
  if (activity >= 30) {
    score += 25;
    reasons.push("risk.reason.manyReports");
  } else if (activity >= 10) {
    score += 15;
    reasons.push("risk.reason.someReports");
  } else if (activity >= 3) {
    score += 6;
    reasons.push("risk.reason.fewReports");
  }

  const deep = water.filter((r) => (r.level ?? 0) >= 3).length;
  if (deep >= 5) {
    score += 20;
    reasons.push("risk.reason.deepWater");
  } else if (deep >= 1) {
    score += 10;
    reasons.push("risk.reason.someDeepWater");
  }

  if (help.length > 0) reasons.push("risk.reason.helpNeeded");

  score = Math.round(Math.min(100, score));

  let level: RiskLevel = "calm";
  if (score >= 70) level = "danger";
  else if (score >= 40) level = "warning";
  else if (score >= 18) level = "watch";

  /*
   * Пока в городе висит неотвеченная просьба о помощи, слово «Спокойно» на
   * экране неуместно, каким бы низким ни вышел балл. Один SOS — ещё не
   * городская катастрофа, поэтому поднимаем ровно до «Наблюдения».
   */
  if (help.length > 0 && level === "calm") level = "watch";

  if (reasons.length === 0) reasons.push("risk.reason.quiet");

  return { level, score, reasons };
}

export const RISK_COLOR: Record<RiskLevel, string> = {
  calm: "#10b981",
  watch: "#0ea5e9",
  warning: "#f59e0b",
  danger: "#ef4444",
};
