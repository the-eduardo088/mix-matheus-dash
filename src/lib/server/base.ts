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
  }));
  return { meta: data.meta, recortes };
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
