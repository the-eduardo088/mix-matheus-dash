import raw from "@/data/mix-mateus.json";

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

const data = raw as any;

export const meta = data.meta as {
  extracao: string;
  fonte: string;
  total_pessoas: number;
  total_linhas: number;
  com_email_pessoas: number;
  ordens: Record<string, string[]>;
  cbo_nomes: Record<string, string>;
  notas: string;
};

const geralScope: Scope = {
  id: "geral",
  rotulo: "Base Completa (PE · PB · AL)",
  tipo: "geral",
  ...data.geral,
};

const estadoScopes: Scope[] = Object.entries(data.estados).map(([id, v]: any) => ({
  id,
  rotulo: v.nome ?? id,
  tipo: "estado",
  ...v,
}));

const clusterScopes: Scope[] = Object.entries(data.clusters).map(([id, v]: any) => ({
  id,
  rotulo: v.rotulo ?? id,
  tipo: "cluster",
  ...v,
}));

export const scopes: Scope[] = [geralScope, ...estadoScopes, ...clusterScopes];

export function getScope(id: string): Scope {
  return scopes.find((s) => s.id === id) ?? geralScope;
}

export function toBuckets(map: Record<string, number>, order?: string[]): DimBucket[] {
  const entries = Object.entries(map ?? {}).map(([key, value]) => ({ key, value: Number(value) || 0 }));
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

/** Lojas ausentes: registradas no meta OU sem qualquer contato na base */
export function lojasSemRegistro(): { codigo: string; nome: string; cep?: string; motivo: string }[] {
  const fromMeta = (meta.notas.match(/Lojas sem registro:\s*([^.]+)/)?.[1] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((n) => ({ codigo: n.split("-")[0], nome: n, motivo: "Sem registro na base (CEP não encontrado)" }));

  const zeradas: { codigo: string; nome: string; cep?: string; motivo: string }[] = [];
  for (const c of clusterScopes) {
    for (const l of c.lojas ?? []) {
      if ((l.contatos ?? 0) === 0 && !fromMeta.find((f) => f.nome === l.nome)) {
        zeradas.push({
          codigo: l.codigo,
          nome: l.nome,
          cep: l.cep,
          motivo: "Cadastrada mas sem contatos capturados",
        });
      }
    }
  }
  // enrich fromMeta with cep se encontrarmos
  for (const c of clusterScopes) {
    for (const l of c.lojas ?? []) {
      const hit = fromMeta.find((f) => f.nome === l.nome);
      if (hit && !("cep" in hit && hit.cep)) (hit as any).cep = l.cep;
    }
  }
  return [...fromMeta, ...zeradas];
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

export function formatNumber(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("pt-BR").format(Math.round(n));
}

export function formatCurrency(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);
}
