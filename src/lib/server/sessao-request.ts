/**
 * Leitura de sessão a partir de um `Request` cru. SOMENTE SERVIDOR.
 *
 * O `lerSessao()` de `sessao.ts` usa `getCookie()`, que depende do contexto de
 * request do TanStack Start. A rota de arquivos roda ANTES desse contexto
 * existir (é interceptada no `server.ts`), então aqui o cookie é lido direto do
 * cabeçalho.
 */
import { createHash } from "node:crypto";

import { queryOne } from "./db";
import type { Papel, Sessao } from "./sessao";

const COOKIE = "mm_sessao";

function lerCookie(header: string | null, nome: string): string | null {
  if (!header) return null;
  for (const parte of header.split(";")) {
    const igual = parte.indexOf("=");
    if (igual === -1) continue;
    if (parte.slice(0, igual).trim() === nome) {
      return decodeURIComponent(parte.slice(igual + 1).trim());
    }
  }
  return null;
}

export async function lerSessaoDoRequest(request: Request): Promise<Sessao | null> {
  const token = lerCookie(request.headers.get("cookie"), COOKIE);
  if (!token) return null;

  const row = await queryOne<{ id: string; nome: string; email: string; papel: Papel }>(
    `select u.id, u.nome, u.email, u.papel
       from sessoes s
       join usuarios u on u.id = s.usuario_id
      where s.token_hash = $1
        and s.expira_em > now()
        and u.ativo = true`,
    [createHash("sha256").update(token).digest("hex")],
  );

  return row ?? null;
}
