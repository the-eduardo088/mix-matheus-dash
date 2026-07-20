/**
 * Tipos, formatação e cores da base Mix Mateus. SEGURO NO CLIENTE.
 *
 * Este arquivo NÃO importa mais `src/data/mix-mateus.json`. Ele importava, e o
 * resultado era a base inteira (1,8 milhão de pessoas — renda, idade,
 * telefone) viajando dentro do bundle JavaScript para qualquer visitante.
 *
 * Agora o JSON vive em `src/lib/server/base.ts`, e a tela pede um recorte por
 * vez através de `src/lib/base.ts`, com sessão. Nada de dado pessoal aqui.
 */

export type DimBucket = { key: string; value: number };

export type Loja = {
  codigo: string;
  nome: string;
  cep: string;
  pessoas: number;
  contatos: number;
  com_email: number;
};

export type Scope = {
  id: string;
  rotulo: string;
  tipo: "geral" | "estado" | "cluster";
  pessoas: number;
  contatos: number;
  com_email: number;
  renda: { media: number | null; mediana: number | null; p25: number | null; p75: number | null };
  idade: { media: number | null; mediana: number | null };
  sexo: Record<string, number>;
  idade_g: Record<string, number>;
  renda_f: Record<string, number>;
  classe: Record<string, number>;
  esc: Record<string, number>;
  cbo: Record<string, number>;
  dom: Record<string, number>;
  prestadora: Record<string, number>;
  ddd: Record<string, number>;
  cidades: [string, number][];
  piramide: Record<string, { Feminino?: number; Masculino?: number; "Não informado"?: number }>;
  lojas?: Loja[];
};

/** Entrada do seletor de recorte — sem nenhum dado da base, só rótulo. */
export type RecorteResumo = {
  id: string;
  rotulo: string;
  tipo: Scope["tipo"];
  contatos: number;
  pessoas: number;
  /**
   * Nomes das maiores cidades do recorte — sugestão para o formulário, sem
   * volume. Ver `cidadesDe` em server/base.ts para o porquê de não haver número.
   */
  cidades: string[];
};

export type MetaBase = {
  extracao: string;
  fonte: string;
  total_pessoas: number;
  total_linhas: number;
  com_email_pessoas: number;
  ordens: Record<string, string[]>;
  cbo_nomes: Record<string, string>;
  notas: string;
};

/** Índice carregado uma vez por sessão: rótulos e metadados, sem distribuições. */
export type IndiceBase = {
  meta: MetaBase;
  recortes: RecorteResumo[];
};

export function toBuckets(map: Record<string, number>, order?: string[]): DimBucket[] {
  const entries = Object.entries(map ?? {}).map(([key, value]) => ({
    key,
    value: Number(value) || 0,
  }));
  if (order) {
    entries.sort((a, b) => {
      const ia = order.indexOf(a.key);
      const ib = order.indexOf(b.key);
      if (ia === -1 && ib === -1) return b.value - a.value;
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  } else {
    entries.sort((a, b) => b.value - a.value);
  }
  return entries;
}

export function pct(part: number, total: number) {
  if (!total) return 0;
  return (part / total) * 100;
}

export const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-chart-6)",
  "var(--color-chart-7)",
  "var(--color-chart-8)",
];

/**
 * Color hierarchy — each DIMENSION owns a color language.
 *
 * · Categorical dimensions (identity): a fixed, meaningful hue per entity.
 * · Ordered/ordinal dimensions (idade, renda, classe, escolaridade): a single-hue
 *   sequential RAMP so the order is legible in the color (light = low, dark = high).
 * · Ranked-magnitude bars (cidades, CBO, clusters): one accent hue — bar length
 *   already encodes magnitude, so color is not spent re-encoding it.
 */

/** Carrier brand-recognisable hues (Claro red · Vivo violet · TIM blue). */
export const PRESTADORA_COLORS: Record<string, string> = {
  Claro: "var(--color-chart-1)", // red — Claro
  "Vivo (Telefônica)": "var(--color-chart-5)", // violet — Vivo
  TIM: "var(--color-chart-2)", // blue — TIM
  Outras: "var(--color-chart-6)", // cyan
  "Não informado": "var(--color-muted-foreground)",
};

/** Distinct region hues for the DDD / regional-coverage panel. */
export const REGION_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
];

export const SEXO_COLORS: Record<string, string> = {
  Feminino: "var(--sexo-feminino)", // rosa
  Masculino: "var(--sexo-masculino)", // azul escuro
  "Não informado": "var(--color-muted-foreground)",
};

/** Muted fill for "Não informado" buckets that sit outside an ordered ramp. */
export const NA_FILL = "var(--color-muted-foreground)";

/**
 * Pick a step from a dimension's 8-step sequential ramp for bucket `i` of `n`.
 * Maps position 0..n-1 across steps 1..8 so the full ramp is used regardless of
 * how many buckets a scope has.
 */
export function rampFill(ramp: "idade" | "renda" | "classe" | "esc", i: number, n: number): string {
  const step = n <= 1 ? 6 : Math.round((i / (n - 1)) * 7) + 1;
  return `var(--ramp-${ramp}-${step})`;
}

export function formatNumber(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("pt-BR").format(Math.round(n));
}

/**
 * Número compacto para eixos (evita rótulos gigantes tipo "600.000").
 * Ex.: 600000 → "600 mil" · 1660526 → "1,7 mi" · 900 → "900".
 */
export function formatCompact(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    const v = n / 1_000_000;
    return (Number.isInteger(v) ? String(v) : v.toFixed(1).replace(".", ",")) + " mi";
  }
  if (abs >= 1_000) {
    const v = n / 1_000;
    return (Number.isInteger(v) ? String(v) : v.toFixed(0)) + " mil";
  }
  return String(Math.round(n));
}

/**
 * Percentual legível (pt-BR). Evita a contradição "0,0% com 10 contatos":
 * valores > 0 que arredondam para zero viram "<0,1%".
 */
export function formatPercent(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v) || v <= 0) return "0%";
  if (v < 0.1) return "<0,1%";
  if (v < 1) return v.toFixed(1).replace(".", ",") + "%";
  return Math.round(v) + "%";
}

export function formatCurrency(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(n);
}
