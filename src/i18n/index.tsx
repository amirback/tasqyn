"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ru, type Dict } from "./ru";
import { kk } from "./kk";
import { en } from "./en";

export type Locale = "ru" | "kk" | "en";
export const LOCALES: Locale[] = ["ru", "kk", "en"];

const DICTS: Record<Locale, Dict> = { ru, kk, en };
const STORAGE_KEY = "tasqyn.locale";

interface I18nValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  /** Типизированный словарь: t.landing.cta.title */
  t: Dict;
  /** Динамический ключ строкой: tp("risk.reason.rising") */
  tp: (path: string, vars?: Record<string, string | number>) => string;
  /** Подстановка {n} в готовую строку */
  fmt: (template: string, vars: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

function detect(): Locale {
  if (typeof window === "undefined") return "ru";
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved && LOCALES.includes(saved as Locale)) return saved as Locale;
  const nav = window.navigator.language.slice(0, 2).toLowerCase();
  if (nav === "kk") return "kk";
  if (nav === "en") return "en";
  return "ru";
}

export function fmt(
  template: string,
  vars: Record<string, string | number> = {},
): string {
  return template.replace(/\{(\w+)\}/g, (m, key) =>
    key in vars ? String(vars[key]) : m,
  );
}

export function I18nProvider({ children }: { children: ReactNode }) {
  // Первый рендер всегда ru, чтобы разметка сервера и клиента совпадала;
  // настоящий язык подставляем сразу после монтирования.
  const [locale, setLocaleState] = useState<Locale>("ru");

  useEffect(() => {
    const l = detect();
    setLocaleState(l);
    document.documentElement.lang = l;
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    document.documentElement.lang = l;
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* приватный режим — переживём */
    }
  }, []);

  const value = useMemo<I18nValue>(() => {
    const dict = DICTS[locale];
    return {
      locale,
      setLocale,
      t: dict,
      fmt,
      tp: (path, vars) => {
        const raw = path.split(".").reduce<unknown>((acc, key) => {
          if (acc && typeof acc === "object" && key in acc) {
            return (acc as Record<string, unknown>)[key];
          }
          return undefined;
        }, dict);
        if (typeof raw !== "string") return path;
        return vars ? fmt(raw, vars) : raw;
      },
    };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n вызван вне I18nProvider");
  return ctx;
}

/** Человекочитаемое «сколько прошло». */
export function useTimeAgo() {
  const { t, fmt: f } = useI18n();
  return useCallback(
    (ts: number) => {
      const diff = Math.max(0, Date.now() - ts);
      const min = Math.floor(diff / 60000);
      if (min < 1) return t.time.justNow;
      if (min < 60) return f(t.time.minAgo, { n: min });
      const h = Math.floor(min / 60);
      if (h < 24) return f(t.time.hourAgo, { n: h });
      return f(t.time.dayAgo, { n: Math.floor(h / 24) });
    },
    [t, f],
  );
}
