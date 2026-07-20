/**
 * Aplica as migrações de `db/migrations` em ordem alfabética.
 *
 *   npm run db:migrate
 *
 * Cada arquivo roda uma única vez e dentro de uma transação: se o SQL falhar no
 * meio, nada daquele arquivo fica aplicado e a migração não é marcada como
 * concluída. Rodar de novo é seguro.
 */
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

import "dotenv/config";
import pg from "pg";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "db", "migrations");

if (!process.env.DATABASE_URL) {
  console.error("✗ DATABASE_URL não definida. Copie .env.example para .env.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();

  await client.query(`
    create table if not exists migracoes (
      nome       text primary key,
      hash       text not null,
      aplicada_em timestamptz not null default now()
    )
  `);

  const arquivos = (await readdir(DIR)).filter((f) => f.endsWith(".sql")).sort();
  const { rows: aplicadas } = await client.query("select nome, hash from migracoes");
  const mapa = new Map(aplicadas.map((r) => [r.nome, r.hash]));

  let novas = 0;

  for (const nome of arquivos) {
    const sql = await readFile(join(DIR, nome), "utf8");
    const hash = createHash("sha256").update(sql).digest("hex").slice(0, 16);
    const jaAplicada = mapa.get(nome);

    if (jaAplicada) {
      // Migração já aplicada que mudou de conteúdo: avisa, mas não reaplica —
      // reaplicar destruiria dados. O certo é criar uma migração nova.
      if (jaAplicada !== hash) {
        console.warn(`⚠ ${nome} mudou depois de aplicada. Crie uma migração nova em vez de editar.`);
      }
      continue;
    }

    process.stdout.write(`→ ${nome} … `);
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("insert into migracoes (nome, hash) values ($1, $2)", [nome, hash]);
      await client.query("COMMIT");
      console.log("ok");
      novas++;
    } catch (err) {
      await client.query("ROLLBACK");
      console.log("FALHOU");
      throw err;
    }
  }

  console.log(novas ? `✓ ${novas} migração(ões) aplicada(s).` : "✓ Banco já está atualizado.");
} catch (err) {
  console.error(`\n✗ ${err.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
