/** Типы предметной области Tasqyn. Общие для клиента и сервера. */

/** Что именно сообщает житель. */
export type ReportKind =
  | "water" // уровень воды
  | "road" // дорога затоплена / перекрыта
  | "help" // нужна помощь
  | "safe"; // пункт помощи, волонтёр, безопасное место

/**
 * Уровень воды. Мы намеренно не просим сантиметры — в панике никто не мерит.
 * Человек выбирает по телу, а мы переводим в приблизительную высоту.
 */
export type WaterLevel = 1 | 2 | 3 | 4;

export const WATER_LEVEL_CM: Record<WaterLevel, number> = {
  1: 15, // по щиколотку
  2: 50, // по колено
  3: 100, // по пояс
  4: 170, // выше роста
};

/** Статус достоверности — считается по голосам соседей. */
export type ReportStatus = "new" | "confirmed" | "disputed" | "resolved";

export interface Report {
  id: string;
  kind: ReportKind;
  level: WaterLevel | null;
  lat: number;
  lng: number;
  address: string | null;
  comment: string | null;
  photoId: string | null;
  confirms: number;
  disputes: number;
  status: ReportStatus;
  createdAt: number;
  updatedAt: number;
  /** true, если это сообщение отправлено с текущего устройства */
  mine?: boolean;
  /** голос текущего устройства: 1 подтвердил, -1 оспорил, 0 не голосовал */
  myVote?: number;
}

export interface Subscription {
  id: string;
  label: string;
  lat: number;
  lng: number;
  radiusM: number;
  createdAt: number;
}

/** Данные официальной гидрологии + погоды (Open-Meteo / GloFAS). */
export interface HydroDay {
  date: string;
  discharge: number | null;
  dischargeMean: number | null;
  precipitation: number | null;
  tempMax: number | null;
}

export type HydroTrend = "rising" | "falling" | "stable";
export type RiskLevel = "calm" | "watch" | "warning" | "danger";

export interface HydroSnapshot {
  updatedAt: number;
  place: string;
  /** текущий расход воды в реке, м³/с */
  discharge: number | null;
  /** норма для этого времени года, м³/с */
  normal: number | null;
  /** отклонение от нормы в процентах */
  anomalyPct: number | null;
  trend: HydroTrend;
  /** осадки за ближайшие 3 дня, мм */
  precip3d: number | null;
  days: HydroDay[];
  outlook: Outlook | null;
}

/**
 * Точка на Жайыке выше Уральска.
 *
 * Вода идёт к городу сверху, из Оренбургской области, поэтому подъём там —
 * это то, что в Уральске увидят через несколько дней. Именно так весной
 * 2024-го паводок и шёл: сначала верховья, потом ЗКО.
 */
export interface UpstreamPoint {
  key: string;
  /** примерно по руслу выше Уральска, км */
  distanceKm: number;
  discharge: number | null;
  normal: number | null;
  anomalyPct: number | null;
  trend: HydroTrend;
}

/** Что модели ожидают в ближайшие две недели. Не официальный прогноз. */
export interface Outlook {
  /** максимум расхода в прогнозе на 14 дней */
  peakDischarge: number | null;
  peakDate: string | null;
  /** насколько пик выше сегодняшнего значения, % */
  peakChangePct: number | null;
  precip3d: number | null;
  precip7d: number | null;
  /** свежий снег за 7 дней, см */
  snow7d: number | null;
  /** дней в ближайшую неделю, когда температура переходит через ноль */
  thawDays: number;
  upstream: UpstreamPoint[];
  /** сколько внешних источников ответило: 0 — показывать нечего */
  sources: number;
}

export interface RiskAssessment {
  level: RiskLevel;
  score: number; // 0..100
  reasons: string[]; // ключи i18n
}

export interface Stats {
  total: number;
  last24h: number;
  active: number;
  confirmed: number;
  helpNeeded: number;
  roadsBlocked: number;
  byLevel: Record<string, number>;
  updatedAt: number;
}

export const REPORT_KINDS: ReportKind[] = ["water", "road", "help", "safe"];

export const KIND_EMOJI: Record<ReportKind, string> = {
  water: "💧",
  road: "🚧",
  help: "🆘",
  safe: "🛟",
};

export const LEVEL_EMOJI: Record<WaterLevel, string> = {
  1: "🩴",
  2: "🦵",
  3: "🧍",
  4: "🌊",
};

/** Цвета маркеров: от спокойного голубого к тревожному тёмному. */
export const LEVEL_COLOR: Record<WaterLevel, string> = {
  1: "#7dd3fc",
  2: "#38bdf8",
  3: "#0284c7",
  4: "#0c4a6e",
};

export const KIND_COLOR: Record<ReportKind, string> = {
  water: "#0ea5e9",
  road: "#f59e0b",
  help: "#ef4444",
  safe: "#10b981",
};
