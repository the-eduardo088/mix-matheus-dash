/**
 * Hash de senha com scrypt. SOMENTE SERVIDOR.
 *
 * scrypt vem embutido no Node (`node:crypto`) e é memory-hard, o que encarece
 * ataque em GPU. A alternativa usual seria argon2id, mas ela exige dependência
 * nativa compilada — numa VPS isso vira dor de cabeça de build a cada deploy,
 * e o ganho aqui não paga o custo.
 *
 * Formato do hash: `scrypt$N$r$p$<salt b64>$<derivado b64>`
 * Guardar os parâmetros junto permite endurecê-los depois sem invalidar as
 * senhas já cadastradas.
 */
import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";
import { promisify } from "node:util";

// `promisify` não preserva a sobrecarga que aceita opções (N, r, p), então a
// assinatura é declarada à mão — sem isso o TS reclama de argumento a mais.
const scryptAsync = promisify(scrypt) as (
  senha: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

const N = 16_384; // custo de CPU/memória (~16 MB por hash)
const r = 8;
const p = 1;
const KEYLEN = 64;

export async function hashSenha(senha: string): Promise<string> {
  const salt = randomBytes(16);
  const derivado = await scryptAsync(senha.normalize("NFKC"), salt, KEYLEN, { N, r, p });
  return `scrypt$${N}$${r}$${p}$${salt.toString("base64")}$${derivado.toString("base64")}`;
}

export async function verificarSenha(senha: string, hashGuardado: string): Promise<boolean> {
  try {
    const [algo, sN, sR, sP, saltB64, derivadoB64] = hashGuardado.split("$");
    if (algo !== "scrypt") return false;

    const salt = Buffer.from(saltB64, "base64");
    const esperado = Buffer.from(derivadoB64, "base64");

    const calculado = await scryptAsync(senha.normalize("NFKC"), salt, esperado.length, {
      N: Number(sN),
      r: Number(sR),
      p: Number(sP),
    });

    // Comparação em tempo constante — `===` vazaria informação pelo tempo de
    // resposta, permitindo descobrir o hash byte a byte.
    return calculado.length === esperado.length && timingSafeEqual(calculado, esperado);
  } catch {
    return false;
  }
}
