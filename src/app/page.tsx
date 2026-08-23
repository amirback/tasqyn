"use client";

import Link from "next/link";
import { useRef, type ComponentType } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { useI18n } from "@/i18n";
import { useLive } from "@/hooks/useLive";
import { Nav, MobileTabs } from "@/components/Nav";
import { Logo, Wordmark } from "@/components/Logo";
import { LangSwitch } from "@/components/LangSwitch";
import {
  Counter,
  Magnetic,
  Marquee,
  Reveal,
  RevealWords,
  SmoothScroll,
  Tilt,
} from "@/components/motion";
import { FloatCard, WaterBlobs, WaveDivider } from "@/components/Water";
import {
  IconAlert,
  IconArrowDown,
  IconBolt,
  IconCamera,
  IconChart,
  IconClock,
  IconDrop,
  IconHome,
  IconLayers,
  IconMap,
  IconPin,
  IconRoad,
  IconSearch,
  IconShield,
  IconSos,
  IconUsers,
} from "@/components/icons";
import { RISK_COLOR } from "@/lib/risk";
import { KIND_EMOJI, LEVEL_EMOJI } from "@/lib/types";

type Icon = ComponentType<{ className?: string }>;

/* Иконки привязаны к порядку пунктов в словаре — так их не приходится
   дублировать в трёх переводах. */
const PROBLEM_ICONS: Icon[] = [IconChart, IconClock, IconRoad, IconSos];
const HOW_ICONS: Icon[] = [IconPin, IconLayers, IconCamera];
const TRUST_ICONS: Icon[] = [IconUsers, IconSearch, IconShield];
const DATA_ICONS: Icon[] = [IconChart, IconDrop, IconMap];
const WHY_ICONS: Icon[] = [IconBolt, IconPin, IconUsers, IconShield];
const AUDIENCE_ICONS: Icon[] = [IconHome, IconAlert, IconUsers];

export default function Home() {
  const { t } = useI18n();
  const { data } = useLive({ period: "24h", pollMs: 60000 });
  const heroRef = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 140]);
  const heroFade = useTransform(scrollYProgress, [0, 0.75], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 1.08]);

  const stats = data?.stats;
  const risk = data?.risk;
  const hydro = data?.hydro;

  return (
    <SmoothScroll>
      <Nav transparent />
      <MobileTabs />

      <main className="overflow-clip">
        {/* ─── Герой ─────────────────────────────────────── */}
        <section
          ref={heroRef}
          className="relative flex min-h-dvh items-center justify-center px-5 pt-28 pb-24"
        >
          <WaterBlobs />
          <div className="grid-paper absolute inset-0" aria-hidden />

          <motion.div
            style={{ y: heroY, opacity: heroFade, scale: heroScale }}
            className="relative z-10 mx-auto w-full max-w-4xl text-center"
          >
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="mb-7 inline-flex items-center gap-2 rounded-full border border-water-200 bg-white/70 px-4 py-1.5 text-xs font-bold text-water-700 backdrop-blur"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-water-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-water-500" />
              </span>
              {t.landing.badge}
            </motion.div>

            <h1 className="display text-[3rem] leading-[0.92] sm:text-[4.5rem] lg:text-[5.75rem]">
              <RevealWords text={t.landing.title} immediate />{" "}
              <span className="text-water">
                <RevealWords
                  text={t.landing.titleAccent}
                  delay={0.18}
                  immediate
                />
              </span>
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.45 }}
              className="lead mx-auto mt-7 max-w-2xl text-base sm:text-xl"
            >
              {t.landing.subtitle}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.6 }}
              className="mt-10 flex flex-wrap items-center justify-center gap-3"
            >
              <Magnetic>
                <Link
                  href="/map"
                  className="btn btn-primary px-8 py-4 text-base sm:text-lg"
                >
                  {t.landing.ctaMap}
                </Link>
              </Magnetic>
              <Magnetic strength={0.22}>
                <Link
                  href="/report"
                  className="btn btn-ghost px-8 py-4 text-base sm:text-lg"
                >
                  {t.landing.ctaReport}
                </Link>
              </Magnetic>
            </motion.div>

            {/* Плавающие карточки — на широком экране */}
            <div className="pointer-events-none absolute inset-0 hidden lg:block">
              <FloatCard
                label={t.risk.title}
                value={risk ? t.risk.levels[risk.level] : "—"}
                dotColor={risk ? RISK_COLOR[risk.level] : undefined}
                className="-top-4 -left-24"
                delay={0.8}
              />
              <FloatCard
                label={t.landing.live.active}
                value={String(stats?.active ?? 0)}
                className="top-32 -right-28"
                delay={0.95}
              />
              <FloatCard
                label={t.landing.live.roads}
                value={String(stats?.roadsBlocked ?? 0)}
                className="-bottom-8 -left-16"
                delay={1.1}
              />
              <FloatCard
                label={t.landing.live.river}
                value={
                  hydro?.discharge != null
                    ? `${Math.round(hydro.discharge)} ${t.hydro.unit}`
                    : "—"
                }
                className="-bottom-4 lg:-right-10"
                delay={1.25}
              />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.4 }}
            className="absolute bottom-24 left-1/2 z-10 -translate-x-1/2 md:bottom-10"
          >
            <div className="flex flex-col items-center gap-2 text-[10px] font-bold tracking-[0.2em] text-ink-soft uppercase">
              {t.landing.scroll}
              <IconArrowDown className="animate-bob h-4 w-4" />
            </div>
          </motion.div>
        </section>

        {/* ─── Бегущая строка ────────────────────────────── */}
        <section className="border-y border-water-100 bg-white/60">
          <Marquee items={t.landing.ticker} />
        </section>

        {/* ─── Живые цифры ───────────────────────────────── */}
        <section className="relative px-5 py-24 sm:py-32">
          <div className="mx-auto max-w-6xl">
            <Reveal className="mx-auto max-w-2xl text-center">
              <div className="kicker mb-4">{t.landing.live.kicker}</div>
              <h2 className="headline text-4xl sm:text-5xl">
                {t.landing.live.title}
              </h2>
              <p className="lead mt-5">{t.landing.live.lead}</p>
            </Reveal>

            <div className="mt-14 grid grid-cols-2 gap-4 lg:grid-cols-4">
              {[
                { label: t.landing.live.reports, value: stats?.total ?? 0 },
                { label: t.landing.live.active, value: stats?.active ?? 0 },
                { label: t.landing.live.confirmed, value: stats?.confirmed ?? 0 },
                { label: t.landing.live.roads, value: stats?.roadsBlocked ?? 0 },
              ].map((item, i) => (
                <Reveal key={item.label} delay={i * 0.08}>
                  <Tilt className="card card-hover h-full p-6 text-center sm:p-8">
                    <div className="text-5xl font-extrabold tracking-[-0.05em] text-water-700 tabular-nums sm:text-6xl">
                      <Counter value={item.value} />
                    </div>
                    <div className="lead mt-3 text-xs font-semibold sm:text-sm">
                      {item.label}
                    </div>
                  </Tilt>
                </Reveal>
              ))}
            </div>

            {/* Уровень тревоги + река */}
            <Reveal delay={0.15} className="mt-6">
              <div className="card grid gap-6 p-7 sm:p-9 lg:grid-cols-[1.1fr_1fr]">
                <div>
                  <div className="kicker">{t.risk.title}</div>
                  <div className="mt-1 flex items-center gap-2.5">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{
                        background: risk ? RISK_COLOR[risk.level] : "#cbd5e1",
                      }}
                    />
                    <span
                      className="text-2xl font-extrabold tracking-[-0.03em]"
                      style={{ color: risk ? RISK_COLOR[risk.level] : undefined }}
                    >
                      {risk ? t.risk.levels[risk.level] : t.common.loading}
                    </span>
                  </div>

                  <div className="mt-5 h-2.5 w-full overflow-hidden rounded-full bg-water-50">
                    <motion.div
                      className="h-full rounded-full"
                      style={{
                        background: risk ? RISK_COLOR[risk.level] : "#0ea5e9",
                      }}
                      initial={{ width: 0 }}
                      animate={{ width: `${risk?.score ?? 0}%` }}
                      transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </div>

                  <ul className="mt-5 space-y-1.5">
                    {risk?.reasons.slice(0, 4).map((r) => (
                      <li
                        key={r}
                        className="lead flex items-start gap-2 text-sm"
                      >
                        <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-water-400" />
                        <RiskReason path={r} />
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-3xl bg-gradient-to-br from-water-50 to-white p-6 ring-1 ring-water-100">
                  <div className="kicker">{t.hydro.title}</div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-4xl font-extrabold tracking-[-0.04em] text-water-700 tabular-nums">
                      {hydro?.discharge != null ? (
                        <Counter value={Math.round(hydro.discharge)} />
                      ) : (
                        "—"
                      )}
                    </span>
                    <span className="text-sm font-bold text-ink-soft">
                      {t.hydro.unit}
                    </span>
                  </div>
                  <div className="lead mt-3 space-y-1 text-sm">
                    <div>
                      {t.hydro.normal}:{" "}
                      <b className="text-ink">
                        {hydro?.normal != null
                          ? Math.round(hydro.normal)
                          : "—"}{" "}
                        {t.hydro.unit}
                      </b>
                    </div>
                    <div>
                      {t.hydro.anomaly}:{" "}
                      <b
                        className={
                          (hydro?.anomalyPct ?? 0) > 20
                            ? "text-warn"
                            : "text-safe"
                        }
                      >
                        {hydro?.anomalyPct != null
                          ? `${hydro.anomalyPct > 0 ? "+" : ""}${hydro.anomalyPct}%`
                          : "—"}
                      </b>{" "}
                      · {hydro ? t.hydro.trend[hydro.trend] : "—"}
                    </div>
                  </div>
                  <div className="mt-4 text-[10px] font-semibold text-ink-soft/70">
                    {t.hydro.source}
                  </div>
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.2} className="mt-8 text-center">
              <Magnetic>
                <Link href="/map" className="btn btn-primary px-7 py-3.5">
                  {t.landing.live.openMap}
                </Link>
              </Magnetic>
            </Reveal>
          </div>
        </section>

        {/* ─── Проблема ──────────────────────────────────── */}
        <section className="relative bg-white">
          <WaveDivider color="#f6fbff" flip />
          <div className="mx-auto max-w-6xl px-5 py-20 sm:py-28">
            <Reveal className="max-w-3xl">
              <div className="kicker mb-4">{t.landing.problem.kicker}</div>
              <h2 className="headline text-4xl sm:text-5xl lg:text-6xl">
                {t.landing.problem.title}
              </h2>
              <p className="lead mt-6 text-lg">{t.landing.problem.lead}</p>
            </Reveal>

            <div className="mt-14 grid gap-4 sm:grid-cols-2">
              {t.landing.problem.items.map((item, i) => {
                const Icon = PROBLEM_ICONS[i] ?? IconAlert;
                return (
                  <Reveal key={item.title} delay={i * 0.08}>
                    <div className="card card-hover group h-full p-7 sm:p-8">
                      <div className="mb-4 inline-grid h-12 w-12 place-items-center rounded-2xl bg-water-50 text-water-600 transition-transform duration-500 group-hover:scale-110">
                        <Icon className="h-6 w-6" />
                      </div>
                      <h3 className="text-xl font-extrabold tracking-[-0.02em]">
                        {item.title}
                      </h3>
                      <p className="lead mt-2.5 text-[0.95rem]">{item.text}</p>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        {/* ─── Как это работает ──────────────────────────── */}
        <section className="relative overflow-hidden bg-gradient-to-b from-water-950 to-water-800 text-white">
          <div className="pointer-events-none absolute inset-0 opacity-40" aria-hidden>
            <div
              className="blob animate-drift"
              style={{
                width: "40rem",
                height: "40rem",
                top: "-10rem",
                right: "-10rem",
                background:
                  "radial-gradient(circle, rgba(56,189,248,0.6), transparent 70%)",
              }}
            />
          </div>

          <div className="relative mx-auto max-w-6xl px-5 py-24 sm:py-32">
            <Reveal className="max-w-3xl">
              <div className="kicker mb-4 !text-water-300">
                {t.landing.how.kicker}
              </div>
              <h2 className="headline text-4xl sm:text-5xl lg:text-6xl">
                {t.landing.how.title}
              </h2>
              <p className="mt-6 text-lg leading-relaxed text-water-100/80">
                {t.landing.how.lead}
              </p>
            </Reveal>

            <div className="mt-16 grid items-center gap-12 lg:grid-cols-[1fr_auto]">
              <div className="space-y-4">
                {t.landing.how.steps.map((step, i) => {
                  const Icon = HOW_ICONS[i] ?? IconPin;
                  return (
                    <Reveal key={step.title} delay={i * 0.1}>
                      <div className="flex gap-5 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur transition-colors duration-500 hover:border-water-300/40 hover:bg-white/10">
                        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/10 text-water-200">
                          <Icon className="h-6 w-6" />
                        </div>
                        <div>
                          <div className="text-xs font-bold tracking-[0.18em] text-water-300 uppercase">
                            {String(i + 1).padStart(2, "0")}
                          </div>
                          <h3 className="mt-1 text-xl font-extrabold tracking-[-0.02em]">
                            {step.title}
                          </h3>
                          <p className="mt-2 text-[0.95rem] leading-relaxed text-water-100/75">
                            {step.text}
                          </p>
                        </div>
                      </div>
                    </Reveal>
                  );
                })}
              </div>

              <Reveal delay={0.2} className="mx-auto">
                <PhoneMock />
              </Reveal>
            </div>

            <Reveal delay={0.25}>
              <div className="mt-14 rounded-3xl border border-water-300/30 bg-water-500/15 p-7 text-center backdrop-blur sm:p-9">
                <span className="text-lg font-bold tracking-[-0.01em] text-water-50 sm:text-xl">
                  {t.landing.how.note}
                </span>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ─── Доверие ───────────────────────────────────── */}
        <section className="bg-white px-5 py-24 sm:py-32">
          <div className="mx-auto max-w-6xl">
            <Reveal className="mx-auto max-w-3xl text-center">
              <div className="kicker mb-4">{t.landing.trust.kicker}</div>
              <h2 className="headline text-4xl sm:text-5xl">
                {t.landing.trust.title}
              </h2>
              <p className="lead mt-5 text-lg">{t.landing.trust.lead}</p>
            </Reveal>

            <div className="mt-14 grid gap-4 md:grid-cols-3">
              {t.landing.trust.items.map((item, i) => {
                const Icon = TRUST_ICONS[i] ?? IconUsers;
                return (
                  <Reveal key={item.title} delay={i * 0.08}>
                    <Tilt className="card card-hover h-full p-7 sm:p-8">
                      <div className="mb-4 inline-grid h-12 w-12 place-items-center rounded-2xl bg-water-50 text-water-600">
                        <Icon className="h-6 w-6" />
                      </div>
                      <h3 className="text-lg font-extrabold tracking-[-0.02em]">
                        {item.title}
                      </h3>
                      <p className="lead mt-2.5 text-[0.95rem]">{item.text}</p>
                    </Tilt>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        {/* ─── Источники данных ──────────────────────────── */}
        <section className="relative bg-foam px-5 py-24 sm:py-32">
          <WaterBlobs className="opacity-50" />
          <div className="relative mx-auto max-w-6xl">
            <Reveal className="max-w-3xl">
              <div className="kicker mb-4">{t.landing.data.kicker}</div>
              <h2 className="headline text-4xl sm:text-5xl lg:text-6xl">
                {t.landing.data.title}
              </h2>
              <p className="lead mt-6 text-lg">{t.landing.data.lead}</p>
            </Reveal>

            <div className="mt-14 grid gap-4 md:grid-cols-3">
              {t.landing.data.sources.map((s, i) => {
                const Icon = DATA_ICONS[i] ?? IconChart;
                return (
                  <Reveal key={s.title} delay={i * 0.08}>
                    <div className="card card-hover h-full p-7">
                      <div className="mb-4 inline-grid h-12 w-12 place-items-center rounded-2xl bg-water-50 text-water-600">
                        <Icon className="h-6 w-6" />
                      </div>
                      <h3 className="text-lg font-extrabold tracking-[-0.02em]">
                        {s.title}
                      </h3>
                      <p className="lead mt-2.5 text-[0.95rem]">{s.text}</p>
                      {i === 0 && hydro?.discharge != null && (
                        <div className="mt-5 rounded-2xl bg-water-50 px-4 py-3">
                          <div className="text-[10px] font-bold tracking-widest text-water-600 uppercase">
                            {t.common.updated} ·{" "}
                            {new Date(hydro.updatedAt).toLocaleDateString("ru-RU")}
                          </div>
                          <div className="text-xl font-extrabold text-water-800 tabular-nums">
                            {Math.round(hydro.discharge)} {t.hydro.unit}
                          </div>
                        </div>
                      )}
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        {/* ─── Почему работает ───────────────────────────── */}
        <section className="bg-white px-5 py-24 sm:py-32">
          <div className="mx-auto max-w-6xl">
            <Reveal className="max-w-3xl">
              <div className="kicker mb-4">{t.landing.why.kicker}</div>
              <h2 className="headline text-4xl sm:text-5xl lg:text-6xl">
                {t.landing.why.title}
              </h2>
            </Reveal>

            <div className="mt-14 grid gap-4 sm:grid-cols-2">
              {t.landing.why.items.map((item, i) => {
                const Icon = WHY_ICONS[i] ?? IconBolt;
                return (
                  <Reveal key={item.title} delay={i * 0.07}>
                    <div className="card card-hover group flex h-full gap-5 p-7">
                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-water-500 to-water-700 text-white shadow-[0_10px_24px_-10px_rgba(2,132,199,0.8)] transition-transform duration-500 group-hover:scale-110">
                        <Icon className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="text-lg font-extrabold tracking-[-0.02em]">
                          {item.title}
                        </h3>
                        <p className="lead mt-2 text-[0.95rem]">{item.text}</p>
                      </div>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        {/* ─── Кому ──────────────────────────────────────── */}
        <section className="bg-foam px-5 py-24 sm:py-32">
          <div className="mx-auto max-w-6xl">
            <Reveal className="mx-auto max-w-2xl text-center">
              <div className="kicker mb-4">{t.landing.audience.kicker}</div>
              <h2 className="headline text-4xl sm:text-5xl">
                {t.landing.audience.title}
              </h2>
            </Reveal>
            <div className="mt-14 grid gap-4 md:grid-cols-3">
              {t.landing.audience.items.map((item, i) => {
                const Icon = AUDIENCE_ICONS[i] ?? IconHome;
                return (
                  <Reveal key={item.title} delay={i * 0.08}>
                    <Tilt className="card card-hover h-full p-8 text-center">
                      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-water-50 text-water-600">
                        <Icon className="h-7 w-7" />
                      </div>
                      <h3 className="text-lg font-extrabold tracking-[-0.02em]">
                        {item.title}
                      </h3>
                      <p className="lead mt-2.5 text-[0.95rem]">{item.text}</p>
                    </Tilt>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        {/* ─── Дорожная карта ────────────────────────────── */}
        <section className="relative overflow-hidden bg-white px-5 py-24 sm:py-32">
          <div className="mx-auto max-w-6xl">
            <Reveal className="max-w-2xl">
              <div className="kicker mb-4">{t.landing.roadmap.kicker}</div>
              <h2 className="headline text-4xl sm:text-5xl">
                {t.landing.roadmap.title}
              </h2>
            </Reveal>

            <div className="no-scrollbar mt-14 flex gap-4 overflow-x-auto pb-4 lg:grid lg:grid-cols-4 lg:overflow-visible">
              {t.landing.roadmap.phases.map((p, i) => (
                <Reveal key={p.n} delay={i * 0.09} className="shrink-0">
                  <div
                    className={`card h-full w-[16rem] p-7 lg:w-auto ${
                      i === 0
                        ? "border-water-400 bg-gradient-to-b from-water-50 to-white"
                        : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-water-100 text-xs font-extrabold text-water-700 tabular-nums">
                        {i + 1}
                      </span>
                      <span className="kicker !text-[0.7rem]">{p.n}</span>
                    </div>
                    <h3 className="mt-3 text-xl font-extrabold tracking-[-0.02em]">
                      {p.title}
                    </h3>
                    <p className="lead mt-2 text-[0.9rem]">{p.text}</p>
                    {i === 0 && (
                      <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-water-500 px-3 py-1 text-[10px] font-bold text-white">
                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                        {t.landing.badge}
                      </div>
                    )}
                  </div>
                </Reveal>
              ))}
            </div>

            <Reveal delay={0.2}>
              <p className="lead mt-8 max-w-3xl text-[0.95rem]">
                {t.landing.roadmap.note}
              </p>
            </Reveal>
          </div>
        </section>

        {/* ─── Финальный призыв ──────────────────────────── */}
        <section className="relative overflow-hidden bg-gradient-to-br from-water-600 via-water-700 to-water-900 text-white">
          <WaveDivider color="#ffffff" flip />
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <div
              className="blob animate-drift"
              style={{
                width: "44rem",
                height: "44rem",
                bottom: "-20rem",
                left: "-8rem",
                background:
                  "radial-gradient(circle, rgba(125,211,252,0.5), transparent 70%)",
              }}
            />
          </div>

          <div className="relative mx-auto max-w-4xl px-5 py-28 text-center sm:py-36">
            <Reveal>
              <Logo className="mx-auto mb-7 h-14 w-14" />
              <h2 className="headline text-4xl sm:text-6xl">
                {t.landing.cta.title}
              </h2>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-water-100/85">
                {t.landing.cta.text}
              </p>
              <div className="mt-10 flex flex-wrap justify-center gap-3">
                <Magnetic>
                  <Link
                    href="/map"
                    className="btn bg-white px-8 py-4 text-base text-water-800 shadow-[0_18px_40px_-16px_rgba(0,0,0,0.6)] hover:-translate-y-0.5 sm:text-lg"
                  >
                    {t.landing.cta.button}
                  </Link>
                </Magnetic>
                <Magnetic strength={0.22}>
                  <Link
                    href="/report"
                    className="btn border border-white/30 bg-white/10 px-8 py-4 text-base text-white backdrop-blur hover:bg-white/20 sm:text-lg"
                  >
                    {t.landing.cta.secondary}
                  </Link>
                </Magnetic>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ─── Подвал ────────────────────────────────────── */}
        <footer className="bg-water-950 px-5 pt-16 pb-28 text-water-200/70 md:pb-16">
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-wrap items-start justify-between gap-8">
              <div>
                <div className="flex items-center gap-3">
                  <Logo className="h-10 w-10" />
                  <Wordmark className="!text-white" />
                </div>
                <p className="mt-3 max-w-sm text-sm">{t.brand.tagline}</p>
                <p className="mt-1 text-sm">{t.landing.footer.made}</p>
              </div>

              <div className="flex flex-col gap-3">
                {(
                  [
                    ["/map", t.nav.map],
                    ["/report", t.nav.report],
                    ["/alerts", t.nav.alerts],
                    ["/dashboard", t.nav.dashboard],
                  ] as const
                ).map(([href, label]) => (
                  <Link
                    key={href}
                    href={href}
                    className="text-sm font-semibold hover:text-white"
                  >
                    {label}
                  </Link>
                ))}
              </div>

              <div className="max-w-xs">
                <LangSwitch tone="dark" />
                <div className="mt-5 rounded-2xl border border-alert/40 bg-alert/10 p-4">
                  <div className="text-xs font-bold tracking-widest text-white/80 uppercase">
                    {t.landing.footer.emergency}
                  </div>
                  <a
                    href="tel:112"
                    className="mt-1 block text-3xl font-extrabold text-white"
                  >
                    112
                  </a>
                </div>
              </div>
            </div>

            <div className="mt-12 border-t border-white/10 pt-6 text-xs">
              <p>{t.landing.footer.sources}</p>
              <p className="mt-1.5">{t.landing.footer.disclaimer}</p>
            </div>
          </div>
        </footer>
      </main>
    </SmoothScroll>
  );
}

/** Ключ причины риска приходит строкой — разворачиваем через словарь. */
function RiskReason({ path }: { path: string }) {
  const { tp } = useI18n();
  return <span>{tp(path)}</span>;
}

/**
 * Макет телефона с интерфейсом отправки — показывает продукт, а не описывает.
 * Эмодзи здесь остаются: в живом приложении на этих кнопках ровно они.
 */
function PhoneMock() {
  const { t } = useI18n();
  return (
    <div className="relative w-[16rem] shrink-0 sm:w-[17.5rem]">
      <div className="animate-float-slow">
        <div className="rounded-[2.5rem] border-[10px] border-water-950/60 bg-white p-3 shadow-[0_40px_90px_-30px_rgba(0,0,0,0.8)]">
          <div className="mx-auto mb-3 h-1.5 w-16 rounded-full bg-water-100" />
          <div className="text-center">
            <div className="text-[11px] font-bold text-ink-soft">
              {t.report.title}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {(
              [
                [KIND_EMOJI.water, t.report.kinds.water.title, true],
                [KIND_EMOJI.road, t.report.kinds.road.title, false],
                [KIND_EMOJI.help, t.report.kinds.help.title, false],
                [KIND_EMOJI.safe, t.report.kinds.safe.title, false],
              ] as const
            ).map(([emoji, label, active]) => (
              <div
                key={label}
                className={`rounded-2xl p-3 text-center ${
                  active
                    ? "bg-water-500 text-white shadow-[0_10px_24px_-10px_rgba(2,132,199,0.9)]"
                    : "bg-water-50 text-ink"
                }`}
              >
                <div className="text-2xl" aria-hidden>
                  {emoji}
                </div>
                <div className="mt-1 text-[10px] font-bold">{label}</div>
              </div>
            ))}
          </div>

          <div className="mt-3 space-y-1.5">
            {(
              [
                [LEVEL_EMOJI[1], t.report.levels.l1.title],
                [LEVEL_EMOJI[2], t.report.levels.l2.title],
                [LEVEL_EMOJI[3], t.report.levels.l3.title],
              ] as const
            ).map(([emoji, label], i) => (
              <div
                key={label}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-semibold ${
                  i === 1
                    ? "bg-water-100 text-water-800 ring-2 ring-water-400"
                    : "bg-water-50/60 text-ink-soft"
                }`}
              >
                <span aria-hidden>{emoji}</span>
                {label}
              </div>
            ))}
          </div>

          <div className="mt-3 rounded-full bg-gradient-to-b from-water-500 to-water-600 py-2.5 text-center text-[11px] font-extrabold text-white">
            {t.report.submit}
          </div>
        </div>
      </div>
    </div>
  );
}
