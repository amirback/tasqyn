"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useMotionValueEvent, useScroll } from "motion/react";
import { useState, type ComponentType } from "react";
import { useI18n } from "@/i18n";
import { LangSwitch } from "./LangSwitch";
import { Logo, Wordmark } from "./Logo";
import { IconBell, IconDrop, IconHome, IconMap } from "./icons";

type NavKey = "home" | "map" | "report" | "alerts";

const LINKS: { href: string; key: NavKey }[] = [
  { href: "/map", key: "map" },
  { href: "/report", key: "report" },
  { href: "/alerts", key: "alerts" },
];

export function Nav({ transparent = false }: { transparent?: boolean }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (v) => setScrolled(v > 24));

  const solid = !transparent || scrolled;

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-x-0 top-0 z-[100] px-3 pt-3 sm:px-5 sm:pt-4"
    >
      <nav
        className={`mx-auto flex max-w-6xl items-center justify-between gap-3 rounded-full py-2 pr-2 pl-3 transition-all duration-500 sm:pl-4 ${
          solid ? "glass" : "border border-transparent bg-transparent"
        }`}
      >
        <Link
          href="/"
          className="flex min-h-9 shrink-0 items-center gap-2.5"
          aria-label="Tasqyn"
        >
          <Logo className="h-9 w-9" />
          <Wordmark className="hidden sm:inline" />
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => {
            const active = pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`relative rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  active ? "text-water-800" : "text-ink-soft hover:text-water-700"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    initial={false}
                    className="absolute inset-0 rounded-full bg-water-50"
                    transition={{ type: "spring", stiffness: 400, damping: 34 }}
                  />
                )}
                <span className="relative z-10">{t.nav[l.key]}</span>
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <LangSwitch compact />
          <Link
            href="/report"
            className="btn btn-primary px-4 py-2 text-sm sm:px-5"
          >
            {t.nav.report}
          </Link>
        </div>
      </nav>
    </motion.header>
  );
}

/** Нижняя панель на телефоне: в паводок человек держит телефон одной рукой. */
export function MobileTabs() {
  const { t } = useI18n();
  const pathname = usePathname();

  const tabs: {
    href: string;
    key: NavKey;
    Icon: ComponentType<{ className?: string }>;
    accent: boolean;
  }[] = [
    { href: "/", key: "home", Icon: IconHome, accent: false },
    { href: "/map", key: "map", Icon: IconMap, accent: false },
    { href: "/report", key: "report", Icon: IconDrop, accent: true },
    { href: "/alerts", key: "alerts", Icon: IconBell, accent: false },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-[100] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
      <div className="glass mx-auto flex max-w-md items-center justify-around rounded-full p-1.5">
        {tabs.map(({ href, key, Icon, accent }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex min-w-16 flex-col items-center gap-1 rounded-full px-3 py-2 text-[10px] font-bold transition-colors ${
                accent ? "text-white" : active ? "text-water-700" : "text-ink-soft"
              }`}
            >
              {accent && (
                <span className="absolute inset-0 rounded-full bg-gradient-to-b from-water-500 to-water-600 shadow-[0_8px_20px_-8px_rgba(2,132,199,0.9)]" />
              )}
              {!accent && active && (
                <motion.span
                  layoutId="tab-pill"
                  initial={false}
                  className="absolute inset-0 rounded-full bg-water-50"
                  transition={{ type: "spring", stiffness: 400, damping: 34 }}
                />
              )}
              <Icon className="relative z-10 h-5 w-5" />
              <span className="relative z-10">{t.nav[key]}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
