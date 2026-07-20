/**
 * Sessão de usuário. SOMENTE SERVIDOR.
 *
 * O cookie carrega um token aleatório; o banco guarda apenas o SHA-256 dele.
 * Quem ler um dump do banco não consegue forjar cookie, e revogar acesso é um
 * `delete` — coisa que um JWT autocontido não permitiria sem lista de bloqueio.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";

import { query, queryOne } from "./db";

const COOKIE = "mm_sessao";
const DURACAO_DIAS = 7;

export type Papel = "admin" | "cliente";

export type Sessao = {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Cria a sessão e planta o cookie. Chamado após a senha conferir. */
export async function criarSessao(usuarioId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expira = new Date(Date.now() + DURACAO_DIAS * 24 * 60 * 60 * 1000);

  await query("insert into sessoes (token_hash, usuario_id, expira_em) values ($1, $2, $3)", [
    hashToken(token),
    usuarioId,
    expira,
  ]);

  setCookie(COOKIE, token, {
    httpOnly: true, // JavaScript da página não enxerga — barra roubo por XSS
    sameSite: "lax", // barra uso do cookie em requisição vinda de outro site
    secure: process.env.NODE_ENV === "production", // só HTTPS em produção
    path: "/",
    expires: expira,
  });

  // Faxina oportunista: sem isso a tabela só cresce, já que nada mais apaga
  // sessão vencida. Roda no login, que é raro o bastante para não pesar.
  void query("delete from sessoes where expira_em < now()").catch(() => {});
}

/** Lê a sessão do cookie. `null` se ausente, vencida ou de usuário desativado. */
export async function lerSessao(): Promise<Sessao | null> {
  const token = getCookie(COOKIE);
  if (!token) return null;

  const row = await queryOne<{ id: string; nome: string; email: string; papel: Papel }>(
    `select u.id, u.nome, u.email, u.papel
       from sessoes s
       join usuarios u on u.id = s.usuario_id
      where s.token_hash = $1
        and s.expira_em > now()
        and u.ativo = true`,
    [hashToken(token)],
  );

  return row ?? null;
}

/** Encerra a sessão atual: apaga do banco e limpa o cookie. */
export async function destruirSessao(): Promise<void> {
  const token = getCookie(COOKIE);
  if (token) {
    await query("delete from sessoes where token_hash = $1", [hashToken(token)]);
  }
  deleteCookie(COOKIE, { path: "/" });
}

/** Derruba todas as sessões de um usuário — usado ao trocar a senha. */
export async function destruirSessoesDoUsuario(usuarioId: string): Promise<void> {
  await query("delete from sessoes where usuario_id = $1", [usuarioId]);
}

/**
 * Compara dois textos em tempo constante. Usado no login para que a resposta
 * demore igual com e-mail existente ou não.
 */
export function comparaConstante(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
