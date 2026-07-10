import type { ReactNode } from "react";

type Accent = "primary" | "blue" | "success" | "violet" | "amber" | "muted";

// Cada KPI tem sua cor: valor tingido + chip do ícone na mesma cor.
const ACCENTS: Record<Accent, { text: string; chip: string }> = {
  primary: { text: "text-primary", chip: "bg-primary/10 text-primary" },
  blue: {
    text: "text-[color:var(--brand-blue)]",
    chip: "bg-[color:var(--brand-blue)]/12 text-[color:var(--brand-blue)]",
  },
  success: {
    text: "text-[color:var(--success)]",
    chip: "bg-[color:var(--success)]/12 text-[color:var(--success)]",
  },
  violet: {
    text: "text-[color:var(--color-chart-5)]",
    chip: "bg-[color:var(--color-chart-5)]/12 text-[color:var(--color-chart-5)]",
  },
  amber: {
    text: "text-[color:var(--color-chart-3)]",
    chip: "bg-[color:var(--color-chart-3)]/14 text-[color:var(--color-chart-3)]",
  },
  muted: { text: "text-foreground", chip: "bg-muted text-muted-foreground" },
};

export function StatCard({
  label,
  value,
  hint,
  icon,
  accent = "muted",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  accent?: Accent;
}) {
  const a = ACCENTS[accent];
  return (
    <div className="print-card group relative overflow-hidden rounded-2xl border bg-card p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-subtitle text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p
            className={`mt-2 font-display text-3xl font-bold leading-none tracking-tight ${a.text} font-num`}
          >
            {value}
          </p>
          {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
        </div>
        {icon && <div className={`shrink-0 rounded-xl p-2.5 ${a.chip}`}>{icon}</div>}
      </div>
    </div>
  );
}
