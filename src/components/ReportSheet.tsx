"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { useI18n, useTimeAgo } from "@/i18n";
import {
  deleteReport as apiDelete,
  resolveReport as apiResolve,
  voteReport as apiVote,
} from "@/lib/api";
import { distanceM, formatDistance } from "@/lib/geo";
import {
  KIND_EMOJI,
  LEVEL_COLOR,
  LEVEL_EMOJI,
  WATER_LEVEL_CM,
  type Report,
} from "@/lib/types";

const STATUS_STYLE: Record<Report["status"], string> = {
  new: "bg-water-50 text-water-700",
  confirmed: "bg-emerald-50 text-emerald-700",
  disputed: "bg-amber-50 text-amber-700",
  resolved: "bg-slate-100 text-slate-500",
};

const STATUS_EMOJI: Record<Report["status"], string> = {
  new: "❓",
  confirmed: "✅",
  disputed: "⚠️",
  resolved: "🏁",
};

interface Props {
  report: Report | null;
  onClose: () => void;
  onChanged: (report: Report | null) => void;
  userPosition?: { lat: number; lng: number } | null;
}

/** Карточка сообщения. На телефоне — шторка снизу, на десктопе — панель сбоку. */
export function ReportSheet({ report, onClose, onChanged, userPosition }: Props) {
  const { t, locale, fmt } = useI18n();
  const ago = useTimeAgo();
  const [busy, setBusy] = useState(false);

  const vote = async (value: 1 | -1) => {
    if (!report || busy) return;
    setBusy(true);
    try {
      const { report: updated } = await apiVote(report.id, value);
      onChanged(updated);
    } catch {
      /* молча: голос — не критичное действие */
    } finally {
      setBusy(false);
    }
  };

  const resolve = async () => {
    if (!report || busy) return;
    setBusy(true);
    try {
      const { report: updated } = await apiResolve(report.id);
      onChanged(updated);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!report || busy) return;
    setBusy(true);
    try {
      await apiDelete(report.id);
      onChanged(null);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const dist =
    report && userPosition
      ? distanceM(userPosition.lat, userPosition.lng, report.lat, report.lng)
      : null;

  return (
    <AnimatePresence>
      {report && (
        <motion.aside
          key={report.id}
          initial={{ y: "100%", opacity: 0.6 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0.4 }}
          transition={{ type: "spring", stiffness: 320, damping: 34 }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.4 }}
          onDragEnd={(_, info) => {
            if (info.offset.y > 110) onClose();
          }}
          className="fixed inset-x-0 bottom-0 z-[120] max-h-[82dvh] overflow-y-auto rounded-t-[2rem] bg-white shadow-[0_-20px_60px_-20px_rgba(7,26,43,0.45)] md:inset-y-0 md:right-0 md:left-auto md:max-h-none md:w-[24rem] md:rounded-l-[2rem] md:rounded-tr-none"
        >
          <div className="sticky top-0 z-10 bg-white/95 px-5 pt-3 pb-3 backdrop-blur">
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-water-100 md:hidden" />
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-2xl"
                  style={{
                    background:
                      report.kind === "water" && report.level
                        ? `${LEVEL_COLOR[report.level]}22`
                        : "#f0f9ff",
                  }}
                >
                  <span aria-hidden>
                    {report.kind === "water" && report.level
                      ? LEVEL_EMOJI[report.level]
                      : KIND_EMOJI[report.kind]}
                  </span>
                </div>
                <div>
                  <h2 className="text-lg leading-tight font-extrabold tracking-[-0.02em]">
                    {report.kind === "water" && report.level
                      ? t.report.levels[`l${report.level}` as "l1"].title
                      : t.report.kinds[report.kind].title}
                  </h2>
                  <div className="text-xs font-semibold text-ink-soft">
                    {ago(report.createdAt)}
                    {dist != null && ` · ${fmt(t.detail.distance, {
                      d: formatDistance(dist, locale),
                    })}`}
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-water-50 text-ink-soft transition-colors hover:bg-water-100"
                aria-label={t.common.close}
              >
                ✕
              </button>
            </div>
          </div>

          <div className="space-y-4 px-5 pb-8">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLE[report.status]}`}
              >
                <span aria-hidden>{STATUS_EMOJI[report.status]}</span>
                {t.detail[report.status]}
              </span>
              {report.mine && (
                <span className="rounded-full bg-water-500 px-3 py-1 text-xs font-bold text-white">
                  👤 {t.detail.mine}
                </span>
              )}
              {report.kind === "water" && report.level && (
                <span className="rounded-full bg-ink px-3 py-1 text-xs font-bold text-white tabular-nums">
                  ≈ {WATER_LEVEL_CM[report.level]} см
                </span>
              )}
            </div>

            {report.address && (
              <div className="flex items-start gap-2 rounded-2xl bg-water-50 px-4 py-3">
                <span aria-hidden>📍</span>
                <span className="text-sm font-semibold">{report.address}</span>
              </div>
            )}

            {report.comment && (
              <p className="lead text-[0.95rem] whitespace-pre-line">
                {report.comment}
              </p>
            )}

            {report.photoId && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={`/api/photo/${report.photoId}`}
                alt={t.detail.photoAlt}
                loading="lazy"
                className="w-full rounded-2xl border border-water-100 object-cover"
              />
            )}

            {/* Проверка соседями */}
            <div className="rounded-3xl border border-water-100 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="kicker !text-[0.65rem]">
                  {t.landing.trust.kicker}
                </span>
                <span className="text-xs font-bold text-ink-soft tabular-nums">
                  {fmt(t.detail.votes, {
                    c: report.confirms,
                    d: report.disputes,
                  })}
                </span>
              </div>

              {report.mine ? (
                <p className="text-xs font-semibold text-ink-soft">
                  {t.detail.ownVote}
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => vote(1)}
                    disabled={busy}
                    className={`btn py-3 text-sm ${
                      report.myVote === 1
                        ? "bg-emerald-500 text-white"
                        : "btn-ghost"
                    }`}
                  >
                    👍 {t.detail.confirm}
                  </button>
                  <button
                    onClick={() => vote(-1)}
                    disabled={busy}
                    className={`btn py-3 text-sm ${
                      report.myVote === -1
                        ? "bg-amber-500 text-white"
                        : "btn-ghost"
                    }`}
                  >
                    🤔 {t.detail.dispute}
                  </button>
                </div>
              )}
            </div>

            {report.mine && report.status !== "resolved" && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={resolve}
                  disabled={busy}
                  className="btn btn-primary py-3 text-sm"
                >
                  🏁 {t.detail.markResolved}
                </button>
                <button
                  onClick={remove}
                  disabled={busy}
                  className="btn btn-ghost py-3 text-sm !text-alert"
                >
                  🗑️ {t.detail.remove}
                </button>
              </div>
            )}

            <a
              href={`https://www.openstreetmap.org/?mlat=${report.lat}&mlon=${report.lng}#map=17/${report.lat}/${report.lng}`}
              target="_blank"
              rel="noreferrer"
              className="block text-center text-xs font-semibold text-water-600 underline-offset-4 hover:underline"
            >
              {report.lat.toFixed(5)}, {report.lng.toFixed(5)} ↗
            </a>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
