/**
 * Notificações — SOMENTE SERVIDOR.
 *
 * Gerencia notificações para o admin quando PDFs são editados.
 */
import { query, queryOne } from "./db";
import type { Sessao } from "./sessao";

export type Notificacao = {
  id: string;
  campanhaId: string | null;
  tipo: string;
  mensagem: string;
  lida: boolean;
  criadoEm: string;
};

type Row = {
  id: string;
  campanha_id: string | null;
  tipo: string;
  mensagem: string;
  lida: boolean;
  criado_em: Date;
};

function paraDTO(r: Row): Notificacao {
  return {
    id: r.id,
    campanhaId: r.campanha_id,
    tipo: r.tipo,
    mensagem: r.mensagem,
    lida: r.lida,
    criadoEm: r.criado_em.toISOString(),
  };
}

/** Lista notificações do usuário, mais recentes primeiro. */
export async function listarNotificacoes(sessao: Sessao): Promise<Notificacao[]> {
  const rows = await query<Row>(
    `select id, campanha_id, tipo, mensagem, lida, criado_em
     from notificacoes
     where usuario_id = $1
     order by criado_em desc
     limit 50`,
    [sessao.id],
  );
  return rows.map(paraDTO);
}

/** Conta notificações não lidas. */
export async function contarNaoLidas(sessao: Sessao): Promise<number> {
  const row = await queryOne<{ total: string }>(
    "select count(*) as total from notificacoes where usuario_id = $1 and lida = false",
    [sessao.id],
  );
  return Number(row?.total ?? 0);
}

/** Marca uma notificação como lida. */
export async function marcarLida(sessao: Sessao, id: string): Promise<void> {
  await query(
    "update notificacoes set lida = true where id = $1 and usuario_id = $2",
    [id, sessao.id],
  );
}

/** Marca todas como lidas. */
export async function marcarTodasLidas(sessao: Sessao): Promise<void> {
  await query(
    "update notificacoes set lida = true where usuario_id = $1 and lida = false",
    [sessao.id],
  );
}

/** Cria notificação de PDF editado para todos os admins. */
export async function notificarPdfEditado(
  campanhaId: string,
  editorNome: string,
  campanhaNome: string,
): Promise<void> {
  const admins = await query<{ id: string }>(
    "select id from usuarios where papel = 'admin' and ativo = true",
  );

  if (admins.length === 0) return;

  const mensagem = `${editorNome} editou o PDF da campanha "${campanhaNome}".`;

  // Inserir notificação para cada admin
  const values = admins.map((_, i) => `($1, $2, 'pdf_editado', $3, false)`);
  const params = [campanhaId, ...admins.map((a) => a.id), mensagem];

  await query(
    `insert into notificacoes (campanha_id, usuario_id, tipo, mensagem, lida)
     values ${values.join(", ")}`,
    params,
  );
}
