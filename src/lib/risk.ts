import type { HydroSnapshot, Report, RiskAssessment, RiskLevel } from "./types";

/**
 * Общий уровень тревоги по городу.
 *
 * Считаем прозрачно и показываем пользователю все слагаемые: он должен видеть,
 * ПОЧЕМУ ему говорят «опасно». Непрозрачный «AI-скор» в теме, где речь идёт
 * об эвакуации, доверия не заслуживает.
 */

const WEIGHTS = {
  anomaly: 30, // насколько река выше своей нормы
  trend: 10, // растёт ли расход воды
  precip: 15, // осадки в ближайшие 3 дня
  reports: 25, // сколько людей сообщает о воде
  severity: 20, // насколько глубоко по их словам
};

export function assessRisk(
  hydro: HydroSnapshot | null,
  reports: Report[],
): RiskAssessment {
  const reasons: string[] = [];
  let score = 0;

  if (hydro?.anomalyPct != null) {
    const a = hydro.anomalyPct;
    if (a >= 200) {
      score += WEIGHTS.anomaly;
      reasons.push("risk.reason.anomalyHigh");
    } else if (a >= 60) {
      score += WEIGHTS.anomaly * 0.6;
      reasons.push("risk.reason.anomalyMid");
    } else if (a >= 20) {
      score += WEIGHTS.anomaly * 0.3;
      reasons.push("risk.reason.anomalyLow");
    }
  }

  if (hydro?.trend === "rising") {
    score += WEIGHTS.trend;
    reasons.push("risk.reason.rising");
  }

  if (hydro?.precip3d != null) {
    if (hydro.precip3d >= 25) {
      score += WEIGHTS.precip;
      reasons.push("risk.reason.rainHigh");
    } else if (hydro.precip3d >= 8) {
      score += WEIGHTS.precip * 0.5;
      reasons.push("risk.reason.rainMid");
    }
  }

  const day = Date.now() - 24 * 60 * 60 * 1000;
  const fresh = reports.filter(
    (r) => r.createdAt >= day && r.status !== "disputed" && r.status !== "resolved",
  );
  const water = fresh.filter((r) => r.kind === "water");
  const roads = fresh.filter((r) => r.kind === "road");
  const help = fresh.filter((r) => r.kind === "help");

  const activity = water.length + roads.length * 1.5 + help.length * 3;
  if (activity >= 30) {
    score += WEIGHTS.reports;
    reasons.push("risk.reason.manyReports");
  } else if (activity >= 10) {
    score += WEIGHTS.reports * 0.6;
    reasons.push("risk.reason.someReports");
  } else if (activity >= 3) {
    score += WEIGHTS.reports * 0.25;
    reasons.push("risk.reason.fewReports");
  }

  const deep = water.filter((r) => (r.level ?? 0) >= 3).length;
  if (deep >= 5) {
    score += WEIGHTS.severity;
    reasons.push("risk.reason.deepWater");
  } else if (deep >= 1) {
    score += WEIGHTS.severity * 0.5;
    reasons.push("risk.reason.someDeepWater");
  }

  if (help.length > 0) reasons.push("risk.reason.helpNeeded");

  score = Math.round(Math.min(100, score));

  let level: RiskLevel = "calm";
  if (score >= 70) level = "danger";
  else if (score >= 40) level = "warning";
  else if (score >= 18) level = "watch";

  if (reasons.length === 0) reasons.push("risk.reason.quiet");

  return { level, score, reasons };
}

export const RISK_COLOR: Record<RiskLevel, string> = {
  calm: "#10b981",
  watch: "#0ea5e9",
  warning: "#f59e0b",
  danger: "#ef4444",
};
