"use client";

import { submitReport, type NewReport } from "./api";

/**
 * Очередь сообщений на время без сети.
 *
 * Это не украшение: связь в подтопленных районах деградирует ровно тогда,
 * когда сообщение нужнее всего. Мы кладём его в localStorage и досылаем,
 * как только браузер сообщит, что сеть вернулась.
 */

const KEY = "tasqyn.queue";

interface Queued extends NewReport {
  queuedAt: number;
}

function read(): Queued[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Queued[]) : [];
  } catch {
    return [];
  }
}

function write(items: Queued[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* переполнение хранилища — молча пропускаем */
  }
}

export function enqueue(report: NewReport) {
  const items = read();
  items.push({ ...report, queuedAt: Date.now() });
  write(items);
}

export function queueSize(): number {
  return read().length;
}

let flushing = false;

/** Пытается отправить всё, что накопилось. Возвращает число доставленных. */
export async function flushQueue(): Promise<number> {
  if (flushing || typeof navigator === "undefined" || !navigator.onLine) return 0;
  const items = read();
  if (!items.length) return 0;

  flushing = true;
  const left: Queued[] = [];
  let sent = 0;

  for (const item of items) {
    // Сутки пролежало — обстановка изменилась, слать поздно.
    if (Date.now() - item.queuedAt > 24 * 60 * 60 * 1000) continue;
    try {
      const { queuedAt: _queuedAt, ...payload } = item;
      void _queuedAt;
      await submitReport(payload);
      sent++;
    } catch (e) {
      const code = (e as { code?: string }).code;
      // Сервер отверг по существу — повторять бессмысленно, выбрасываем.
      if (code && code !== "generic" && code !== "rate_limited") continue;
      left.push(item);
    }
  }

  write(left);
  flushing = false;
  return sent;
}

/** Вешает автодосыл на возвращение сети. Возвращает функцию отписки. */
export function watchConnection(onFlushed: (n: number) => void): () => void {
  const handler = () => {
    void flushQueue().then((n) => {
      if (n > 0) onFlushed(n);
    });
  };
  window.addEventListener("online", handler);
  handler();
  return () => window.removeEventListener("online", handler);
}
