import raw from "@/data/climatology.json";

/**
 * Климатическая норма расхода Жайыка.
 *
 * Считается скриптом scripts/build-climatology.mjs по 20 годам архива GloFAS
 * (2004–2023) и лежит в репозитории готовым файлом — на сервере никаких
 * обращений к истории не происходит.
 *
 * Зачем вообще. В ответе Open-Meteo есть поле river_discharge_mean, которое
 * легко принять за сезонную норму. Для прошедших дат оно равно самому расходу,
 * поэтому «отклонение от нормы» на нём всегда выходило ровно 0% — цифра
 * выглядела осмысленной, но не значила ничего. Настоящую норму приходится
 * считать самим: один и тот же календарный день за много лет.
 */

export interface DayStats {
  p50: number | null;
  p75: number | null;
  p90: number | null;
  p95: number | null;
  max: number | null;
  n: number;
}

export interface AnnualPeak {
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p90: number | null;
  years: number;
}

interface Climatology {
  builtAt: string;
  from: string;
  to: string;
  points: Record<
    string,
    {
      lat: number;
      lng: number;
      days: Record<string, DayStats>;
      annualPeak: AnnualPeak;
    }
  >;
}

const data = raw as Climatology;

/** Период, по которому построена норма — показываем его пользователю. */
export const REFERENCE_PERIOD = {
  from: data.from.slice(0, 4),
  to: data.to.slice(0, 4),
};

/**
 * Полоса, в которую попадает текущий расход.
 * `record` — выше всего, что модель показывала за 20 лет на эту дату;
 * именно там был Уральск 12 апреля 2024 года.
 */
export type FlowBand =
  | "low"
  | "normal"
  | "high"
  | "veryHigh"
  | "extreme"
  | "record"
  | "unknown";

export function statsFor(point: string, isoDate: string): DayStats | null {
  return data.points[point]?.days[isoDate.slice(5)] ?? null;
}

export function bandOf(value: number | null, s: DayStats | null): FlowBand {
  if (value == null || !s || s.p50 == null) return "unknown";
  if (s.max != null && value > s.max) return "record";
  if (s.p95 != null && value > s.p95) return "extreme";
  if (s.p90 != null && value > s.p90) return "veryHigh";
  if (s.p75 != null && value > s.p75) return "high";
  if (value > s.p50) return "normal";
  return "low";
}

/**
 * Грубый перцентиль по опорным точкам — ровно та точность, которую честно
 * даёт выборка из 20 лет. Выше архивного максимума отдаём 100.
 */
export function percentileOf(value: number | null, s: DayStats | null): number | null {
  if (value == null || !s || s.p50 == null) return null;
  const pts: [number, number][] = [[0, 0], [s.p50, 50]];
  if (s.p75 != null) pts.push([s.p75, 75]);
  if (s.p90 != null) pts.push([s.p90, 90]);
  if (s.p95 != null) pts.push([s.p95, 95]);
  if (s.max != null) pts.push([s.max, 100]);

  if (value >= pts[pts.length - 1][0]) return 100;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    if (value <= x1) {
      const k = x1 === x0 ? 0 : (value - x0) / (x1 - x0);
      return Math.round(y0 + (y1 - y0) * k);
    }
  }
  return 100;
}

/**
 * Насколько текущий расход велик по меркам самой реки.
 *
 * Перцентиль внутри календарного дня на этот вопрос не отвечает: в августе
 * четыре нормы — это всё ещё межень, а в апреле столько же может означать
 * беду. Поэтому сравниваем с распределением ГОДОВЫХ пиков за 20 лет.
 *
 * Ориентир по Уральску: половина лет пикует ниже ~840 м³/с, четверть выше
 * ~2250, самые большие годы дают 3150+. Катастрофический апрель 2024-го
 * прошёл на 3235 м³/с — это полоса `severe`.
 */
export type PeakBand = "base" | "low" | "typical" | "high" | "severe" | "unknown";

export function annualPeakOf(point: string): AnnualPeak | null {
  return data.points[point]?.annualPeak ?? null;
}

export function peakBandOf(discharge: number | null, point: string): PeakBand {
  const a = annualPeakOf(point);
  if (discharge == null || !a || a.p50 == null) return "unknown";
  if (a.p90 != null && discharge >= a.p90) return "severe";
  if (a.p75 != null && discharge >= a.p75) return "high";
  if (discharge >= a.p50) return "typical";
  if (a.p25 != null && discharge >= a.p25) return "low";
  return "base";
}
