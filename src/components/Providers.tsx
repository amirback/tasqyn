"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { I18nProvider, useI18n } from "@/i18n";
import { watchConnection } from "@/lib/queue";
import { ServiceWorker } from "./ServiceWorker";

/** Плашка «нет сети / сообщения ушли». Обычно её не видно — и хорошо. */
function ConnectionBanner() {
  const { t, fmt, plural } = useI18n();
  const [offline, setOffline] = useState(false);
  const [flushed, setFlushed] = useState(0);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    setOffline(!navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);

    const stop = watchConnection((n) => {
      setFlushed(n);
      setTimeout(() => setFlushed(0), 6000);
    });

    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      stop();
    };
  }, []);

  const message = offline
    ? { key: "off", text: t.common.offline, tone: "bg-ink text-white" }
    : flushed > 0
      ? {
          key: "sent",
          text: `${fmt(t.map.reportsCount, { n: flushed, word: plural(flushed, t.map.reportsWord) })} · ${t.common.online}`,
          tone: "bg-safe text-white",
        }
      : null;

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          key={message.key}
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          className="fixed inset-x-0 top-0 z-[200] flex justify-center p-3"
        >
          <div
            className={`${message.tone} rounded-full px-5 py-2 text-sm font-semibold shadow-lg`}
          >
            {message.text}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <ServiceWorker />
      <ConnectionBanner />
      {children}
    </I18nProvider>
  );
}
