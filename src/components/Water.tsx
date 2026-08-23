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
