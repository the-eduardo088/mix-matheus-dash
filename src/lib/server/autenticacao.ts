/**
 * Regras de autenticação. SOMENTE SERVIDOR.
 */
import { queryOne } from "./db";
import { verificarSenha } from "./senha";
import { criarSessao, type Papel } from "./sessao";

/**
 * Hash descartável de uma senha inexistente. Quando o e-mail não existe,
 * verificamos a senha contra ele mesmo assim: sem isso, a resposta voltaria
 * instantaneamente para e-mail desconhecido e após ~100 ms para e-mail válido,
 * o que permite descobrir quem tem conta só cronometrando.
 */
const HASH_ISCA =
  "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$" +
  "d3JvbmdwYXNzd29yZGRlY295aGFzaHBhZGRpbmd0b3NpeHR5Zm91cmJ5dGVzISE=";

export type ResultadoLogin = { ok: true } | { ok: false; erro: string };

export async function autenticar(email: string, senha: string): Promise<ResultadoLogin> {
  const normalizado = email.trim().toLowerCase();

  const usuario = await queryOne<{ id: string; senha_hash: string; papel: Papel }>(
    "select id, senha_hash, papel from usuarios where email = $1 and ativo = true",
    [normalizado],
  );

  const confere = await verificarSenha(senha, usuario?.senha_hash ?? HASH_ISCA);

  // Mensagem única para senha errada e e-mail inexistente — dizer "e-mail não
  // encontrado" entregaria quais contas existem.
  if (!usuario || !confere) {
    return { ok: false, erro: "E-mail ou senha inválidos." };
  }

  await criarSessao(usuario.id);
  return { ok: true };
}
