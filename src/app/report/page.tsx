"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useI18n } from "@/i18n";
import { useLive } from "@/hooks/useLive";
import { useGeolocation } from "@/hooks/useGeolocation";
import { FloodMap } from "@/components/FloodMap";
import {
  IconArrowLeft,
  IconArrowRight,
  IconCamera,
  IconCheck,
  IconEdit,
  IconPin,
  IconTarget,
} from "@/components/icons";
import { MobileTabs, Nav } from "@/components/Nav";
import { submitReport } from "@/lib/api";
import { compressImage } from "@/lib/image";
import { enqueue } from "@/lib/queue";
import { insidePilot, reverseGeocode, URALSK } from "@/lib/geo";
import {
  KIND_EMOJI,
  LEVEL_COLOR,
  LEVEL_EMOJI,
  REPORT_KINDS,
  type ReportKind,
  type WaterLevel,
} from "@/lib/types";

type Step = "kind" | "level" | "place" | "details" | "done";

export default function ReportPage() {
  const { t, fmt, locale } = useI18n();
  const router = useRouter();

  const [step, setStep] = useState<Step>("kind");
  const [kind, setKind] = useState<ReportKind | null>(null);
  const [level, setLevel] = useState<WaterLevel | null>(null);
  const [point, setPoint] = useState({ lat: URALSK.lat, lng: URALSK.lng });
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>();
  const [address, setAddress] = useState<string | null>(null);
  const [addressBusy, setAddressBusy] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queued, setQueued] = useState(false);

  const { position, locate, loading: locating, denied } = useGeolocation();
  const { data: live } = useLive({ period: "24h", pollMs: 0 });
  const fileRef = useRef<HTMLInputElement>(null);
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const steps: Step[] = kind === "water"
    ? ["kind", "level", "place", "details"]
    : ["kind", "place", "details"];
  const stepIndex = Math.max(0, steps.indexOf(step));

  /* Адрес подтягиваем с задержкой: карту двигают непрерывно,
     а Nominatim просит не частить. */
  const resolveAddress = useCallback(
    (lat: number, lng: number) => {
      if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
      setAddressBusy(true);
      geocodeTimer.current = setTimeout(async () => {
        const found = await reverseGeocode(lat, lng, locale);
        setAddress(found);
        setAddressBusy(false);
      }, 900);
    },
    [locale],
  );

  useEffect(() => {
    return () => {
      if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    };
  }, []);

  const goToPlace = async () => {
    setStep("place");
    const pos = await locate();
    if (pos && insidePilot(pos.lat, pos.lng)) {
      setPoint({ lat: pos.lat, lng: pos.lng });
      setMapCenter({ lat: pos.lat, lng: pos.lng });
      resolveAddress(pos.lat, pos.lng);
    } else {
      resolveAddress(URALSK.lat, URALSK.lng);
    }
  };

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    try {
      setPhoto(await compressImage(file));
    } catch {
      setError("photo_too_large");
    }
  };

  const send = async () => {
    if (!kind || busy) return;
    setBusy(true);
    setError(null);

    const payload = {
      kind,
      level: kind === "water" ? level : null,
      lat: point.lat,
      lng: point.lng,
      address,
      comment: comment.trim() || null,
      photo,
    };

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      enqueue(payload);
      setQueued(true);
      setStep("done");
      setBusy(false);
      return;
    }

    try {
      await submitReport(payload);
      setQueued(false);
      setStep("done");
    } catch (e) {
      const code = (e as { code?: string }).code ?? "generic";
      // Сеть отвалилась в момент отправки — не теряем сообщение.
      if (code === "generic" && !navigator.onLine) {
        enqueue(payload);
        setQueued(true);
        setStep("done");
      } else {
        setError(code);
      }
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setStep("kind");
    setKind(null);
    setLevel(null);
    setPhoto(null);
    setComment("");
    setError(null);
    setQueued(false);
  };

  const outside = !insidePilot(point.lat, point.lng);
  const errorText = error
    ? (t.report.errors as Record<string, string>)[error] ??
      t.report.errors.generic
    : null;

  return (
    <>
      <Nav />
      <MobileTabs />

      <main className="relative min-h-dvh bg-foam pt-24 pb-32 md:pb-16">
        <div className="mx-auto max-w-2xl px-4">
          {step !== "done" && (
            <>
              <div className="mb-6 text-center">
                <h1 className="headline text-3xl sm:text-4xl">
                  {t.report.title}
                </h1>
                <p className="lead mt-2 text-sm">{t.report.subtitle}</p>
              </div>

              {/* Прогресс */}
              <div className="mb-6 flex items-center gap-2">
                {steps.map((s, i) => (
                  <div key={s} className="flex flex-1 items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-water-100">
                      <motion.div
                        className="h-full rounded-full bg-water-500"
                        initial={false}
                        animate={{ width: i <= stepIndex ? "100%" : "0%" }}
                        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <AnimatePresence mode="wait">
            {/* ── Шаг 1: что происходит ── */}
            {step === "kind" && (
              <motion.section
                key="kind"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="grid grid-cols-2 gap-3"
              >
                {REPORT_KINDS.map((k, i) => (
                  <motion.button
                    key={k}
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => {
                      setKind(k);
                      if (k === "water") setStep("level");
                      else void goToPlace();
                    }}
                    className="card card-hover flex flex-col items-center gap-2 p-6 text-center sm:p-8"
                  >
                    <span className="text-5xl sm:text-6xl" aria-hidden>
                      {KIND_EMOJI[k]}
                    </span>
                    <span className="text-base font-extrabold tracking-[-0.02em]">
                      {t.report.kinds[k].title}
                    </span>
                    <span className="lead text-xs">{t.report.kinds[k].text}</span>
                  </motion.button>
                ))}
              </motion.section>
            )}

            {/* ── Шаг 2: глубина ── */}
            {step === "level" && (
              <motion.section
                key="level"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="space-y-3"
              >
                {([1, 2, 3, 4] as const).map((lvl, i) => (
                  <motion.button
                    key={lvl}
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setLevel(lvl);
                      void goToPlace();
                    }}
                    className="card card-hover flex w-full items-center gap-4 p-5 text-left"
                  >
                    <span
                      className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-3xl"
                      style={{ background: `${LEVEL_COLOR[lvl]}26` }}
                      aria-hidden
                    >
                      {LEVEL_EMOJI[lvl]}
                    </span>
                    <span className="flex-1">
                      <span className="block text-lg font-extrabold tracking-[-0.02em]">
                        {t.report.levels[`l${lvl}` as "l1"].title}
                      </span>
                      <span className="lead block text-xs">
                        {t.report.levels[`l${lvl}` as "l1"].text}
                      </span>
                    </span>
                    {/* Полоска-«вода»: чем глубже, тем выше заливка */}
                    <span className="relative h-14 w-3 shrink-0 overflow-hidden rounded-full bg-water-50">
                      <span
                        className="absolute inset-x-0 bottom-0 rounded-full"
                        style={{
                          height: `${lvl * 25}%`,
                          background: LEVEL_COLOR[lvl],
                        }}
                      />
                    </span>
                  </motion.button>
                ))}

                <button
                  onClick={() => setStep("kind")}
                  className="btn btn-ghost w-full py-3 text-sm"
                >
                  <IconArrowLeft className="h-4 w-4" />
                  {t.common.back}
                </button>
              </motion.section>
            )}

            {/* ── Шаг 3: место ── */}
            {step === "place" && (
              <motion.section
                key="place"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="space-y-3"
              >
                <div className="card overflow-hidden">
                  <FloodMap
                    className="h-[46vh] min-h-[18rem] w-full"
                    reports={[]}
                    pickMode
                    center={mapCenter}
                    zoom={16}
                    userPosition={position}
                    onPickMove={(lat, lng) => {
                      setPoint({ lat, lng });
                      resolveAddress(lat, lng);
                    }}
                  />
                  <div className="border-t border-water-100 p-4">
                    <div className="flex items-start gap-2">
                      <IconPin className="mt-0.5 h-4 w-4 shrink-0 text-water-500" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold">
                          {addressBusy ? (
                            <span className="inline-block h-4 w-40 rounded skeleton align-middle" />
                          ) : (
                            (address ?? t.report.place.addressUnknown)
                          )}
                        </div>
                        <div className="text-[11px] font-semibold text-ink-soft tabular-nums">
                          {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
                          {position &&
                            ` · ${fmt(t.report.place.accuracy, {
                              n: Math.round(position.accuracy),
                            })}`}
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          const pos = await locate();
                          if (pos) {
                            setMapCenter({ lat: pos.lat, lng: pos.lng });
                            setPoint({ lat: pos.lat, lng: pos.lng });
                            resolveAddress(pos.lat, pos.lng);
                          }
                        }}
                        className="btn btn-ghost shrink-0 px-3 py-2 text-xs"
                        aria-label={t.report.place.gps}
                      >
                        <IconTarget
                          className={`h-4 w-4 ${locating ? "animate-pulse" : ""} ${
                            denied ? "opacity-40" : ""
                          }`}
                        />
                      </button>
                    </div>
                    <p className="lead mt-2 text-[11px]">
                      {denied ? t.report.place.gpsFail : t.report.place.drag}
                    </p>
                  </div>
                </div>

                {outside && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                    {t.report.place.outside}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => setStep(kind === "water" ? "level" : "kind")}
                    className="btn btn-ghost flex-1 py-3.5 text-sm"
                  >
                    <IconArrowLeft className="h-4 w-4" />
                    {t.common.back}
                  </button>
                  <button
                    onClick={() => setStep("details")}
                    disabled={outside}
                    className="btn btn-primary flex-[2] py-3.5 text-sm"
                  >
                    {t.common.next}
                    <IconArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </motion.section>
            )}

            {/* ── Шаг 4: детали ── */}
            {step === "details" && (
              <motion.section
                key="details"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="space-y-3"
              >
                {/* Сводка */}
                <div className="card flex items-center gap-3 p-4">
                  <span className="text-3xl" aria-hidden>
                    {kind === "water" && level
                      ? LEVEL_EMOJI[level]
                      : kind && KIND_EMOJI[kind]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-extrabold">
                      {kind === "water" && level
                        ? t.report.levels[`l${level}` as "l1"].title
                        : kind && t.report.kinds[kind].title}
                    </div>
                    <div className="flex items-center gap-1 truncate text-[11px] font-semibold text-ink-soft">
                      <IconPin className="h-3 w-3 shrink-0" />
                      {address ?? t.report.place.addressUnknown}
                    </div>
                  </div>
                  <button
                    onClick={() => setStep("kind")}
                    className="shrink-0 text-water-600"
                    aria-label={t.common.back}
                  >
                    <IconEdit className="h-4 w-4" />
                  </button>
                </div>

                {/* Фото */}
                <div className="card p-5">
                  <div className="mb-1 text-sm font-extrabold">
                    {t.report.details.photo}
                  </div>
                  <p className="lead mb-3 text-[11px]">
                    {t.report.details.photoHint}
                  </p>

                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => void pickPhoto(e.target.files?.[0])}
                  />

                  {photo ? (
                    <div className="relative overflow-hidden rounded-2xl">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo}
                        alt=""
                        className="max-h-64 w-full object-cover"
                      />
                      <div className="absolute right-2 bottom-2 flex gap-2">
                        <button
                          onClick={() => fileRef.current?.click()}
                          className="btn glass px-3 py-1.5 text-xs"
                        >
                          {t.report.details.changePhoto}
                        </button>
                        <button
                          onClick={() => setPhoto(null)}
                          className="btn glass px-3 py-1.5 text-xs !text-alert"
                        >
                          {t.report.details.removePhoto}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-water-200 py-8 transition-colors hover:border-water-400 hover:bg-water-50"
                    >
                      <IconCamera className="h-7 w-7 text-water-500" />
                      <span className="text-sm font-bold text-water-700">
                        {t.report.details.addPhoto}
                      </span>
                    </button>
                  )}
                </div>

                {/* Комментарий */}
                <div className="card p-5">
                  <div className="mb-1 text-sm font-extrabold">
                    {t.report.details.comment}
                  </div>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value.slice(0, 500))}
                    placeholder={t.report.details.commentPlaceholder}
                    rows={3}
                    className="w-full resize-none rounded-2xl border border-water-100 bg-water-50/50 px-4 py-3 text-sm outline-none transition-colors focus:border-water-400 focus:bg-white"
                  />
                  <div className="mt-1.5 flex items-center justify-between">
                    <p className="lead text-[11px]">
                      {t.report.details.commentHint}
                    </p>
                    <span className="text-[11px] font-semibold text-ink-soft tabular-nums">
                      {comment.length}/500
                    </span>
                  </div>
                </div>

                {errorText && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                    {errorText}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => setStep("place")}
                    className="btn btn-ghost flex-1 py-4 text-sm"
                    aria-label={t.common.back}
                  >
                    <IconArrowLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => void send()}
                    disabled={busy}
                    className="btn btn-primary flex-[3] py-4 text-base"
                  >
                    {busy ? t.report.submitting : t.report.submit}
                  </button>
                </div>
              </motion.section>
            )}

            {/* ── Готово ── */}
            {step === "done" && (
              <motion.section
                key="done"
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 24 }}
                className="card p-8 text-center sm:p-12"
              >
                <motion.div
                  initial={{ scale: 0, rotate: -30 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{
                    type: "spring",
                    stiffness: 240,
                    damping: 14,
                    delay: 0.15,
                  }}
                  className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-water-500 text-white"
                >
                  <IconCheck className="h-8 w-8" />
                </motion.div>
                <h2 className="headline text-2xl sm:text-3xl">
                  {queued ? t.report.queuedTitle : t.report.successTitle}
                </h2>
                <p className="lead mx-auto mt-3 max-w-md text-sm">
                  {queued ? t.report.queuedText : t.report.successText}
                </p>

                {live?.ephemeral && (
                  <div className="mx-auto mt-5 max-w-md rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left">
                    <div className="text-xs font-extrabold text-amber-800">
                      {t.common.ephemeral}
                    </div>
                    <div className="mt-0.5 text-[11px] leading-snug text-amber-700">
                      {t.common.ephemeralHint}
                    </div>
                  </div>
                )}

                <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-center">
                  <button
                    onClick={() => router.push("/map")}
                    className="btn btn-primary px-6 py-3.5"
                  >
                    {t.report.successMap}
                  </button>
                  <button onClick={reset} className="btn btn-ghost px-6 py-3.5">
                    {t.report.successAgain}
                  </button>
                </div>

                <Link
                  href="/alerts"
                  className="mt-6 inline-block text-sm font-bold text-water-600 underline-offset-4 hover:underline"
                >
                  {t.alerts.title} →
                </Link>
              </motion.section>
            )}
          </AnimatePresence>
        </div>
      </main>
    </>
  );
}
