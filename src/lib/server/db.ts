/**
 * Pool de conexões com o Postgres. SOMENTE SERVIDOR.
 *
 * Nada aqui pode vazar para o bundle do cliente — o arquivo lê `process.env` e
 * abre socket TCP. Importe-o apenas de server functions.
 */
import { Pool, type PoolClient, type QueryResultRow } from "pg";

import { traduzirErroDb } from "./erro-db";

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

// Preso ao globalThis sempre — se o bundler duplicar o chunk (o db é
// importado por server.ts e pelas server fns), os dois lados compartilham o
// mesmo pool em vez de abrir 2×max conexões.
globalPool.__mixPool = pool;

pool.on("error", (err) => {
  // Conexão ociosa derrubada pelo servidor não deve matar o processo.
  console.error("[db] erro em conexão ociosa:", err.message);
});

/**
 * Migrações que este código exige. Atualize ao adicionar um arquivo em
 * db/migrations.
 */
const MIGRACOES_ESPERADAS = [
  "001_init.sql",
  "002_cidade.sql",
  "003_antecedencia_aviso.sql",
  "004_botao.sql",
];

/**
 * Colunas de que o código depende, por tabela.
 *
 * Conferir isto — e não só a tabela `migracoes` — é o que pega o caso em que o
 * registro diz "aplicada" mas o schema não corresponde: backup restaurado de
 * uma versão anterior, coluna removida à mão, migração revertida pela metade.
 * Foi exatamente assim que um `column "cidade" does not exist` chegou cru na
 * tela do usuário.
 */
const ESQUEMA_ESPERADO: Record<string, string[]> = {
  usuarios: ["id", "email", "senha_hash", "nome", "papel", "ativo"],
  sessoes: ["token_hash", "usuario_id", "expira_em"],
  arquivos: ["id", "nome_original", "mime", "tamanho", "kind", "caminho", "criado_por"],
  campanhas: [
    "id",
    "nome",
    "scope_id",
    "scope_rotulo",
    "cidade",
    "alcance_contatos",
    "alcance_pessoas",
    "alcance_a_definir",
    "copy",
    "botao_texto",
    "botao_url",
    "midia_id",
    "agendada_para",
    "status",
    "motivo_recusa",
    "criada_por",
    "revisada_por",
    "revisada_em",
  ],
  relatorios: [
    "id",
    "campanha_id",
    "entregues",
    "lidas",
    "respostas",
    "falhas",
    "observacoes",
    "anexo_id",
    "criado_por",
  ],
};

let esquemaOk = false;

/**
 * Confere uma vez, na primeira consulta, se o banco corresponde ao código.
 *
 * Sem isso, esquecer `npm run db:migrate` depois de um deploy causava falhas
 * espalhadas e sem relação aparente: a trava antiga das 24 h recusando o que a
 * tela já permitia, ou erro de coluna inexistente ao criar campanha.
 */
async function conferirEsquema(): Promise<void> {
  if (esquemaOk) return;

  // 1. Bookkeeping das migrações — dá a instrução mais direta quando falta.
  let aplicadas: string[] = [];
  try {
    const r = await pool.query<{ nome: string }>("select nome from migracoes");
    aplicadas = r.rows.map((x) => x.nome);
  } catch (err) {
    // "42P01" = tabela não existe → banco vazio, precisa migrar. Qualquer
    // outro código (28P01 senha, 3D000 db inexistente, ECONNREFUSED, 53300
    // sem conexões) é falha de CONEXÃO — mandar "rode db:migrate" aqui
    // apontaria o operador para o lado errado.
    const codigo = (err as { code?: string })?.code;
    if (codigo === "42P01") {
      throw new Error(
        "Banco não inicializado (tabela `migracoes` ausente). Rode: npm run db:migrate",
      );
    }
    throw new Error(
      `Não foi possível conectar ao banco (${codigo ?? "erro desconhecido"}). ` +
        "Verifique se o Postgres está no ar e se DATABASE_URL está correta.",
    );
  }

  const faltamMigracoes = MIGRACOES_ESPERADAS.filter((m) => !aplicadas.includes(m));
  if (faltamMigracoes.length > 0) {
    throw new Error(
      `Banco desatualizado — falta aplicar: ${faltamMigracoes.join(", ")}. Rode: npm run db:migrate`,
    );
  }

  // 2. Estrutura real. O registro pode mentir; as colunas, não.
  const { rows } = await pool.query<{ table_name: string; column_name: string }>(
    `select table_name, column_name
       from information_schema.columns
      where table_schema = 'public'
        and table_name = any($1)`,
    [Object.keys(ESQUEMA_ESPERADO)],
  );

  const existentes = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!existentes.has(r.table_name)) existentes.set(r.table_name, new Set());
    existentes.get(r.table_name)!.add(r.column_name);
  }

  const problemas: string[] = [];
  for (const [tabela, colunas] of Object.entries(ESQUEMA_ESPERADO)) {
    const tem = existentes.get(tabela);
    if (!tem) {
      problemas.push(`tabela \`${tabela}\` ausente`);
      continue;
    }
    const faltando = colunas.filter((c) => !tem.has(c));
    if (faltando.length > 0) {
      problemas.push(`\`${tabela}\` sem: ${faltando.join(", ")}`);
    }
  }

  if (problemas.length > 0) {
    throw new Error(
      `Estrutura do banco não corresponde ao código (${problemas.join(" · ")}). ` +
        "As migrações constam aplicadas, então o schema foi alterado por fora. " +
        "Recrie o banco ou aplique manualmente as colunas de db/migrations.",
    );
  }

  esquemaOk = true;
}

/** Consulta simples. Sempre use parâmetros ($1, $2) — nunca interpole SQL. */
export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  await conferirEsquema();
  try {
    const res = await pool.query<T>(sql, params);
    return res.rows;
  } catch (err) {
    // Erro do Postgres não deve chegar cru na tela: além de incompreensível,
    // expõe nome de tabela e coluna.
    const amigavel = traduzirErroDb(err);
    if (amigavel) throw new Error(amigavel);
    console.error("[db] erro não mapeado:", err);
    throw new Error("Falha ao acessar o banco de dados. Tente novamente.");
  }
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
