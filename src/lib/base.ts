/**
 * Acesso à base — ponte cliente ↔ servidor, sempre com sessão.
 *
 * A tela pede UM recorte por vez. Antes, os 14 recortes iam juntos no bundle;
 * agora cada um chega sob demanda (~10 KB) e só para quem está autenticado.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { IndiceBase, Scope } from "./mix-data";

/** Índice (rótulos + metadados). Carregado uma vez por navegação. */
export const carregarIndice = createServerFn({ method: "GET" }).handler(
  async (): Promise<IndiceBase> => {
    const { lerSessao } = await import("./server/sessao");
    if (!(await lerSessao())) throw new Error("Não autenticado.");

    const { getIndice } = await import("./server/base");
    return getIndice();
  },
);

/** Um recorte completo, com todas as distribuições. */
export const carregarRecorte = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }): Promise<Scope> => {
    const { lerSessao } = await import("./server/sessao");
    if (!(await lerSessao())) throw new Error("Não autenticado.");

    const { getRecorte } = await import("./server/base");
    const recorte = getRecorte(data.id);
    if (!recorte) throw new Error("Recorte não encontrado.");
    return recorte;
  });
