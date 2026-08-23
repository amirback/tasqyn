"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useI18n, useTimeAgo } from "@/i18n";
import { useLive, type Period } from "@/hooks/useLive";
import { useGeolocation } from "@/hooks/useGeolocation";
import { FloodMap } from "@/components/FloodMap";
import {
  IconCity,
  IconDrop,
  IconMap,
  IconLayers,
  IconRefresh,
  IconTarget,
} from "@/components/icons";
import { ReportSheet } from "@/components/ReportSheet";
import { ForecastPanel } from "@/components/ForecastPanel";
import { MobileTabs, Nav } from "@/components/Nav";
import { URALSK } from "@/lib/geo";
import { RISK_COLOR } from "@/lib/risk";
import {
  KIND_EMOJI,
  LEVEL_COLOR,
  LEVEL_EMOJI,
  REPORT_KINDS,
  type Report,
  type ReportKind,
} from "@/lib/types";

const PERIODS: { id: Period; key: "h6" | "h24" | "d7" | "all" }[] = [
  { id: "6h", key: "h6" },
  { id: "24h", key: "h24" },
  { id: "7d", key: "d7" },
  { id: "all", key: "all" },
];

export default function MapPage() {
  const { t, fmt } = useI18n();
  const ago = useTimeAgo();
  const [period, setPeriod] = useState<Period>("24h");
  const [kinds, setKinds] = useState<ReportKind[]>([]);
  const [selected, setSelected] = useState<Report | null>(null);
  const [showHeat, setShowHeat] = useState(true);
  const [center, setCenter] = useState<{ lat: number; lng: number } | undefined>();
  const [zoom, setZoom] = useState<number | undefined>();
  const [panelOpen, setPanelOpen] = useState(false);
  // Подсказку показываем один раз: человек, открывший карту впервые,
  // не должен гадать, где вообще ставится метка.
  const [showHowTo, setShowHowTo] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem("tasqyn.howto")) setShowHowTo(true);
    } catch {
      /* приватный режим — просто не показываем */
    }
  }, []);

  const dismissHowTo = () => {
    setShowHowTo(false);
    try {
      localStorage.setItem("tasqyn.howto", "1");
    } catch {
      /* неважно */
    }
  };

  const { position, locate, loading: locating, denied } = useGeolocation();
  const { data, loading, reload } = useLive({
    period,
    kinds: kinds.length ? kinds : undefined,
    pollMs: 25000,
  });

  const reports = useMemo(() => data?.reports ?? [], [data]);
  const risk = data?.risk;

  const toggleKind = (k: ReportKind) =>
    setKinds((prev) =>
      prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k],
    );

  const goToMe = async () => {
    const pos = await locate();
    if (pos) {
      setCenter({ lat: pos.lat, lng: pos.lng });
      setZoom(15.5);
    }
  };

  const focus = (r: Report) => {
    setSelected(r);
    setCenter({ lat: r.lat, lng: r.lng });
    setZoom(16);
  };

  return (
    <>
      <Nav />
      <MobileTabs />

      <main className="relative h-dvh w-full overflow-hidden">
        <FloodMap
          /* Растягиваем высотой, а не position: сам компонент уже relative,
             и второй класс позиционирования обнулял бы ему высоту. */
          className="h-full w-full"
          reports={reports}
          selectedId={selected?.id}
          onSelect={setSelected}
          showHeat={showHeat}
          userPosition={position}
          center={center}
          zoom={zoom}
          fallback={
            /* Без WebGL карту не показать, но данные всё равно нужны — списком. */
            <div className="max-h-full w-full max-w-lg overflow-y-auto pt-24 pb-32">
              <div className="mb-3 text-center">
                <IconMap className="mx-auto mb-2 h-7 w-7 text-water-500" />
                <div className="text-sm font-extrabold">{t.map.noWebgl}</div>
                <p className="lead mt-1 text-xs">{t.map.noWebglHint}</p>
              </div>
              <ul className="space-y-1.5">
                {reports.map((r) => (
                  <li key={r.id}>
                    <button
                      onClick={() => setSelected(r)}
                      className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-sm"
                    >
                      <span className="text-xl" aria-hidden>
                        {r.kind === "water" && r.level
                          ? LEVEL_EMOJI[r.level]
                          : KIND_EMOJI[r.kind]}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-bold">
                          {r.address ?? t.report.kinds[r.kind].title}
                        </span>
                        <span className="block text-[10px] font-semibold text-ink-soft">
                          {ago(r.createdAt)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          }
        />

        {/* Верхняя панель: тревога + счётчик */}
        <div className="pointer-events-none absolute inset-x-0 top-20 z-[60] px-3 sm:top-24 sm:px-5">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2">
            <motion.button
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => setPanelOpen((v) => !v)}
              className="glass pointer-events-auto flex items-center gap-2.5 rounded-full py-2 pr-4 pl-2.5"
            >
              <span
                className="h-8 w-1.5 shrink-0 rounded-full"
                style={{ background: risk ? RISK_COLOR[risk.level] : "#cbd5e1" }}
                aria-hidden
              />
              <span className="text-left">
                <span
                  className="block text-sm leading-tight font-extrabold"
                  style={{ color: risk ? RISK_COLOR[risk.level] : undefined }}
                >
                  {risk ? t.risk.levels[risk.level] : t.common.loading}
                </span>
                <span className="block text-[10px] leading-tight font-semibold text-ink-soft">
                  {fmt(t.map.reportsCount, { n: reports.length })}
                </span>
              </span>
              <span
                className={`ml-1 text-xs transition-transform ${panelOpen ? "rotate-180" : ""}`}
                aria-hidden
              >
                ▾
              </span>
            </motion.button>

            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06 }}
              className="glass pointer-events-auto flex items-center gap-1.5 rounded-full px-3 py-2 text-[11px] font-bold text-ink-soft"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-water-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-water-500" />
              </span>
              {t.map.live}
            </motion.div>

            <button
              onClick={() => void reload()}
              className="glass pointer-events-auto grid h-9 w-9 place-items-center rounded-full text-sm"
              aria-label={t.common.refresh}
            >
              <IconRefresh
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>

        {/* Раскрывающаяся панель с разбором тревоги */}
        <AnimatePresence>
          {panelOpen && (
            <motion.div
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="absolute inset-x-0 top-32 z-[70] px-3 sm:top-36 sm:px-5"
            >
              <div className="glass mx-auto max-h-[62vh] max-w-md overflow-y-auto rounded-3xl p-5">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="kicker">{t.risk.why}</span>
                  <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-700">
                    {t.risk.notOfficial}
                  </span>
                </div>
                <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-water-50">
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      background: risk ? RISK_COLOR[risk.level] : "#0ea5e9",
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${risk?.score ?? 0}%` }}
                    transition={{ duration: 0.9 }}
                  />
                </div>
                <ul className="space-y-1.5">
                  {risk?.reasons.map((r) => (
                    <li key={r} className="flex gap-2 text-sm text-ink-soft">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-water-400" />
                      <Reason path={r} />
                    </li>
                  ))}
                </ul>
                {data?.hydro && (
                  <div className="mt-4 rounded-2xl bg-water-50 p-3 text-xs font-semibold text-ink-soft">
                    {t.hydro.title}:{" "}
                    <b className="text-ink">
                      {data.hydro.discharge != null
                        ? Math.round(data.hydro.discharge)
                        : "—"}{" "}
                      {t.hydro.unit}
                    </b>{" "}
                    · {t.hydro.trend[data.hydro.trend]}
                    {data.hydro.anomalyPct != null && (
                      <>
                        {" "}
                        ·{" "}
                        <b className="text-ink">
                          {data.hydro.anomalyPct > 0 ? "+" : ""}
                          {data.hydro.anomalyPct}%
                        </b>
                      </>
                    )}
                  </div>
                )}
                <p className="lead mt-3 text-[11px]">{t.risk.source}</p>
                <div className="mt-4">
                  <ForecastPanel hydro={data?.hydro ?? null} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Хранилище временное — говорим прямо, а не прячем в README */}
        {data?.ephemeral && (
          <div className="pointer-events-none absolute inset-x-0 top-32 z-[58] px-3 sm:top-36 sm:px-5">
            <div className="pointer-events-auto mx-auto max-w-md rounded-2xl border border-amber-200 bg-amber-50/95 px-4 py-2.5 backdrop-blur">
              <div className="text-xs font-extrabold text-amber-800">
                {t.common.ephemeral}
              </div>
              <div className="mt-0.5 text-[11px] leading-snug text-amber-700">
                {t.common.ephemeralHint}
              </div>
            </div>
          </div>
        )}

        {/* Как поставить метку — один раз при первом заходе */}
        <AnimatePresence>
          {showHowTo && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              className="pointer-events-none absolute inset-x-0 bottom-40 z-[65] px-3 sm:px-5 md:bottom-20"
            >
              <div className="glass pointer-events-auto mx-auto max-w-sm rounded-3xl p-4">
                <div className="kicker !text-[0.62rem]">
                  {t.map.howTo.title}
                </div>
                <ol className="mt-2 space-y-1.5">
                  {[t.map.howTo.step1, t.map.howTo.step2, t.map.howTo.step3].map(
                    (step, i) => (
                      <li
                        key={step}
                        className="flex gap-2.5 text-xs font-semibold text-ink-soft"
                      >
                        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-water-100 text-[10px] font-extrabold text-water-700">
                          {i + 1}
                        </span>
                        {step}
                      </li>
                    ),
                  )}
                </ol>
                <button
                  onClick={dismissHowTo}
                  className="btn btn-primary mt-3 w-full py-2 text-xs"
                >
                  {t.map.howTo.got}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Фильтры */}
        <div className="pointer-events-none absolute inset-x-0 bottom-24 z-[60] md:bottom-6">
          <div className="no-scrollbar mx-auto flex max-w-6xl gap-2 overflow-x-auto px-3 pb-1 sm:px-5">
            <div className="glass pointer-events-auto flex shrink-0 items-center gap-1 rounded-full p-1">
              {PERIODS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPeriod(p.id)}
                  className={`relative rounded-full px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-colors ${
                    period === p.id ? "text-white" : "text-ink-soft"
                  }`}
                >
                  {period === p.id && (
                    <motion.span
                      layoutId="period-pill"
                      initial={false}
                      className="absolute inset-0 rounded-full bg-water-500"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  )}
                  <span className="relative z-10">{t.map.periods[p.key]}</span>
                </button>
              ))}
            </div>

            <div className="glass pointer-events-auto flex shrink-0 items-center gap-1 rounded-full p-1">
              {REPORT_KINDS.map((k) => {
                const on = kinds.length === 0 || kinds.includes(k);
                return (
                  <button
                    key={k}
                    onClick={() => toggleKind(k)}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-all ${
                      on
                        ? "bg-white text-ink shadow-sm"
                        : "text-ink-soft/50 grayscale"
                    }`}
                  >
                    <span aria-hidden>{KIND_EMOJI[k]}</span>{" "}
                    {t.map.kinds[k]}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setShowHeat((v) => !v)}
              className={`glass pointer-events-auto shrink-0 rounded-full px-4 py-2 text-xs font-bold whitespace-nowrap ${
                showHeat ? "text-water-700" : "text-ink-soft/60"
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                <IconLayers className="h-3.5 w-3.5" />
                {t.map.layerHeat}
              </span>
            </button>
          </div>
        </div>

        {/* Кнопки справа */}
        <div className="absolute right-3 bottom-44 z-[60] flex flex-col gap-2 sm:right-5 md:bottom-24">
          <button
            onClick={goToMe}
            className="glass grid h-12 w-12 place-items-center rounded-full text-xl shadow-lg"
            aria-label={t.map.locate}
            title={denied ? t.map.locateError : t.map.locate}
          >
            <IconTarget
              className={`h-5 w-5 ${locating ? "animate-pulse" : ""} ${
                denied ? "opacity-40" : ""
              }`}
            />
          </button>
          <button
            onClick={() => {
              setCenter({ lat: URALSK.lat, lng: URALSK.lng });
              setZoom(URALSK.zoom);
            }}
            className="glass grid h-12 w-12 place-items-center rounded-full text-xl shadow-lg"
            aria-label={t.map.recenter}
          >
            <IconCity className="h-5 w-5" />
          </button>
          <Link
            href="/report"
            className="btn btn-primary h-14 rounded-full px-4 shadow-xl md:px-5"
            aria-label={t.map.addReport}
          >
            <IconDrop className="h-6 w-6" />
            <span className="hidden text-sm md:inline">{t.map.addReport}</span>
          </Link>
        </div>

        {/* Пустое состояние */}
        {!loading && reports.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            className="pointer-events-none absolute inset-0 z-[50] grid place-items-center px-6"
          >
            <div className="glass pointer-events-auto max-w-sm rounded-4xl p-8 text-center">
              <h3 className="text-lg font-extrabold tracking-[-0.02em]">
                {t.map.empty}
              </h3>
              <p className="lead mt-2 text-sm">{t.map.emptyHint}</p>
              <Link href="/report" className="btn btn-primary mt-5 px-6 py-3">
                {t.map.addReport}
              </Link>
            </div>
          </motion.div>
        )}

        {/*
          Лента и легенда живут в одной колонке: раньше они стояли двумя
          абсолютными блоками и на невысоком экране наезжали друг на друга.
        */}
        <div className="pointer-events-none absolute top-40 bottom-24 left-5 z-[55] hidden w-72 flex-col gap-3 xl:flex">
          {reports.length > 0 && (
            <div className="glass pointer-events-auto min-h-0 flex-1 overflow-y-auto rounded-3xl p-3">
              <div className="kicker mb-2 px-2 !text-[0.62rem]">
                {t.dashboard.feed}
              </div>
              <ul className="space-y-1">
                {reports.slice(0, 12).map((r) => (
                  <li key={r.id}>
                    <button
                      onClick={() => focus(r)}
                      className={`flex w-full items-center gap-2.5 rounded-2xl px-2.5 py-2 text-left transition-colors ${
                        selected?.id === r.id
                          ? "bg-water-100"
                          : "hover:bg-water-50"
                      }`}
                    >
                      <span className="text-lg" aria-hidden>
                        {r.kind === "water" && r.level
                          ? LEVEL_EMOJI[r.level]
                          : KIND_EMOJI[r.kind]}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-bold">
                          {r.address ??
                            (r.kind === "water" && r.level
                              ? t.report.levels[`l${r.level}` as "l1"].title
                              : t.report.kinds[r.kind].title)}
                        </span>
                        <span className="block text-[10px] font-semibold text-ink-soft">
                          {ago(r.createdAt)}
                          {r.status === "confirmed" &&
                            ` · ${t.detail.confirmed.toLowerCase()}`}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="glass pointer-events-auto shrink-0 rounded-3xl p-4">
            <div className="kicker mb-2.5 !text-[0.62rem]">
              {t.map.legendLevel}
            </div>
            <ul className="space-y-1.5">
              {([1, 2, 3, 4] as const).map((lvl) => (
                <li
                  key={lvl}
                  className="flex items-center gap-2 text-xs font-semibold"
                >
                  <span
                    className="grid h-6 w-6 place-items-center rounded-full text-[11px]"
                    style={{ background: `${LEVEL_COLOR[lvl]}33` }}
                  >
                    <span aria-hidden>{LEVEL_EMOJI[lvl]}</span>
                  </span>
                  {t.report.levels[`l${lvl}` as "l1"].title}
                </li>
              ))}
            </ul>
            <div className="my-3 h-px bg-water-100" />
            <ul className="space-y-1.5">
              {(["road", "help", "safe"] as const).map((k) => (
                <li
                  key={k}
                  className="flex items-center gap-2 text-xs font-semibold"
                >
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-water-50 text-[11px]">
                    <span aria-hidden>{KIND_EMOJI[k]}</span>
                  </span>
                  {t.map.kinds[k]}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>

      <ReportSheet
        report={selected}
        onClose={() => setSelected(null)}
        onChanged={(updated) => {
          setSelected(updated);
          void reload();
        }}
        userPosition={position}
      />
    </>
  );
}

function Reason({ path }: { path: string }) {
  const { tp } = useI18n();
  return <span>{tp(path)}</span>;
}
