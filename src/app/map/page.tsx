"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useI18n, useTimeAgo } from "@/i18n";
import { useLive, type Period } from "@/hooks/useLive";
import { useGeolocation } from "@/hooks/useGeolocation";
import { FloodMap } from "@/components/FloodMap";
import { ReportSheet } from "@/components/ReportSheet";
import { MobileTabs, Nav } from "@/components/Nav";
import { URALSK } from "@/lib/geo";
import { RISK_COLOR, RISK_EMOJI } from "@/lib/risk";
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
                <div className="text-3xl" aria-hidden>
                  🗺️
                </div>
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
              <span className="text-xl leading-none" aria-hidden>
                {risk ? RISK_EMOJI[risk.level] : "⏳"}
              </span>
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
              <span className={loading ? "inline-block animate-spin" : ""}>
                ↻
              </span>
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
              <div className="glass mx-auto max-w-md rounded-3xl p-5">
                <div className="kicker mb-2">{t.risk.why}</div>
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
                      <span className="text-water-400">•</span>
                      <Reason path={r} />
                    </li>
                  ))}
                </ul>
                {data?.hydro && (
                  <div className="mt-4 rounded-2xl bg-water-50 p-3 text-xs font-semibold text-ink-soft">
                    🌊 {t.hydro.title}:{" "}
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
              🔥 {t.map.layerHeat}
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
            <span className={locating ? "animate-pulse" : ""} aria-hidden>
              {denied ? "🚫" : "🎯"}
            </span>
          </button>
          <button
            onClick={() => {
              setCenter({ lat: URALSK.lat, lng: URALSK.lng });
              setZoom(URALSK.zoom);
            }}
            className="glass grid h-12 w-12 place-items-center rounded-full text-xl shadow-lg"
            aria-label={t.map.recenter}
          >
            <span aria-hidden>🏙️</span>
          </button>
          <Link
            href="/report"
            className="btn btn-primary grid h-14 w-14 place-items-center rounded-full text-2xl shadow-xl"
            aria-label={t.map.addReport}
          >
            <span aria-hidden>💧</span>
          </Link>
        </div>

        {/* Легенда — только на широком экране */}
        <div className="glass absolute bottom-6 left-5 z-[55] hidden rounded-3xl p-4 xl:block">
          <div className="kicker mb-2.5 !text-[0.62rem]">{t.map.legendLevel}</div>
          <ul className="space-y-1.5">
            {([1, 2, 3, 4] as const).map((lvl) => (
              <li key={lvl} className="flex items-center gap-2 text-xs font-semibold">
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
              <li key={k} className="flex items-center gap-2 text-xs font-semibold">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-water-50 text-[11px]">
                  <span aria-hidden>{KIND_EMOJI[k]}</span>
                </span>
                {t.map.kinds[k]}
              </li>
            ))}
          </ul>
        </div>

        {/* Пустое состояние */}
        {!loading && reports.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            className="pointer-events-none absolute inset-0 z-[50] grid place-items-center px-6"
          >
            <div className="glass pointer-events-auto max-w-sm rounded-4xl p-8 text-center">
              <div className="mb-3 text-5xl" aria-hidden>
                🌤️
              </div>
              <h3 className="text-lg font-extrabold tracking-[-0.02em]">
                {t.map.empty}
              </h3>
              <p className="lead mt-2 text-sm">{t.map.emptyHint}</p>
              <Link href="/report" className="btn btn-primary mt-5 px-6 py-3">
                💧 {t.map.addReport}
              </Link>
            </div>
          </motion.div>
        )}

        {/* Свежая лента слева на десктопе */}
        {reports.length > 0 && (
          /* Ниже верхней панели: на широком экране они шли внахлёст */
          <div className="absolute top-40 left-5 z-[55] hidden w-72 xl:block">
            <div className="glass max-h-[46vh] overflow-y-auto rounded-3xl p-3">
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
                          {r.status === "confirmed" && " · ✅"}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
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
