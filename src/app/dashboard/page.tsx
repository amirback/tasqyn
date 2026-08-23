"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { useI18n, useTimeAgo } from "@/i18n";
import { FloodMap } from "@/components/FloodMap";
import {
  IconAlert,
  IconChart,
  IconCheck,
  IconClock,
  IconDownload,
  IconRoad,
  IconShield,
  IconSos,
} from "@/components/icons";
import { Nav } from "@/components/Nav";
import { Counter } from "@/components/motion";
import { RISK_COLOR } from "@/lib/risk";
import {
  KIND_COLOR,
  WATER_LEVEL_CM,
  type HydroSnapshot,
  type Report,
  type RiskAssessment,
} from "@/lib/types";

interface Hotspot {
  lat: number;
  lng: number;
  count: number;
  maxLevel: number;
  help: number;
  roads: number;
  address: string | null;
}

interface DashData {
  reports: Report[];
  hotspots: Hotspot[];
  hydro: HydroSnapshot | null;
  risk: RiskAssessment;
  summary: {
    total: number;
    last24h: number;
    help: number;
    roads: number;
    confirmed: number;
    disputed: number;
  };
}

export default function DashboardPage() {
  const { t, tp } = useI18n();
  const ago = useTimeAgo();

  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [wrong, setWrong] = useState(false);
  const [data, setData] = useState<DashData | null>(null);
  const [focus, setFocus] = useState<{ lat: number; lng: number }>();

  const load = useCallback(async () => {
    const res = await fetch("/api/dashboard/data", { cache: "no-store" });
    if (res.status === 401) {
      setAuthed(false);
      return;
    }
    setAuthed(true);
    setData(await res.json());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!authed) return;
    const timer = setInterval(() => void load(), 30000);
    return () => clearInterval(timer);
  }, [authed, load]);

  const signIn = async () => {
    const res = await fetch("/api/dashboard/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      setWrong(false);
      setPassword("");
      await load();
    } else {
      setWrong(true);
    }
  };

  const signOut = async () => {
    await fetch("/api/dashboard/login", { method: "DELETE" });
    setAuthed(false);
    setData(null);
  };

  /* ── Вход ──────────────────────────────────────────────── */
  if (authed === false) {
    return (
      <>
        <Nav />
        <main className="grid min-h-dvh place-items-center bg-foam px-5 pt-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card w-full max-w-sm p-8"
          >
            <IconShield className="mx-auto mb-4 h-10 w-10 text-water-500" />
            <h1 className="text-center text-2xl font-extrabold tracking-[-0.03em]">
              {t.dashboard.title}
            </h1>
            <p className="lead mt-2 text-center text-sm">
              {t.dashboard.loginHint}
            </p>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setWrong(false);
              }}
              onKeyDown={(e) => e.key === "Enter" && void signIn()}
              placeholder={t.dashboard.password}
              className="mt-6 w-full rounded-2xl border border-water-100 bg-water-50/50 px-4 py-3.5 text-sm outline-none focus:border-water-400 focus:bg-white"
            />
            {wrong && (
              <p className="mt-2 text-xs font-bold text-alert">
                {t.dashboard.wrong}
              </p>
            )}
            <button
              onClick={() => void signIn()}
              className="btn btn-primary mt-4 w-full py-3.5"
            >
              {t.dashboard.enter}
            </button>
          </motion.div>
        </main>
      </>
    );
  }

  if (authed === null || !data) {
    return (
      <>
        <Nav />
        <main className="grid min-h-dvh place-items-center bg-foam">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-water-100 border-t-water-500" />
        </main>
      </>
    );
  }

  const { summary, risk, hydro, hotspots, reports } = data;

  const cards = [
    { Icon: IconChart, label: t.dashboard.total, value: summary.total },
    { Icon: IconClock, label: t.dashboard.last24, value: summary.last24h },
    { Icon: IconSos, label: t.dashboard.help, value: summary.help, alert: true },
    { Icon: IconRoad, label: t.dashboard.roads, value: summary.roads },
    { Icon: IconCheck, label: t.dashboard.confirmed, value: summary.confirmed },
    { Icon: IconAlert, label: t.dashboard.disputed, value: summary.disputed },
  ];

  return (
    <>
      <Nav />
      <main className="min-h-dvh bg-foam pt-24 pb-16">
        <div className="mx-auto max-w-7xl px-4">
          <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="headline text-3xl sm:text-4xl">
                {t.dashboard.title}
              </h1>
              <p className="lead mt-1 text-sm">{t.dashboard.subtitle}</p>
            </div>
            <div className="flex gap-2">
              <a
                href="/api/dashboard/export"
                className="btn btn-ghost px-4 py-2.5 text-sm"
              >
                <IconDownload className="h-4 w-4" />
                {t.dashboard.export}
              </a>
              <button
                onClick={() => void signOut()}
                className="btn btn-ghost px-4 py-2.5 text-sm"
              >
                {t.dashboard.logout}
              </button>
            </div>
          </header>

          {/* Сводка */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {cards.map((c, i) => (
              <motion.div
                key={c.label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`card p-5 ${
                  c.alert && c.value > 0 ? "border-alert/40 bg-red-50/40" : ""
                }`}
              >
                <c.Icon
                  className={`h-5 w-5 ${
                    c.alert && c.value > 0 ? "text-alert" : "text-water-500"
                  }`}
                />
                <div className="mt-2 text-3xl font-extrabold tracking-[-0.04em] tabular-nums">
                  <Counter value={c.value} />
                </div>
                <div className="lead mt-0.5 text-[11px] font-semibold">
                  {c.label}
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
            {/* Карта */}
            {/* flex-1 тянет карту на всю высоту карточки: в сетке она
                растягивается по правой колонке, и иначе снизу зияет пустота */}
            <div className="card flex flex-col overflow-hidden">
              <FloodMap
                className="h-[26rem] w-full flex-1 lg:h-auto lg:min-h-[34rem]"
                reports={reports}
                center={focus}
                zoom={focus ? 15.5 : undefined}
              />
            </div>

            <div className="space-y-4">
              {/* Тревога */}
              <div className="card p-6">
                <div className="flex items-center gap-3">
                  <span
                    className="h-9 w-1.5 shrink-0 rounded-full"
                    style={{ background: RISK_COLOR[risk.level] }}
                    aria-hidden
                  />
                  <div>
                    <div className="kicker">{t.risk.title}</div>
                    <div
                      className="text-2xl font-extrabold tracking-[-0.03em]"
                      style={{ color: RISK_COLOR[risk.level] }}
                    >
                      {t.risk.levels[risk.level]}
                    </div>
                  </div>
                  <span className="ml-auto text-sm font-bold text-ink-soft tabular-nums">
                    {risk.score}/100
                  </span>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-water-50">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: RISK_COLOR[risk.level] }}
                    initial={{ width: 0 }}
                    animate={{ width: `${risk.score}%` }}
                    transition={{ duration: 1 }}
                  />
                </div>
                <ul className="mt-4 space-y-1">
                  {risk.reasons.map((r) => (
                    <li key={r} className="flex gap-2 text-xs text-ink-soft">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-water-400" />
                      {tp(r)}
                    </li>
                  ))}
                </ul>
                {hydro && (
                  <div className="mt-4 rounded-2xl bg-water-50 p-3 text-xs font-semibold">
                    {t.hydro.discharge}:{" "}
                    <b>
                      {hydro.discharge != null
                        ? Math.round(hydro.discharge)
                        : "—"}{" "}
                      {t.hydro.unit}
                    </b>{" "}
                    · {t.hydro.normal}:{" "}
                    <b>
                      {hydro.normal != null ? Math.round(hydro.normal) : "—"}
                    </b>{" "}
                    · {t.hydro.trend[hydro.trend]}
                  </div>
                )}
              </div>

              {/* Очаги */}
              <div className="card p-6">
                <div className="kicker">{t.dashboard.hotspots}</div>
                <p className="lead mt-1 text-[11px]">
                  {t.dashboard.hotspotsHint}
                </p>
                {hotspots.length === 0 ? (
                  <p className="lead mt-4 text-sm">{t.dashboard.noData}</p>
                ) : (
                  <ul className="mt-4 space-y-2">
                    {hotspots.slice(0, 6).map((h, i) => (
                      <li key={`${h.lat}-${h.lng}`}>
                        <button
                          onClick={() => setFocus({ lat: h.lat, lng: h.lng })}
                          className="flex w-full items-center gap-3 rounded-2xl bg-water-50/60 px-3 py-2.5 text-left transition-colors hover:bg-water-100"
                        >
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-xs font-extrabold text-water-700">
                            {i + 1}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-bold">
                              {h.address ??
                                `${h.lat.toFixed(4)}, ${h.lng.toFixed(4)}`}
                            </span>
                            <span className="flex flex-wrap items-center gap-x-2 text-[10px] font-semibold text-ink-soft">
                              <span>{h.count}</span>
                              {h.help > 0 && (
                                <span className="text-alert">
                                  {t.dashboard.help}: {h.help}
                                </span>
                              )}
                              {h.roads > 0 && (
                                <span className="text-warn">
                                  {t.dashboard.roads}: {h.roads}
                                </span>
                              )}
                              {h.maxLevel > 0 && (
                                <span>
                                  ≈{WATER_LEVEL_CM[h.maxLevel as 1]} см
                                </span>
                              )}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* Лента */}
          <div className="card mt-4 overflow-hidden">
            <div className="border-b border-water-100 px-6 py-4">
              <div className="kicker">{t.dashboard.feed}</div>
            </div>
            <div className="max-h-[32rem] overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-white/95 backdrop-blur">
                  <tr className="text-[10px] font-bold tracking-widest text-ink-soft uppercase">
                    <th className="px-4 py-3">{t.dashboard.tableTime}</th>
                    <th className="px-4 py-3">{t.dashboard.tableKind}</th>
                    <th className="px-4 py-3">{t.dashboard.tableLevel}</th>
                    <th className="px-4 py-3">{t.dashboard.tableAddress}</th>
                    <th className="px-4 py-3">{t.dashboard.tableStatus}</th>
                    <th className="px-4 py-3">{t.dashboard.tableComment}</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {reports.length === 0 && (
                    <tr>
                      <td colSpan={7} className="lead px-4 py-10 text-center">
                        {t.dashboard.noData}
                      </td>
                    </tr>
                  )}
                  {reports.map((r) => (
                    <tr
                      key={r.id}
                      className="border-t border-water-50 hover:bg-water-50/50"
                    >
                      <td className="px-4 py-3 text-xs whitespace-nowrap text-ink-soft">
                        {ago(r.createdAt)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className="mr-2 inline-block h-2 w-2 rounded-full align-middle"
                          style={{ background: KIND_COLOR[r.kind] }}
                          aria-hidden
                        />
                        <span className="text-xs font-semibold">
                          {t.report.kinds[r.kind].title}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs font-bold whitespace-nowrap tabular-nums">
                        {r.level ? `${WATER_LEVEL_CM[r.level]} см` : "—"}
                      </td>
                      <td className="max-w-52 truncate px-4 py-3 text-xs">
                        {r.address ?? `${r.lat.toFixed(4)}, ${r.lng.toFixed(4)}`}
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        {t.detail[r.status]}
                        <span className="ml-1 text-ink-soft tabular-nums">
                          ({r.confirms}/{r.disputes})
                        </span>
                      </td>
                      <td className="max-w-64 truncate px-4 py-3 text-xs text-ink-soft">
                        {r.comment ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setFocus({ lat: r.lat, lng: r.lng })}
                          className="text-xs font-bold whitespace-nowrap text-water-600 hover:underline"
                        >
                          {t.dashboard.openMap} →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
