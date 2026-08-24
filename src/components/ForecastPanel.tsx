"use client";

import { useI18n } from "@/i18n";
import { IconArrowRight } from "./icons";
import type { HydroSnapshot } from "@/lib/types";

/**
 * Прогноз по реке и погоде.
 *
 * Осознанно скучный блок: цифры, откуда они, и крупная пометка, что это
 * расчёт модели. В теме, где по экрану решают, уезжать или нет, приукрашивать
 * прогноз нельзя — если модель ошибётся, доверия не останется ни к чему.
 */

function fmtDate(iso: string, locale: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(
    locale === "en" ? "en-GB" : locale === "kk" ? "kk-KZ" : "ru-RU",
    { day: "numeric", month: "short" },
  );
}

/**
 * График расхода: прошлые две недели сплошной линией, прогноз — пунктиром,
 * между ними вертикаль «сегодня». Никаких осей: важна форма, а не отсчёты.
 */
function Sparkline({ hydro }: { hydro: HydroSnapshot }) {
  const points = hydro.days
    .map((d, i) => ({ i, q: d.discharge }))
    .filter((p): p is { i: number; q: number } => p.q != null);
  if (points.length < 4) return null;

  const today = new Date().toISOString().slice(0, 10);
  const todayIdx = Math.max(
    0,
    hydro.days.findIndex((d) => d.date >= today),
  );

  const W = 320;
  const H = 72;
  const qs = points.map((p) => p.q);
  const min = Math.min(...qs);
  const max = Math.max(...qs);
  const span = Math.max(max - min, 1);
  const n = hydro.days.length - 1 || 1;

  const x = (i: number) => (i / n) * W;
  const y = (q: number) => H - 6 - ((q - min) / span) * (H - 14);

  const past = points.filter((p) => p.i <= todayIdx);
  const future = points.filter((p) => p.i >= todayIdx);
  const line = (pts: typeof points) =>
    pts.map((p) => `${x(p.i).toFixed(1)},${y(p.q).toFixed(1)}`).join(" ");

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="mt-3 h-16 w-full"
      preserveAspectRatio="none"
      role="img"
      aria-label={`${hydro.place}: ${Math.round(qs[qs.length - 1])} m3/s`}
    >
      <polyline
        points={line(past)}
        fill="none"
        stroke="var(--color-water-600)"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
      <polyline
        points={line(future)}
        fill="none"
        stroke="var(--color-water-400)"
        strokeWidth="2"
        strokeDasharray="4 3"
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1={x(todayIdx)}
        y1="2"
        x2={x(todayIdx)}
        y2={H - 2}
        stroke="var(--color-water-300)"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function ForecastPanel({
  hydro,
  className = "",
}: {
  hydro: HydroSnapshot | null;
  className?: string;
}) {
  const { t, tp, fmt, locale } = useI18n();
  const outlook = hydro?.outlook ?? null;

  if (!hydro || !outlook) {
    return (
      <div className={`card p-6 ${className}`}>
        <div className="kicker">{t.forecast.kicker}</div>
        <p className="lead mt-2 text-sm">{t.forecast.noData}</p>
      </div>
    );
  }

  const rise = outlook.peakChangePct ?? 0;
  const headline =
    outlook.peakDischarge == null
      ? t.forecast.peakStable
      : rise >= 8
        ? fmt(t.forecast.peakRise, {
            q: Math.round(outlook.peakDischarge),
            pct: rise,
          })
        : rise <= -8
          ? fmt(t.forecast.peakFall, { q: Math.round(outlook.peakDischarge) })
          : t.forecast.peakStable;

  // Апрель — пик половодья в Уральске; вне сезона это стоит сказать прямо,
  // чтобы спокойные цифры не читались как «опасности не бывает».
  const month = new Date().getMonth(); // 0 = январь
  const offSeason = month < 2 || month > 4;

  const metrics = [
    {
      label: t.forecast.rain7,
      value: outlook.precip7d == null ? "—" : `${outlook.precip7d} мм`,
    },
    {
      label: t.forecast.snow7,
      value: outlook.snow7d == null ? "—" : `${outlook.snow7d} см`,
    },
    {
      label: t.forecast.thaw,
      value: String(outlook.thawDays),
      hint: outlook.thawDays > 0 ? t.forecast.thawHint : undefined,
    },
  ];

  return (
    <div className={`card p-6 sm:p-7 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="kicker">{t.forecast.kicker}</div>
        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700">
          {t.forecast.notExact}
        </span>
      </div>

      <p className="mt-3 text-lg leading-snug font-extrabold tracking-[-0.02em]">
        {headline}
      </p>
      {outlook.peakDate && Math.abs(rise) >= 8 && (
        <p className="lead mt-1 text-xs">
          {fmt(t.forecast.peakOn, { date: fmtDate(outlook.peakDate, locale) })}
        </p>
      )}

      <Sparkline hydro={hydro} />

      {/* Где река относительно самой себя — и факт по перцентилю рядом */}
      <div className="mt-3 rounded-2xl bg-water-50/70 p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm font-extrabold text-water-800">
            {t.hydro.flood[hydro.floodBand]}
          </span>
          <span className="text-[10px] font-semibold text-ink-soft">
            {fmt(t.hydro.floodHint, {
              from: hydro.referencePeriod.from,
              to: hydro.referencePeriod.to,
            })}
          </span>
        </div>
        {hydro.percentile != null && hydro.recordForDate != null && (
          <p className="mt-1.5 text-[11px] leading-snug text-ink-soft">
            {fmt(t.hydro.percentileLine, {
              p: hydro.percentile,
              from: hydro.referencePeriod.from,
              to: hydro.referencePeriod.to,
              max: Math.round(hydro.recordForDate),
            })}
          </p>
        )}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-2xl bg-water-50/70 p-3">
            <div className="text-lg font-extrabold text-water-800 tabular-nums">
              {m.value}
            </div>
            <div className="mt-0.5 text-[10px] leading-tight font-semibold text-ink-soft">
              {m.label}
            </div>
          </div>
        ))}
      </div>
      {outlook.thawDays > 0 && (
        <p className="lead mt-2 text-[11px]">{t.forecast.thawHint}</p>
      )}

      {/* Что идёт сверху */}
      <div className="mt-5 border-t border-water-100 pt-4">
        <div className="kicker !text-[0.62rem]">{t.forecast.upstream}</div>
        <p className="lead mt-1.5 text-[11px]">{t.forecast.upstreamHint}</p>

        <ul className="mt-3 space-y-1.5">
          {outlook.upstream.map((u) => (
            <li
              key={u.key}
              className="flex items-center gap-3 rounded-2xl bg-water-50/60 px-3 py-2"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold">
                  {tp(`forecast.points.${u.key}`)}
                </span>
                <span className="block text-[10px] font-semibold text-ink-soft">
                  {fmt(t.forecast.km, { n: u.distanceKm })}
                </span>
              </span>
              <span className="text-right">
                <span className="block text-sm font-extrabold text-water-800 tabular-nums">
                  {u.discharge == null ? "—" : Math.round(u.discharge)}{" "}
                  <span className="text-[10px] font-semibold text-ink-soft">
                    {t.hydro.unit}
                  </span>
                </span>
                {/*
                  Раньше здесь стояло отклонение от медианы дня. В межень
                  оно трёхзначное и красное — рядом со словом «межень» это
                  читалось как тревога на ровном месте.
                */}
                <span
                  className={`block text-[10px] font-bold ${
                    u.floodBand === "high" || u.floodBand === "severe"
                      ? "text-warn"
                      : "text-ink-soft"
                  }`}
                >
                  {t.hydro.flood[u.floodBand]} · {t.hydro.trend[u.trend]}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {offSeason && (
        <p className="lead mt-4 text-[11px]">{t.forecast.offSeason}</p>
      )}

      <p className="mt-4 rounded-2xl bg-water-50 p-3 text-[11px] leading-relaxed text-ink-soft">
        {t.forecast.disclaimer}
      </p>

      {/*
        Ссылки на официальные источники. У Казгидромета нет открытого API —
        портал data.egov.kz выдаёт ключ только через личный кабинет, а карту
        постов крутит Shiny поверх websocket. Тянуть её скрейпингом в сервис,
        по которому решают, эвакуироваться ли, нельзя: сломается молча и
        соврёт. Поэтому не притворяемся, что интегрировались, а отправляем
        человека к первоисточнику в одно касание.
      */}
      <div className="mt-4 border-t border-water-100 pt-4">
        <div className="kicker !text-[0.62rem]">{t.forecast.official}</div>
        <p className="lead mt-1.5 text-[11px]">{t.forecast.officialHint}</p>
        <ul className="mt-3 space-y-1.5">
          {[
            {
              href: "http://ecodata.kz:3838/app_dg_map_ru/",
              title: t.forecast.officialKazhydromet,
              hint: t.forecast.officialKazhydrometHint,
            },
            {
              href: "https://www.gov.kz/memleket/entities/emer?lang=ru",
              title: t.forecast.officialEmer,
              hint: t.forecast.officialEmerHint,
            },
          ].map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                target="_blank"
                rel="noreferrer noopener"
                className="flex min-h-11 items-center gap-2 rounded-2xl bg-water-50/60 px-3 py-2 transition-colors hover:bg-water-100"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-bold">{l.title}</span>
                  <span className="block text-[10px] font-semibold text-ink-soft">
                    {l.hint}
                  </span>
                </span>
                <IconArrowRight className="h-4 w-4 shrink-0 text-water-500" />
              </a>
            </li>
          ))}
          <li>
            <a
              href="tel:112"
              className="flex min-h-11 items-center gap-2 rounded-2xl bg-red-50 px-3 py-2"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold text-red-700">112</span>
                <span className="block text-[10px] font-semibold text-red-600/80">
                  {t.forecast.officialCall}
                </span>
              </span>
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
}
