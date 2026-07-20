import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  CalendarClock,
  ChevronRight,
  ExternalLink,
  MapPin,
  Paperclip,
  Send,
  User,
} from "lucide-react";

import { MediaIcon } from "@/components/campaigns/MediaPreview";
import { formatNumber } from "@/lib/mix-data";
import type { Sessao } from "@/lib/auth";
import {
  STATUS_ROTULO,
  abaixoDaAntecedencia,
  distanciaAte,
  formatarDataHora,
  type CampanhaDTO,
  type StatusCampanha,
} from "@/lib/campanhas";

const STATUS_STYLE: Record<StatusCampanha, string> = {
  aguardando_aprovacao:
    "bg-[color:var(--warning)]/12 text-[color:var(--warning)] ring-[color:var(--warning)]/25",
  aprovada:
    "bg-[color:var(--success)]/12 text-[color:var(--success)] ring-[color:var(--success)]/25",
  recusada: "bg-destructive/10 text-destructive ring-destructive/20",
  cancelada: "bg-muted text-muted-foreground ring-border",
  rascunho: "bg-muted text-muted-foreground ring-border",
};

/**
 * Resumo clicável de uma campanha, na lista de Aprovações e Relatórios.
 *
 * É deliberadamente enxuto: o card antes empilhava copy, mídia, ações de
 * aprovação e formulário de relatório num bloco só, ficando tudo apertado. As
 * ações e o conteúdo completo vivem agora na tela de detalhe (`/campanha/$id`),
 * que este card abre ao clique. O `sessao` fica na assinatura porque a lista já
 * o passa e o detalhe pode precisar diferenciar — mas o resumo é igual para os
 * dois papéis.
 */
export function CampanhaCard({ c }: { c: CampanhaDTO; sessao?: Sessao; onMudou?: () => void }) {
  const encerrada = c.status === "cancelada" || c.status === "recusada";
  const prazoCurto = abaixoDaAntecedencia(c.agendadaPara, c.criadaEm);
  const temRelatorio = !!c.relatorio;

  return (
    <Link
      to="/campanha/$id"
      params={{ id: c.id }}
      className={`group block rounded-2xl border bg-card p-5 shadow-sm transition hover:border-primary/40 hover:shadow-md ${
        encerrada ? "opacity-70" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-base font-semibold tracking-tight">{c.nome}</h3>
            <span
              className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 font-subtitle text-[10px] font-semibold uppercase tracking-wider ring-1 ${STATUS_STYLE[c.status]}`}
            >
              {STATUS_ROTULO[c.status]}
            </span>
            {prazoCurto && (
              <span
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[color:var(--warning)]/12 px-2 py-0.5 font-subtitle text-[10px] font-semibold uppercase tracking-wider text-[color:var(--warning)] ring-1 ring-[color:var(--warning)]/25"
                title="Agendada com menos de 24 h de antecedência"
              >
                <AlertTriangle className="h-3 w-3" />
                Prazo curto
              </span>
            )}
            {temRelatorio && (
              <span className="inline-flex shrink-0 items-center rounded-full bg-[color:var(--success)]/12 px-2 py-0.5 font-subtitle text-[10px] font-semibold uppercase tracking-wider text-[color:var(--success)] ring-1 ring-[color:var(--success)]/25">
                Com relatório
              </span>
            )}
          </div>

          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{c.scopeRotulo}</span>
            {c.cidade && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                <MapPin className="h-3 w-3" />
                {c.cidade}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <User className="h-3 w-3" />
              {c.criadaPorNome}
            </span>
          </p>
        </div>

        <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
      </div>

      {/* Uma linha de resumo — sem empilhar a copy inteira nem a mídia */}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <CalendarClock className="h-3.5 w-3.5" />
          <span className="font-num font-medium text-foreground">
            {formatarDataHora(c.agendadaPara)}
          </span>
          {!encerrada && <span>· {distanciaAte(c.agendadaPara)}</span>}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Send className="h-3.5 w-3.5" />
          {c.alcanceADefinir ? (
            "Alcance a definir"
          ) : (
            <>
              <span className="font-num font-medium text-foreground">
                {formatNumber(c.alcanceContatos)}
              </span>
              telefones
            </>
          )}
        </span>
        {c.midia && (
          <span className="inline-flex items-center gap-1.5">
            <MediaIcon kind={c.midia.kind} className="h-3.5 w-3.5" />
            Anexo
          </span>
        )}
        {c.botaoTexto && (
          <span className="inline-flex items-center gap-1.5">
            <ExternalLink className="h-3.5 w-3.5" />
            {c.botaoTexto}
          </span>
        )}
      </div>

      {/* Prévia curta da mensagem (uma linha), com reticências */}
      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Paperclip className="hidden h-3 w-3" />
        <span className="line-clamp-1 italic">"{c.copy}"</span>
      </p>
    </Link>
  );
}
