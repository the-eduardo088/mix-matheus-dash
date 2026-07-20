/**
 * Pool de conexões com o Postgres. SOMENTE SERVIDOR.
 *
 * Nada aqui pode vazar para o bundle do cliente — o arquivo lê `process.env` e
 * abre socket TCP. Importe-o apenas de server functions.
 */
import { Pool, type PoolClient, type QueryResultRow } from "pg";

if (typeof window !== "undefined") {
  throw new Error("src/lib/server/db.ts foi importado no cliente. Use apenas em server functions.");
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL não definida. Copie .env.example para .env e ajuste.");
}

/**
 * Pool único por processo. Em dev o Vite recarrega o módulo a cada alteração,
 * o que criaria um pool novo (e vazaria conexões) a cada save — por isso ele
 * fica pendurado no globalThis.
 */
const globalPool = globalThis as unknown as { __mixPool?: Pool };

export const pool: Pool =
  globalPool.__mixPool ??
  new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

if (process.env.NODE_ENV !== "production") globalPool.__mixPool = pool;

pool.on("error", (err) => {
  // Conexão ociosa derrubada pelo servidor não deve matar o processo.
  console.error("[db] erro em conexão ociosa:", err.message);
});

/**
 * Migrações que este código exige. Atualize ao adicionar um arquivo em
 * db/migrations — é o que permite ao app dizer "seu banco está atrasado" em
 * vez de falhar com erro de constraint que ninguém liga à migração faltante.
 */
const MIGRACOES_ESPERADAS = ["001_init.sql", "002_cidade.sql", "003_antecedencia_aviso.sql"];

let migracoesOk = false;

/**
 * Confere uma única vez, na primeira consulta, se o banco está atualizado.
 *
 * Sem isso, esquecer `npm run db:migrate` depois de um deploy causava falhas
 * espalhadas e sem relação aparente: coluna inexistente ao criar campanha,
 * ou a trava antiga das 24 h recusando agendamento que a tela já permitia.
 */
async function conferirMigracoes(): Promise<void> {
  if (migracoesOk) return;

  let aplicadas: string[];
  try {
    const rows = await pool.query<{ nome: string }>("select nome from migracoes");
    aplicadas = rows.rows.map((r) => r.nome);
  } catch {
    throw new Error(
      "Banco não inicializado (tabela `migracoes` ausente). Rode: npm run db:migrate",
    );
  }

  const faltando = MIGRACOES_ESPERADAS.filter((m) => !aplicadas.includes(m));
  if (faltando.length > 0) {
    throw new Error(
      `Banco desatualizado — falta aplicar: ${faltando.join(", ")}. Rode: npm run db:migrate`,
    );
  }

  migracoesOk = true;
}

/** Consulta simples. Sempre use parâmetros ($1, $2) — nunca interpole SQL. */
export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  await conferirMigracoes();
  const res = await pool.query<T>(sql, params);
  return res.rows;
}

/** Primeira linha, ou `null`. */
export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

/**
 * Executa dentro de uma transação, com rollback automático em caso de erro.
 * Necessário quando gravar em duas tabelas precisa ser tudo-ou-nada — por
 * exemplo, registrar o arquivo e a campanha que o referencia.
 */
export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
