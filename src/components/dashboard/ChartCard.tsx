import type { ReactNode } from "react";

export function ChartCard({
  title,
  subtitle,
  icon,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`print-card flex flex-col rounded-2xl border bg-card p-5 shadow-sm ${className ?? ""}`}
    >
      <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-base font-semibold tracking-tight text-foreground">
            {title}
          </h3>
          {subtitle && (
            <p className="font-subtitle mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div className="shrink-0 rounded-lg bg-muted p-2 text-muted-foreground">{icon}</div>
        )}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}
