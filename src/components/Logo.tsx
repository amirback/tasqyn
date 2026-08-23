export function Logo({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="tasqyn-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="55%" stopColor="#0ea5e9" />
          <stop offset="100%" stopColor="#0369a1" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="12" fill="url(#tasqyn-logo)" />
      <path
        d="M4 25c4.2 0 4.2-4 8.4-4s4.2 4 8.4 4 4.2-4 8.4-4 4.2 4 8.4 4"
        fill="none"
        stroke="#fff"
        strokeWidth="2.6"
        strokeLinecap="round"
        opacity="0.95"
      />
      <path
        d="M4 32c4.2 0 4.2-4 8.4-4s4.2 4 8.4 4 4.2-4 8.4-4 4.2 4 8.4 4"
        fill="none"
        stroke="#fff"
        strokeWidth="2.6"
        strokeLinecap="round"
        opacity="0.55"
      />
      <circle cx="20" cy="13" r="4.2" fill="#fff" opacity="0.95" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`text-[1.35rem] font-extrabold tracking-[-0.05em] text-ink ${className}`}
    >
      Tasqyn
    </span>
  );
}
