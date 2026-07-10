import { useEffect, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Sector } from "recharts";

import { formatNumber, formatPercent } from "@/lib/mix-data";

export type DonutDatum = { name: string; value: number; fill: string };

/** Realce leve da fatia sob o cursor (sem tooltip flutuante que cobre a tela). */
function ActiveSlice(props: any) {
  const { outerRadius = 0 } = props;
  return <Sector {...props} outerRadius={outerRadius + 5} />;
}

/**
 * Donut padronizado: rosca à esquerda + legenda à direita (empilha no mobile),
 * aproveitando a largura do card. Separadores finos na cor do card e um leitor
 * central que reage ao hover — sem tooltip flutuante sobrepondo a análise.
 */
export function DonutChart({
  data,
  centerLabel,
  size = 184,
}: {
  data: DonutDatum[];
  centerLabel?: string;
  size?: number;
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const [active, setActive] = useState<number | null>(null);

  // Novo recorte de dados → zera o realce.
  useEffect(() => setActive(null), [data]);

  const focus = active != null ? data[active] : null;
  const centerValue = focus ? focus.value : total;
  const centerPct = focus && total ? formatPercent((focus.value / total) * 100) : null;

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:gap-6">
      {/* Rosca + leitor central */}
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="64%"
              outerRadius="92%"
              paddingAngle={1.5}
              stroke="var(--color-card)"
              strokeWidth={2}
              startAngle={90}
              endAngle={-270}
              activeIndex={active ?? undefined}
              activeShape={ActiveSlice}
              onMouseEnter={(_, i) => setActive(i)}
              onMouseLeave={() => setActive(null)}
            >
              {data.map((d, i) => (
                <Cell key={i} fill={d.fill} style={{ outline: "none" }} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 text-center">
          <span className="font-display text-2xl font-bold leading-none tracking-tight tabular-nums text-foreground">
            {formatNumber(centerValue)}
          </span>
          {focus ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <span className="h-2 w-2 rounded-full" style={{ background: focus.fill }} />
              {centerPct}
            </span>
          ) : (
            centerLabel && (
              <span className="font-subtitle text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {centerLabel}
              </span>
            )
          )}
        </div>
      </div>

      {/* Legenda — nome (rótulo), % (dado-chave, fonte display) e total (apoio, sans) */}
      <ul className="w-full flex-1 space-y-1.5">
        {data.map((d, i) => {
          const share = total ? (d.value / total) * 100 : 0;
          return (
            <li
              key={d.name}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              className={`grid cursor-default grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 rounded-md px-1.5 py-1 text-sm transition-colors ${
                active === i ? "bg-muted" : ""
              }`}
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.fill }} />
              <span
                className={`truncate ${active === i ? "font-semibold text-foreground" : "text-muted-foreground"}`}
              >
                {d.name}
              </span>
              <span className="flex items-baseline gap-2">
                <span className="font-display text-sm font-bold tabular-nums text-foreground">
                  {formatPercent(share)}
                </span>
                <span className="font-subtitle text-[11px] font-medium text-muted-foreground">
                  {formatNumber(d.value)}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
