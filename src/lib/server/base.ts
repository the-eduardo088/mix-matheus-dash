/**
 * Leitura da base Mix Mateus. SOMENTE SERVIDOR.
 *
 * Este é o único lugar que importa `src/data/mix-mateus.json`. Manter assim é
 * o que impede a base inteira de voltar para o bundle do navegador — se algum
 * componente de tela importar daqui, o JSON viaja junto de novo.
 */
import raw from "@/data/mix-mateus.json";

import type { IndiceBase, MetaBase, RecorteResumo, Scope } from "../mix-data";

const data = raw as unknown as {
  meta: MetaBase;
  geral: Omit<Scope, "id" | "rotulo" | "tipo">;
  estados: Record<string, Omit<Scope, "id" | "rotulo" | "tipo"> & { nome?: string }>;
  clusters: Record<string, Omit<Scope, "id" | "rotulo" | "tipo"> & { rotulo?: string }>;
};

const geral: Scope = {
  id: "geral",
  rotulo: "Base Completa (PE · PB · AL)",
  tipo: "geral",
  ...data.geral,
};

const estados: Scope[] = Object.entries(data.estados).map(([id, v]) => ({
  ...v,
  id,
  rotulo: v.nome ?? id,
  tipo: "estado" as const,
}));

const clusters: Scope[] = Object.entries(data.clusters).map(([id, v]) => ({
  ...v,
  id,
  rotulo: v.rotulo ?? id,
  tipo: "cluster" as const,
}));

const scopes: Scope[] = [geral, ...estados, ...clusters];
const porId = new Map(scopes.map((s) => [s.id, s]));

/**
 * Índice leve: rótulos e metadados, sem nenhuma distribuição demográfica.
 * É o que a tela precisa para montar o seletor de recorte.
 */
export function getIndice(): IndiceBase {
  const recortes: RecorteResumo[] = scopes.map((s) => ({
    id: s.id,
    rotulo: s.rotulo,
    tipo: s.tipo,
    contatos: s.contatos,
    pessoas: s.pessoas,
    cidades: cidadesDe(s),
  }));
  return { meta: data.meta, recortes };
}

/**
 * Nomes de cidade de um recorte, para sugerir no formulário.
 *
 * Só o NOME sai daqui — de propósito. Os totais por cidade na base são
 * projetados, não contados: a mesma cidade aparece com valores diferentes em
 * recortes aninhados (Goiana = 173.858 na base completa, mas 277.788 no
 * cluster PE-C01, que está dentro dela), com razão constante entre cidades
 * distintas. Exibir esse número daria falsa precisão; a segmentação por
 * cidade é feita pela ATONNS no disparo.
 *
 * A lista é sugestão, não restrição: o campo aceita qualquer cidade digitada,
 * já que estes são apenas os 10 maiores de cada recorte.
 *
 * "Nao Identificado" é descartado: é o balde de CEP sem cidade resolvida.
 */
function cidadesDe(s: Scope): string[] {
  return (s.cidades ?? [])
    .filter(([nome]) => nome && nome.toLowerCase() !== "nao identificado")
    .sort((a, b) => b[1] - a[1])
    .map(([nome]) => nome);
}

/** Um recorte completo. `null` se o id não existir. */
export function getRecorte(id: string): Scope | null {
  return porId.get(id) ?? null;
}

/** Confere se um id de recorte é válido — usado ao criar campanha. */
export function recorteExiste(id: string): boolean {
  return porId.has(id);
}

/** Alcance congelado no momento da criação da campanha. */
export function getAlcance(
  id: string,
): { contatos: number; pessoas: number; rotulo: string } | null {
  const s = porId.get(id);
  return s ? { contatos: s.contatos, pessoas: s.pessoas, rotulo: s.rotulo } : null;
}
