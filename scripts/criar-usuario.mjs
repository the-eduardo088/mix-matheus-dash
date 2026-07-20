/**
 * Cria (ou atualiza a senha de) um usuário do painel.
 *
 *   npm run user:criar -- --email admin@atonns.com.br --nome "Eduardo" --papel admin
 *   npm run user:criar -- --email compras@mixmateus.com.br --nome "Mix Mateus" --papel cliente
 *
 * Sem `--senha`, uma senha forte é sorteada e mostrada UMA vez — é a forma
 * recomendada. Digitar a senha na linha de comando deixa ela no histórico do
 * shell.
 *
 * Rodar de novo com o mesmo e-mail troca a senha (útil para reset).
 */
import { randomBytes } from "node:crypto";

import "dotenv/config";
import pg from "pg";

import { hashSenha } from "../src/lib/server/senha.ts";

function arg(nome) {
  const i = process.argv.indexOf(`--${nome}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

const email = arg("email")?.trim().toLowerCase();
const nome = arg("nome")?.trim();
const papel = arg("papel")?.trim();
let senha = arg("senha");

if (!email || !nome || !papel) {
  console.error(
    'Uso: npm run user:criar -- --email <email> --nome "<nome>" --papel <admin|cliente> [--senha <senha>]',
  );
  process.exit(1);
}

if (!["admin", "cliente"].includes(papel)) {
  console.error("✗ --papel precisa ser 'admin' ou 'cliente'.");
  process.exit(1);
}

if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error("✗ E-mail inválido.");
  process.exit(1);
}

let sorteada = false;
if (!senha) {
  // 18 bytes em base64url ≈ 144 bits de entropia — inquebrável na prática.
  senha = randomBytes(18).toString("base64url");
  sorteada = true;
} else if (senha.length < 10) {
  console.error("✗ A senha precisa de pelo menos 10 caracteres.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();
  const hash = await hashSenha(senha);

  const { rows } = await client.query(
    `insert into usuarios (email, senha_hash, nome, papel)
     values ($1, $2, $3, $4)
     on conflict (email) do update
       set senha_hash = excluded.senha_hash,
           nome       = excluded.nome,
           papel      = excluded.papel,
           ativo      = true
     returning id, email, nome, papel, (xmax = 0) as criado`,
    [email, hash, nome, papel],
  );

  const u = rows[0];
  console.log(`\n✓ Usuário ${u.criado ? "criado" : "atualizado"}`);
  console.log(`  nome:  ${u.nome}`);
  console.log(`  email: ${u.email}`);
  console.log(`  papel: ${u.papel}`);

  if (sorteada) {
    console.log(`\n  SENHA: ${senha}`);
    console.log("  ↑ anote agora: ela não é exibida de novo.\n");
  }
} catch (err) {
  console.error(`\n✗ ${err.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
