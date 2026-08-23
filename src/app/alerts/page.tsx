"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useI18n } from "@/i18n";
import { useLive } from "@/hooks/useLive";
import { useGeolocation } from "@/hooks/useGeolocation";
import { FloodMap } from "@/components/FloodMap";
import { MobileTabs, Nav } from "@/components/Nav";
import { distanceM, formatDistance, geocode, insidePilot, URALSK } from "@/lib/geo";
import {
  addPlace,
  loadPlaces,
  markNotified,
  NOTIFY_COOLDOWN_MS,
  PLACE_EMOJI,
  removePlace,
  type Place,
} from "@/lib/places";
import { KIND_EMOJI, LEVEL_EMOJI, type Report } from "@/lib/types";

const RADII = [300, 500, 1000, 2000, 3000];

export default function AlertsPage() {
  const { t, fmt, locale } = useI18n();
  const { data } = useLive({ period: "24h", pollMs: 45000 });
  const { position, locate, loading: locating } = useGeolocation();

  const [places, setPlaces] = useState<Place[]>([]);
  const [adding, setAdding] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    "default",
  );

  // Форма нового адреса
  const [label, setLabel] = useState("");
  const [emoji, setEmoji] = useState(PLACE_EMOJI[0]);
  const [radius, setRadius] = useState(1000);
  const [point, setPoint] = useState({ lat: URALSK.lat, lng: URALSK.lng });
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    { label: string; lat: number; lng: number }[]
  >([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setPlaces(loadPlaces());
    setPermission(
      typeof window !== "undefined" && "Notification" in window
        ? Notification.permission
        : "unsupported",
    );
  }, []);

  /* Поиск адреса — с задержкой, чтобы не долбить Nominatim на каждую букву. */
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (query.trim().length < 3) {
      setResults([]);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      setResults(await geocode(query, locale));
      setSearching(false);
    }, 600);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [query, locale]);

  const reports = useMemo(() => data?.reports ?? [], [data]);

  /** Сколько активных сообщений рядом с каждым адресом. */
  const nearby = useMemo(() => {
    const map = new Map<string, Report[]>();
    for (const p of places) {
      map.set(
        p.id,
        reports.filter(
          (r) =>
            r.status !== "resolved" &&
            r.status !== "disputed" &&
            distanceM(p.lat, p.lng, r.lat, r.lng) <= p.radiusM,
        ),
      );
    }
    return map;
  }, [places, reports]);

  /* Уведомления. Пока вкладка открыта — этого достаточно для пилота;
     полноценный web-push появится вместе с серверными подписками. */
  useEffect(() => {
    if (permission !== "granted" || !places.length) return;
    for (const p of places) {
      const found = nearby.get(p.id) ?? [];
      const serious = found.filter(
        (r) => r.kind === "help" || r.kind === "road" || (r.level ?? 0) >= 2,
      );
      if (!serious.length) continue;
      if (p.notifiedAt && Date.now() - p.notifiedAt < NOTIFY_COOLDOWN_MS) continue;

      new Notification(fmt(t.alerts.alertTitle, { label: p.label }), {
        body: fmt(t.alerts.alertBody, {
          n: serious.length,
          r: formatDistance(p.radiusM, locale),
        }),
        icon: "/icon-192.png",
        tag: `tasqyn-${p.id}`,
      });
      markNotified(p.id);
      setPlaces(loadPlaces());
    }
  }, [nearby, places, permission, t, fmt, locale]);

  const requestPermission = async () => {
    if (!("Notification" in window)) return;
    setPermission(await Notification.requestPermission());
  };

  const submit = () => {
    if (!insidePilot(point.lat, point.lng)) return;
    setPlaces(
      addPlace({
        label: label.trim() || t.alerts.labelPlaceholder,
        emoji,
        lat: point.lat,
        lng: point.lng,
        radiusM: radius,
      }),
    );
    setAdding(false);
    setLabel("");
    setQuery("");
    setResults([]);
  };

  const watchAreas = places.map((p) => ({
    lat: p.lat,
    lng: p.lng,
    radiusM: p.radiusM,
    label: p.label,
  }));

  return (
    <>
      <Nav />
      <MobileTabs />

      <main className="min-h-dvh bg-foam pt-24 pb-32 md:pb-16">
        <div className="mx-auto max-w-3xl px-4">
          <header className="mb-6">
            <h1 className="headline text-3xl sm:text-4xl">
              🔔 {t.alerts.title}
            </h1>
            <p className="lead mt-2 max-w-xl text-sm">{t.alerts.subtitle}</p>
          </header>

          {/* Уведомления */}
          <div className="card mb-4 flex flex-wrap items-center justify-between gap-3 p-5">
            <div className="flex items-center gap-3">
              <span className="text-2xl" aria-hidden>
                {permission === "granted" ? "🔔" : "🔕"}
              </span>
              <div>
                <div className="text-sm font-extrabold">
                  {t.alerts.notifications}
                </div>
                <div className="text-[11px] font-semibold text-ink-soft">
                  {permission === "granted"
                    ? t.alerts.notificationsOn
                    : permission === "denied"
                      ? t.alerts.notificationsDenied
                      : t.alerts.notificationsDisabled}
                </div>
              </div>
            </div>
            {permission === "granted" ? (
              <button
                onClick={() =>
                  new Notification(t.brand.name, {
                    body: t.alerts.testBody,
                    icon: "/icon-192.png",
                  })
                }
                className="btn btn-ghost px-4 py-2 text-xs"
              >
                {t.alerts.test}
              </button>
            ) : (
              permission !== "denied" &&
              permission !== "unsupported" && (
                <button
                  onClick={() => void requestPermission()}
                  className="btn btn-primary px-4 py-2 text-xs"
                >
                  {t.alerts.notificationsOff}
                </button>
              )
            )}
          </div>

          {/* Список адресов */}
          {places.length === 0 && !adding ? (
            <div className="card p-10 text-center">
              <div className="mb-3 text-5xl" aria-hidden>
                🏠
              </div>
              <h2 className="text-lg font-extrabold">{t.alerts.empty}</h2>
              <p className="lead mt-2 text-sm">{t.alerts.emptyHint}</p>
              <button
                onClick={() => setAdding(true)}
                className="btn btn-primary mt-5 px-6 py-3"
              >
                ➕ {t.alerts.addTitle}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence initial={false}>
                {places.map((p) => {
                  const found = nearby.get(p.id) ?? [];
                  return (
                    <motion.div
                      key={p.id}
                      layout
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                      className="card overflow-hidden p-5"
                    >
                      <div className="flex items-start gap-4">
                        <span
                          className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-3xl ${
                            found.length ? "bg-amber-50" : "bg-water-50"
                          }`}
                          aria-hidden
                        >
                          {p.emoji}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-lg font-extrabold tracking-[-0.02em]">
                            {p.label}
                          </div>
                          <div className="text-[11px] font-semibold text-ink-soft">
                            📏 {formatDistance(p.radiusM, locale)} ·{" "}
                            {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
                          </div>

                          <div
                            className={`mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${
                              found.length
                                ? "bg-amber-100 text-amber-800"
                                : "bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            {found.length ? (
                              <>
                                ⚠️ {fmt(t.alerts.nearby, { n: found.length })}
                              </>
                            ) : (
                              <>✅ {t.alerts.quiet}</>
                            )}
                          </div>

                          {found.length > 0 && (
                            <ul className="mt-3 space-y-1">
                              {found.slice(0, 4).map((r) => (
                                <li
                                  key={r.id}
                                  className="flex items-center gap-2 text-xs font-semibold text-ink-soft"
                                >
                                  <span aria-hidden>
                                    {r.kind === "water" && r.level
                                      ? LEVEL_EMOJI[r.level]
                                      : KIND_EMOJI[r.kind]}
                                  </span>
                                  <span className="truncate">
                                    {r.address ?? t.report.kinds[r.kind].title}
                                  </span>
                                  <span className="shrink-0 tabular-nums">
                                    {formatDistance(
                                      distanceM(p.lat, p.lng, r.lat, r.lng),
                                      locale,
                                    )}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <button
                          onClick={() => setPlaces(removePlace(p.id))}
                          className="shrink-0 rounded-full p-2 text-ink-soft transition-colors hover:bg-red-50 hover:text-alert"
                          aria-label={t.alerts.remove}
                        >
                          🗑️
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {!adding && (
                <button
                  onClick={() => setAdding(true)}
                  className="btn btn-ghost w-full py-4 text-sm"
                >
                  ➕ {t.alerts.addTitle}
                </button>
              )}
            </div>
          )}

          {/* Форма добавления */}
          <AnimatePresence>
            {adding && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="card mt-4 space-y-4 p-5"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-extrabold">{t.alerts.addTitle}</h2>
                  <button
                    onClick={() => setAdding(false)}
                    className="rounded-full bg-water-50 px-3 py-1 text-xs font-bold text-ink-soft"
                  >
                    {t.common.cancel}
                  </button>
                </div>

                <div>
                  <label className="kicker !text-[0.62rem]">
                    {t.alerts.label}
                  </label>
                  <div className="mt-2 flex gap-2">
                    <div className="no-scrollbar flex gap-1 overflow-x-auto">
                      {PLACE_EMOJI.map((e) => (
                        <button
                          key={e}
                          onClick={() => setEmoji(e)}
                          className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-xl transition-all ${
                            emoji === e
                              ? "bg-water-500 scale-105"
                              : "bg-water-50 hover:bg-water-100"
                          }`}
                        >
                          <span aria-hidden>{e}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    value={label}
                    onChange={(e) => setLabel(e.target.value.slice(0, 40))}
                    placeholder={t.alerts.labelPlaceholder}
                    className="mt-2 w-full rounded-2xl border border-water-100 bg-water-50/50 px-4 py-3 text-sm outline-none focus:border-water-400 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="kicker !text-[0.62rem]">
                    {t.common.search}
                  </label>
                  <div className="relative mt-2">
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={t.alerts.searchPlaceholder}
                      className="w-full rounded-2xl border border-water-100 bg-water-50/50 px-4 py-3 pr-10 text-sm outline-none focus:border-water-400 focus:bg-white"
                    />
                    <span className="absolute top-1/2 right-3 -translate-y-1/2 text-sm">
                      {searching ? "⏳" : "🔍"}
                    </span>
                  </div>
                  {results.length > 0 && (
                    <ul className="mt-2 space-y-1 rounded-2xl border border-water-100 p-1">
                      {results.map((r, i) => (
                        <li key={`${r.lat}-${r.lng}-${i}`}>
                          <button
                            onClick={() => {
                              setPoint({ lat: r.lat, lng: r.lng });
                              setMapCenter({ lat: r.lat, lng: r.lng });
                              setResults([]);
                              setQuery(r.label);
                            }}
                            className="w-full rounded-xl px-3 py-2 text-left text-xs font-semibold hover:bg-water-50"
                          >
                            📍 {r.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <button
                  onClick={async () => {
                    const pos = await locate();
                    if (pos) {
                      setPoint({ lat: pos.lat, lng: pos.lng });
                      setMapCenter({ lat: pos.lat, lng: pos.lng });
                    }
                  }}
                  className="btn btn-ghost w-full py-3 text-sm"
                >
                  {locating ? "⏳" : "🎯"} {t.alerts.useLocation}
                </button>

                <div className="overflow-hidden rounded-2xl border border-water-100">
                  <FloodMap
                    className="h-56 w-full"
                    reports={[]}
                    pickMode
                    center={mapCenter}
                    zoom={15}
                    watchAreas={[
                      { ...point, radiusM: radius, label: label || "—" },
                    ]}
                    onPickMove={(lat, lng) => setPoint({ lat, lng })}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="kicker !text-[0.62rem]">
                      {t.alerts.radius}
                    </label>
                    <span className="text-sm font-extrabold text-water-700">
                      {formatDistance(radius, locale)}
                    </span>
                  </div>
                  <div className="mt-2 flex gap-1.5">
                    {RADII.map((r) => (
                      <button
                        key={r}
                        onClick={() => setRadius(r)}
                        className={`flex-1 rounded-xl py-2 text-xs font-bold transition-colors ${
                          radius === r
                            ? "bg-water-500 text-white"
                            : "bg-water-50 text-ink-soft hover:bg-water-100"
                        }`}
                      >
                        {formatDistance(r, locale)}
                      </button>
                    ))}
                  </div>
                </div>

                {!insidePilot(point.lat, point.lng) && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
                    ⚠️ {t.report.place.outside}
                  </div>
                )}

                <button
                  onClick={submit}
                  disabled={!insidePilot(point.lat, point.lng)}
                  className="btn btn-primary w-full py-4 text-base"
                >
                  ➕ {t.alerts.add}
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Обзорная карта */}
          {places.length > 0 && !adding && (
            <div className="card mt-4 overflow-hidden">
              <div className="flex items-center justify-between px-5 pt-4 pb-3">
                <span className="kicker !text-[0.62rem]">
                  {fmt(t.alerts.watching, { n: places.length })}
                </span>
                <Link
                  href="/map"
                  className="text-xs font-bold text-water-600 hover:underline"
                >
                  {t.landing.live.openMap} →
                </Link>
              </div>
              <FloodMap
                className="h-72 w-full"
                reports={reports}
                watchAreas={watchAreas}
                userPosition={position}
                showHeat={false}
              />
            </div>
          )}
        </div>
      </main>
    </>
  );
}
