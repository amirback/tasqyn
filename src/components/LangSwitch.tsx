"use client";

import { motion } from "motion/react";
import { useId } from "react";
import { LOCALES, useI18n, type Locale } from "@/i18n";

const SHORT: Record<Locale, string> = { ru: "RU", kk: "ҚАЗ", en: "EN" };

/** Переключатель языка. Три языка помещаются в один ряд — меню не нужно. */
export function LangSwitch({
  compact = false,
  tone = "light",
}: {
  compact?: boolean;
  /** `dark` — для тёмного фона: на нём светлая подложка теряет контраст. */
  tone?: "light" | "dark";
}) {
  const { locale, setLocale } = useI18n();
  // Переключатель стоит и в шапке, и в подвале. Общий layoutId склеил бы их
  // в один «переезжающий» элемент, и в шапке подсветка бы просто исчезла.
  const pillId = useId();

  const dark = tone === "dark";

  return (
    <div
      className={`relative flex items-center gap-0.5 rounded-full border p-1 ${
        compact ? "text-[11px]" : "text-xs"
      } ${
        dark
          ? "border-white/15 bg-white/5"
          : "border-water-100 bg-white/70"
      }`}
      role="group"
      aria-label="Язык"
    >
      {LOCALES.map((l) => (
        <button
          key={l}
          onClick={() => setLocale(l)}
          className={`relative rounded-full px-2.5 py-1 font-bold transition-colors ${
            locale === l
              ? "text-white"
              : dark
                ? "text-water-200/70 hover:text-white"
                : "text-ink-soft hover:text-water-700"
          }`}
          aria-pressed={locale === l}
        >
          {locale === l && (
            <motion.span
              layoutId={`lang-pill-${pillId}`}
              initial={false}
              className="absolute inset-0 rounded-full bg-water-500"
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
            />
          )}
          <span className="relative z-10">{SHORT[l]}</span>
        </button>
      ))}
    </div>
  );
}
