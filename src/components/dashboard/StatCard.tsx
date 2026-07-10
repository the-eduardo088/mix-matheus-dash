import type { ReactNode } from "react";

export function StatCard({
  label,
  value,
  hint,
  icon,
  accent,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  accent?: "primary" | "blue" | "success" | "muted";
}) {
  const accentClass =
    accent === "primary"
      ? "text-primary"
      : accent === "blue"
        ? "text-[color:var(--brand-blue)]"
        : accent === "success"
          ? "text-[color:var(--success)]"
          : "text-foreground";
  return (
    <div className="group relative overflow-hidden rounded-2xl border bg-card p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-subtitle text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className={`mt-2 font-display text-3xl font-bold leading-none tracking-tight ${accentClass} font-num`}>
            {value}
          </p>
          {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
        </div>
        {icon && (
          <div className="shrink-0 rounded-xl bg-muted p-2.5 text-muted-foreground">{icon}</div>
        )}
      </div>
    </div>
  );
}
