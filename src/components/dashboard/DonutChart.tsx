import { useEffect, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Sector } from "recharts";

import { formatNumber } from "@/lib/mix-data";

export type DonutDatum = { name: string; value: number; fill: string };

/** Realce leve da fatia sob o cursor (sem tooltip flutuante que cobre a tela). */
function ActiveSlice(props: any) {
  const { outerRadius = 0 } = props;
  return <Sector {...props} outerRadius={outerRadius + 5} />;
}

/**
 * Donut padronizado: separadores finos na cor do card (sem contornos brancos),
 * e um LEITOR central interativo. Ao passar o mouse numa fatia, o centro mostra
 * aquela fatia — nada de tooltip flutuante sobrepondo o restante da análise.
 */
export function DonutChart({
  data,
  centerLabel,
  height = 210,
}: {
  data: DonutDatum[];
  centerLabel?: string;
  height?: number;
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const [active, setActive] = useState<number | null>(null);

  // Se o recorte muda (novo conjunto de dados), zera o realce para não apontar
  // para uma fatia que não existe mais.
  useEffect(() => setActive(null), [data]);

  const focus = active != null ? data[active] : null;
  const centerValue = focus ? focus.value : total;
  const centerPct =
    focus && total
      ? ((focus.value / total) * 100).toFixed(focus.value / total < 0.01 ? 1 : 0)
      : null;

  return (
    <div className="flex flex-col">
      <div className="relative" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="62%"
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
        {/* Leitor central: só números (sempre cabem no miolo). O NOME da fatia
            aparece realçado na legenda abaixo — evita texto longo, tipo
            "Vivo (Telefônica)", vazando por cima do gráfico. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 text-center">
          <span className="font-num font-display text-2xl font-bold leading-none tracking-tight text-foreground">
            {formatNumber(centerValue)}
          </span>
          {focus ? (
            <span className="inline-flex items-center gap-1.5 font-num text-xs font-semibold text-foreground">
              <span className="h-2 w-2 rounded-full" style={{ background: focus.fill }} />
              {centerPct}%
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

      {/* Legenda com valor — identidade + participação, nunca só a cor */}
      <ul className="mt-3 space-y-1.5">
        {data.map((d, i) => {
          const share = total ? (d.value / total) * 100 : 0;
          return (
            <li
              key={d.name}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              className={`grid cursor-default grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md px-1 py-0.5 text-xs transition-colors ${
                active === i ? "bg-muted" : ""
              }`}
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.fill }} />
              <span
                className={`truncate ${active === i ? "font-semibold text-foreground" : "text-muted-foreground"}`}
              >
                {d.name}
              </span>
              {/* Separação tipográfica real: o % é o dado-chave em fonte MONO
                  (grande, forte); o total absoluto é apoio, em fonte de texto
                  (sans) menor e leve — fontes diferentes, não só cor/tamanho. */}
              <span className="flex items-baseline gap-2">
                <span className="font-num text-sm font-bold tabular-nums text-foreground">
                  {share.toFixed(share < 1 ? 1 : 0)}%
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
