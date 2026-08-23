"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchReports, type ReportsResponse } from "@/lib/api";
import type { ReportKind } from "@/lib/types";

export type Period = "6h" | "24h" | "7d" | "all";

interface Options {
  period?: Period;
  kinds?: ReportKind[];
  /** Интервал автообновления, мс. 0 — не обновлять. */
  pollMs?: number;
}

/**
 * Живые данные карты.
 *
 * Опрашиваем сервер по таймеру и — обязательно — при возвращении вкладки:
 * человек, открывший карту утром, должен увидеть ночную обстановку сразу,
 * а не через минуту. Пока вкладка скрыта, опрос останавливаем.
 */
export function useLive({ period = "24h", kinds, pollMs = 30000 }: Options = {}) {
  const [data, setData] = useState<ReportsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const kindsKey = kinds?.join(",") ?? "";
  const inflight = useRef(false);

  const load = useCallback(async () => {
    if (inflight.current) return;
    inflight.current = true;
    try {
      const res = await fetchReports({
        period,
        kinds: kindsKey ? (kindsKey.split(",") as ReportKind[]) : undefined,
      });
      setData(res);
      setError(null);
    } catch (e) {
      setError((e as Error).message || "generic");
    } finally {
      inflight.current = false;
      setLoading(false);
    }
  }, [period, kindsKey]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => {
    if (!pollMs) return;
    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer) return;
      timer = setInterval(() => void load(), pollMs);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void load();
        start();
      } else {
        stop();
      }
    };

    onVisible();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load, pollMs]);

  return { data, loading, error, reload: load };
}
