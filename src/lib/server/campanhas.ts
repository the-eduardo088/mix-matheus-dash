/**
 * Campanhas no banco. SOMENTE SERVIDOR.
 *
 * Toda função recebe a sessão e aplica o isolamento por papel AQUI, na consulta
 * — nunca filtrando depois na tela. Cliente enxerga só as próprias campanhas;
 * admin enxerga todas.
 */
import { query, queryOne } from "./db";
import type { Papel, Sessao } from "./sessao";

export type StatusCampanha =
  "rascunho" | "aguardando_aprovacao" | "aprovada" | "recusada" | "cancelada";

export type MidiaCampanha = {
  id: string;
  nome: string;
  mime: string;
  tamanho: number;
  kind: "imagem" | "video" | "audio" | "documento";
};

export type RelatorioDTO = {
  entregues: number | null;
  lidas: number | null;
  respostas: number | null;
  falhas: number | null;
  observacoes: string | null;
  anexo: MidiaCampanha | null;
  criadoPorNome: string;
  criadoEm: string;
};

export type CampanhaDTO = {
  id: string;
  nome: string;
  scopeId: string;
  scopeRotulo: string;
  alcanceContatos: number;
  alcancePessoas: number;
  copy: string;
  midia: MidiaCampanha | null;
  agendadaPara: string;
  status: StatusCampanha;
  motivoRecusa: string | null;
  criadaPorNome: string;
  criadaPorId: string;
  revisadaPorNome: string | null;
  revisadaEm: string | null;
  criadaEm: string;
  /** Preenchido pelo admin depois do disparo. `null` enquanto não houver. */
  relatorio: RelatorioDTO | null;
};

type Row = {
  id: string;
  nome: string;
  scope_id: string;
  scope_rotulo: string;
  alcance_contatos: number;
  alcance_pessoas: number;
  copy: string;
  agendada_para: Date;
  status: StatusCampanha;
  motivo_recusa: string | null;
  criada_em: Date;
  criada_por: string;
  criada_por_nome: string;
  revisada_por_nome: string | null;
  revisada_em: Date | null;
  midia_id: string | null;
  midia_nome: string | null;
  midia_mime: string | null;
  midia_tamanho: string | null;
  midia_kind: MidiaCampanha["kind"] | null;
  rel_entregues: number | null;
  rel_lidas: number | null;
  rel_respostas: number | null;
  rel_falhas: number | null;
  rel_observacoes: string | null;
  rel_criado_em: Date | null;
  rel_autor_nome: string | null;
  rel_anexo_id: string | null;
  rel_anexo_nome: string | null;
  rel_anexo_mime: string | null;
  rel_anexo_tamanho: string | null;
  rel_anexo_kind: MidiaCampanha["kind"] | null;
};

function paraDTO(r: Row): CampanhaDTO {
  return {
    id: r.id,
    nome: r.nome,
    scopeId: r.scope_id,
    scopeRotulo: r.scope_rotulo,
    alcanceContatos: r.alcance_contatos,
    alcancePessoas: r.alcance_pessoas,
    copy: r.copy,
    // `bigint` volta como string do driver — converter aqui evita "1024" + 1
    // virar "10241" na tela.
    midia: r.midia_id
      ? {
          id: r.midia_id,
          nome: r.midia_nome!,
          mime: r.midia_mime!,
          tamanho: Number(r.midia_tamanho),
          kind: r.midia_kind!,
        }
      : null,
    agendadaPara: r.agendada_para.toISOString(),
    status: r.status,
    motivoRecusa: r.motivo_recusa,
    criadaPorNome: r.criada_por_nome,
    criadaPorId: r.criada_por,
    revisadaPorNome: r.revisada_por_nome,
    revisadaEm: r.revisada_em?.toISOString() ?? null,
    criadaEm: r.criada_em.toISOString(),
    relatorio: r.rel_criado_em
      ? {
          entregues: r.rel_entregues,
          lidas: r.rel_lidas,
          respostas: r.rel_respostas,
          falhas: r.rel_falhas,
          observacoes: r.rel_observacoes,
          anexo: r.rel_anexo_id
            ? {
                id: r.rel_anexo_id,
                nome: r.rel_anexo_nome!,
                mime: r.rel_anexo_mime!,
                tamanho: Number(r.rel_anexo_tamanho),
                kind: r.rel_anexo_kind!,
              }
            : null,
          criadoPorNome: r.rel_autor_nome!,
          criadoEm: r.rel_criado_em.toISOString(),
        }
      : null,
  };
}

const SELECT = `
  select c.id, c.nome, c.scope_id, c.scope_rotulo, c.alcance_contatos, c.alcance_pessoas,
         c.copy, c.agendada_para, c.status, c.motivo_recusa, c.criada_em, c.criada_por,
         autor.nome as criada_por_nome,
         revisor.nome as revisada_por_nome,
         c.revisada_em,
         a.id as midia_id, a.nome_original as midia_nome, a.mime as midia_mime,
         a.tamanho as midia_tamanho, a.kind as midia_kind,
         rel.entregues as rel_entregues, rel.lidas as rel_lidas,
         rel.respostas as rel_respostas, rel.falhas as rel_falhas,
         rel.observacoes as rel_observacoes, rel.criado_em as rel_criado_em,
         relautor.nome as rel_autor_nome,
         ra.id as rel_anexo_id, ra.nome_original as rel_anexo_nome, ra.mime as rel_anexo_mime,
         ra.tamanho as rel_anexo_tamanho, ra.kind as rel_anexo_kind
    from campanhas c
    join usuarios autor on autor.id = c.criada_por
    left join usuarios revisor on revisor.id = c.revisada_por
    left join arquivos a on a.id = c.midia_id
    left join relatorios rel on rel.campanha_id = c.id
    left join usuarios relautor on relautor.id = rel.criado_por
    left join arquivos ra on ra.id = rel.anexo_id
`;

/** Lista conforme o papel: admin vê tudo, cliente vê o que criou. */
export async function listarCampanhas(sessao: Sessao): Promise<CampanhaDTO[]> {
  const rows =
    sessao.papel === "admin"
      ? await query<Row>(`${SELECT} order by c.criada_em desc`)
      : await query<Row>(`${SELECT} where c.criada_por = $1 order by c.criada_em desc`, [
          sessao.id,
        ]);
  return rows.map(paraDTO);
}

/** Busca uma campanha respeitando o papel. `null` se não existe OU não é sua. */
export async function buscarCampanha(sessao: Sessao, id: string): Promise<CampanhaDTO | null> {
  const row =
    sessao.papel === "admin"
      ? await queryOne<Row>(`${SELECT} where c.id = $1`, [id])
      : await queryOne<Row>(`${SELECT} where c.id = $1 and c.criada_por = $2`, [id, sessao.id]);
  return row ? paraDTO(row) : null;
}

export type NovaCampanha = {
  nome: string;
  scopeId: string;
  copy: string;
  midiaId: string | null;
  agendadaPara: string;
};

export async function criarCampanha(sessao: Sessao, entrada: NovaCampanha): Promise<CampanhaDTO> {
  const { getAlcance } = await import("./base");
  const alcance = getAlcance(entrada.scopeId);
  if (!alcance) throw new Error("Recorte de base inválido.");

  // O alcance NUNCA vem do cliente: é lido da base aqui. Confiar no número
  // enviado permitiria registrar uma campanha dizendo alcançar 10 milhões.
  const rows = await query<{ id: string }>(
    `insert into campanhas
       (nome, scope_id, scope_rotulo, alcance_contatos, alcance_pessoas, copy, midia_id, agendada_para, criada_por)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     returning id`,
    [
      entrada.nome,
      entrada.scopeId,
      alcance.rotulo,
      alcance.contatos,
      alcance.pessoas,
      entrada.copy,
      entrada.midiaId,
      entrada.agendadaPara,
      sessao.id,
    ],
  );

  const criada = await buscarCampanha(sessao, rows[0].id);
  if (!criada) throw new Error("Campanha criada mas não encontrada.");
  return criada;
}

/** Cancela. Autor pode cancelar a própria; admin pode cancelar qualquer uma. */
export async function cancelarCampanha(sessao: Sessao, id: string): Promise<void> {
  const rows =
    sessao.papel === "admin"
      ? await query("update campanhas set status='cancelada' where id=$1 returning id", [id])
      : await query(
          "update campanhas set status='cancelada' where id=$1 and criada_por=$2 returning id",
          [id, sessao.id],
        );
  if (rows.length === 0) throw new Error("Campanha não encontrada.");
}

/** Exclui e devolve o caminho da mídia órfã, para o chamador apagar do disco. */
export async function excluirCampanha(sessao: Sessao, id: string): Promise<string | null> {
  const alvo = await queryOne<{ caminho: string | null; midia_id: string | null }>(
    sessao.papel === "admin"
      ? `select a.caminho, c.midia_id from campanhas c left join arquivos a on a.id=c.midia_id where c.id=$1`
      : `select a.caminho, c.midia_id from campanhas c left join arquivos a on a.id=c.midia_id where c.id=$1 and c.criada_por=$2`,
    sessao.papel === "admin" ? [id] : [id, sessao.id],
  );
  if (!alvo) throw new Error("Campanha não encontrada.");

  await query("delete from campanhas where id=$1", [id]);
  if (alvo.midia_id) await query("delete from arquivos where id=$1", [alvo.midia_id]);
  return alvo.caminho;
}

/** Papéis autorizados a revisar (aprovar/recusar). */
export const PAPEL_REVISOR: Papel[] = ["admin"];

/* ─────────────────────────── APROVAÇÃO (só admin) ───────────────────────── */

function exigirAdmin(sessao: Sessao): void {
  if (sessao.papel !== "admin") {
    throw new Error("Apenas o administrador pode revisar campanhas.");
  }
}

/**
 * Aprova. O `and status='aguardando_aprovacao'` evita corrida: se duas abas
 * clicarem juntas, ou se a campanha já tiver sido cancelada pelo autor, a
 * segunda atualização não encontra linha e falha em vez de sobrescrever.
 */
export async function aprovarCampanha(sessao: Sessao, id: string): Promise<void> {
  exigirAdmin(sessao);
  const rows = await query(
    `update campanhas
        set status = 'aprovada', motivo_recusa = null,
            revisada_por = $2, revisada_em = now()
      where id = $1 and status = 'aguardando_aprovacao'
      returning id`,
    [id, sessao.id],
  );
  if (rows.length === 0) throw new Error("Campanha não está aguardando aprovação.");
}

export async function recusarCampanha(sessao: Sessao, id: string, motivo: string): Promise<void> {
  exigirAdmin(sessao);
  if (!motivo.trim()) throw new Error("Explique o motivo da recusa.");

  const rows = await query(
    `update campanhas
        set status = 'recusada', motivo_recusa = $3,
            revisada_por = $2, revisada_em = now()
      where id = $1 and status = 'aguardando_aprovacao'
      returning id`,
    [id, sessao.id, motivo.trim()],
  );
  if (rows.length === 0) throw new Error("Campanha não está aguardando aprovação.");
}

/* ─────────────────────────── RELATÓRIO (só admin) ───────────────────────── */

export type EntradaRelatorio = {
  campanhaId: string;
  entregues: number | null;
  lidas: number | null;
  respostas: number | null;
  falhas: number | null;
  observacoes: string | null;
  anexoId: string | null;
};

/**
 * Grava (ou atualiza) o relatório do disparo.
 *
 * `on conflict` porque a tabela tem um relatório por campanha: reenviar
 * corrige os números em vez de estourar erro de duplicidade.
 */
export async function salvarRelatorio(sessao: Sessao, r: EntradaRelatorio): Promise<void> {
  exigirAdmin(sessao);

  const campanha = await queryOne<{ status: StatusCampanha }>(
    "select status from campanhas where id = $1",
    [r.campanhaId],
  );
  if (!campanha) throw new Error("Campanha não encontrada.");
  if (campanha.status !== "aprovada") {
    throw new Error("Só campanha aprovada recebe relatório de disparo.");
  }

  await query(
    `insert into relatorios
       (campanha_id, entregues, lidas, respostas, falhas, observacoes, anexo_id, criado_por)
     values ($1,$2,$3,$4,$5,$6,$7,$8)
     on conflict (campanha_id) do update
       set entregues   = excluded.entregues,
           lidas       = excluded.lidas,
           respostas   = excluded.respostas,
           falhas      = excluded.falhas,
           observacoes = excluded.observacoes,
           anexo_id    = excluded.anexo_id,
           criado_por  = excluded.criado_por`,
    [
      r.campanhaId,
      r.entregues,
      r.lidas,
      r.respostas,
      r.falhas,
      r.observacoes?.trim() || null,
      r.anexoId,
      sessao.id,
    ],
  );
}
