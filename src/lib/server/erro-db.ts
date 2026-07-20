/**
 * Traduz erro do Postgres para mensagem que a pessoa entende. SOMENTE SERVIDOR.
 *
 * Sem isso, uma constraint violada chega na tela como
 * `new row for relation "campanhas" violates check constraint "campanhas_copy_check"`,
 * que não diz o que fazer e ainda expõe nome de tabela e coluna.
 *
 * A aplicação valida antes em todos estes casos — o que chega aqui é o que
 * escapou (chamada direta à API, corrida entre duas abas, dado legado). A rede
 * de segurança precisa falar português.
 */

type ErroPg = {
  code?: string;
  constraint?: string;
  column?: string;
  table?: string;
  detail?: string;
};

/** Constraint → o que dizer. Nomes vêm de db/migrations. */
const POR_CONSTRAINT: Record<string, string> = {
  // 001_init.sql
  email_minusculo: "E-mail precisa estar em minúsculas.",
  recusa_justificada: "Recusar uma campanha exige informar o motivo.",
  campanhas_copy_check: "A mensagem precisa ter entre 1 e 1024 caracteres.",
  campanhas_nome_check: "Dê um nome para a campanha.",
  usuarios_papel_check: "Papel inválido — use 'admin' ou 'cliente'.",
  campanhas_status_check: "Status de campanha inválido.",
  arquivos_kind_check: "Tipo de arquivo não suportado.",
  relatorios_campanha_id_key: "Esta campanha já tem relatório. Edite o existente.",
  usuarios_email_key: "Já existe uma conta com este e-mail.",
  arquivos_caminho_key: "Conflito de arquivo no disco. Tente enviar novamente.",
  // 002_cidade.sql
  cidade_nao_vazia: "Cidade em branco — deixe o campo vazio para usar o recorte inteiro.",
  alcance_coerente: "Campanha por cidade não pode ter alcance definido.",
  // 001, removida pela 003 — só aparece em banco desatualizado
  antecedencia_minima: "Seu banco ainda tem a trava antiga de 24 h. Rode: npm run db:migrate",
};

const POR_CODIGO: Record<string, string> = {
  "23505": "Registro duplicado.",
  "23503": "Referência a um registro que não existe mais. Recarregue a página.",
  "23514": "Dado fora das regras do sistema.",
  "23502": "Falta um campo obrigatório.",
  "22001": "Texto longo demais para o campo.",
  "42703": "Estrutura do banco desatualizada. Rode: npm run db:migrate",
  "42P01": "Estrutura do banco desatualizada. Rode: npm run db:migrate",
  "53300": "Banco sem conexões disponíveis. Tente novamente em instantes.",
  "57014": "A consulta demorou demais e foi cancelada.",
};

/**
 * Devolve mensagem amigável, ou `null` se não for erro reconhecido do Postgres
 * (nesse caso o chamador deixa o erro original subir).
 */
export function traduzirErroDb(err: unknown): string | null {
  const e = err as ErroPg;
  if (!e || typeof e !== "object") return null;

  if (e.constraint && POR_CONSTRAINT[e.constraint]) return POR_CONSTRAINT[e.constraint];
  if (e.code && POR_CODIGO[e.code]) return POR_CODIGO[e.code];
  return null;
}

/** Executa e converte erro conhecido do banco em mensagem legível. */
export async function comErroTraduzido<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const amigavel = traduzirErroDb(err);
    if (amigavel) throw new Error(amigavel);
    throw err;
  }
}
