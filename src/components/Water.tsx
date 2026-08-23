"use client";

import { motion, useReducedMotion } from "motion/react";

/** Мягкие пятна света — «толща воды» за содержимым страницы. */
export function WaterBlobs({ className = "" }: { className?: string }) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      aria-hidden
    >
      <div
        className="blob animate-drift"
        style={{
          width: "46rem",
          height: "46rem",
          top: "-18rem",
          left: "-12rem",
          background:
            "radial-gradient(circle, rgba(56,189,248,0.55), transparent 68%)",
        }}
      />
      <div
        className="blob animate-drift"
        style={{
          width: "38rem",
          height: "38rem",
          top: "8rem",
          right: "-14rem",
          animationDelay: "-8s",
          background:
            "radial-gradient(circle, rgba(14,165,233,0.42), transparent 68%)",
        }}
      />
      <div
        className="blob animate-drift"
        style={{
          width: "32rem",
          height: "32rem",
          bottom: "-14rem",
          left: "28%",
          animationDelay: "-15s",
          background:
            "radial-gradient(circle, rgba(125,211,252,0.5), transparent 68%)",
        }}
      />
    </div>
  );
}

/**
 * Волна-разделитель между секциями. Два слоя едут с разной скоростью —
 * этого достаточно, чтобы граница «дышала», не отвлекая от текста.
 */
export function WaveDivider({
  flip = false,
  className = "",
  color = "#ffffff",
}: {
  flip?: boolean;
  className?: string;
  color?: string;
}) {
  const reduced = useReducedMotion();
  const path =
    "M0,40 C160,90 320,-10 480,40 C640,90 800,-10 960,40 C1120,90 1280,-10 1440,40 L1440,120 L0,120 Z";

  return (
    <div
      className={`pointer-events-none relative h-16 w-full overflow-hidden sm:h-24 ${className}`}
      style={{ transform: flip ? "rotate(180deg)" : undefined }}
      aria-hidden
    >
      <svg
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-[200%]"
      >
        <motion.g
          animate={reduced ? undefined : { x: [0, -1440] }}
          transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
        >
          <path d={path} fill={color} opacity="0.55" />
          <path d={path} fill={color} opacity="0.55" transform="translate(1440)" />
        </motion.g>
      </svg>
      <svg
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-[200%]"
      >
        <motion.g
          animate={reduced ? undefined : { x: [0, -1440] }}
          transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
        >
          <path d={path} fill={color} transform="translate(0,12)" />
          <path d={path} fill={color} transform="translate(1440,12)" />
        </motion.g>
      </svg>
    </div>
  );
}

/** Плавающая карточка с живой цифрой для героя. */
export function FloatCard({
  label,
  value,
  dotColor,
  className = "",
  delay = 0,
}: {
  label: string;
  value?: string;
  /** Цветная точка — когда значение само по себе статус, а не число. */
  dotColor?: string;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 24 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] }}
      className={`absolute ${className}`}
    >
      <div className="animate-float">
        <div className="glass flex items-center gap-3 rounded-3xl px-4 py-3 text-left">
          <span
            className="h-8 w-1 shrink-0 rounded-full"
            style={{ background: dotColor ?? "var(--color-water-400)" }}
            aria-hidden
          />
          <div>
            <div className="text-[10px] font-bold tracking-wide text-ink-soft uppercase">
              {label}
            </div>
            {value && (
              <div
                className="text-sm font-extrabold sm:text-base"
                style={{ color: dotColor }}
              >
                {value}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
