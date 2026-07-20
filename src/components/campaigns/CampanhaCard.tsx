import { useState } from "react";
import { AlertTriangle, Ban, CalendarClock, MapPin, Send, Trash2, User, Users } from "lucide-react";

import { MediaIcon, MediaThumb } from "@/components/campaigns/MediaPreview";
import { FormularioRelatorio, RevisaoCampanha } from "@/components/campaigns/AcoesAdmin";
import { RelatorioCampanha } from "@/components/campaigns/RelatorioCampanha";
import { formatNumber } from "@/lib/mix-data";
import type { Sessao } from "@/lib/auth";
import {
  MEDIA_SPECS,
  STATUS_ROTULO,
  abaixoDaAntecedencia,
  cancelarCampanha,
  distanciaAte,
  excluirCampanha,
  formatarBytes,
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
 * Card de campanha, compartilhado entre Aprovações e Relatórios.
 *
 * Ele já se adapta ao papel: os botões de aprovar/recusar e o formulário de
 * relatório só aparecem para o admin.
 */
export function CampanhaCard({
  c,
  sessao,
  onMudou,
}: {
  c: CampanhaDTO;
  sessao: Sessao;
  onMudou: () => void;
}) {
  const encerrada = c.status === "cancelada" || c.status === "recusada";
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function agir(acao: () => Promise<unknown>) {
    setOcupado(true);
    setErro(null);
    try {
      await acao();
      onMudou();
    } catch (e) {
      // Sem isso, a promise rejeitava dentro do onClick e a tela não mudava —
      // o usuário clicava e o card ficava lá, sem explicação.
      setErro(e instanceof Error ? e.message : "Não foi possível concluir a ação.");
      setOcupado(false);
    }
  }

  function cancelar() {
    void agir(() => cancelarCampanha({ data: { id: c.id } }));
  }

  function excluir() {
    // Exclusão apaga campanha e anexo do disco de vez — confirma antes.
    if (!window.confirm(`Excluir a campanha "${c.nome}"? Esta ação não pode ser desfeita.`)) return;
    void agir(() => excluirCampanha({ data: { id: c.id } }));
  }

  return (
    <div
      className={`rounded-2xl border bg-card p-5 shadow-sm transition ${encerrada ? "opacity-70" : "hover:shadow-md"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-base font-semibold tracking-tight">{c.nome}</h3>
            <span
              className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 font-subtitle text-[10px] font-semibold uppercase tracking-wider ring-1 ${STATUS_STYLE[c.status]}`}
            >
              {STATUS_ROTULO[c.status]}
            </span>
            {/* Agendada com menos de 24 h de folga: não bloqueia, mas quem
                aprova precisa ver antes de decidir. */}
            {abaixoDaAntecedencia(c.agendadaPara, c.criadaEm) && (
              <span
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[color:var(--warning)]/12 px-2 py-0.5 font-subtitle text-[10px] font-semibold uppercase tracking-wider text-[color:var(--warning)] ring-1 ring-[color:var(--warning)]/25"
                title="Agendada com menos de 24 h de antecedência"
              >
                <AlertTriangle className="h-3 w-3" />
                Prazo curto
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
            {/* O admin vê campanha de várias pessoas — precisa saber de quem é */}
            {sessao.papel === "admin" && (
              <span className="inline-flex items-center gap-1">
                <User className="h-3 w-3" />
                {c.criadaPorNome}
              </span>
            )}
          </p>
        </div>

        <div className="no-print flex shrink-0 items-center gap-1">
          {!encerrada && (
            <button
              onClick={cancelar}
              disabled={ocupado}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
              title="Cancelar campanha"
            >
              <Ban className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Cancelar</span>
            </button>
          )}
          <button
            onClick={excluir}
            disabled={ocupado}
            className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-destructive disabled:opacity-50"
            aria-label={`Excluir campanha ${c.nome}`}
            title="Excluir"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {c.status === "recusada" && c.motivoRecusa && (
        <p className="mt-3 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <strong>Motivo da recusa:</strong> {c.motivoRecusa}
        </p>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5" />
              <span className="font-num font-medium text-foreground">
                {formatarDataHora(c.agendadaPara)}
              </span>
              {!encerrada && <span>· {distanciaAte(c.agendadaPara)}</span>}
            </span>
            {c.alcanceADefinir ? (
              // Campanha por cidade: o volume só existe depois da segmentação.
              // Mostrar 0 aqui afirmaria que ela não alcança ninguém.
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Send className="h-3.5 w-3.5" />
                Alcance a definir na segmentação
              </span>
            ) : (
              <>
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Send className="h-3.5 w-3.5" />
                  <span className="font-num font-medium text-foreground">
                    {formatNumber(c.alcanceContatos)}
                  </span>
                  telefones
                </span>
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  <span className="font-num font-medium text-foreground">
                    {formatNumber(c.alcancePessoas)}
                  </span>
                  pessoas
                </span>
              </>
            )}
          </div>

          <p className="whitespace-pre-wrap break-words rounded-xl bg-muted/50 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
            {c.copy}
          </p>
        </div>

        {c.midia && <MediaThumb midia={c.midia} />}
      </div>

      {/* Fila de aprovação: só o admin vê, e só enquanto pendente */}
      {sessao.papel === "admin" && c.status === "aguardando_aprovacao" && (
        <RevisaoCampanha c={c} onMudou={onMudou} />
      )}

      {/* Relatório: o admin anexa, os dois leem */}
      {c.relatorio ? (
        <RelatorioCampanha relatorio={c.relatorio} campanha={c} />
      ) : (
        sessao.papel === "admin" &&
        c.status === "aprovada" && <FormularioRelatorio c={c} onMudou={onMudou} />
      )}
      {c.relatorio && sessao.papel === "admin" && <FormularioRelatorio c={c} onMudou={onMudou} />}

      {c.status === "aprovada" && !c.relatorio && sessao.papel !== "admin" && (
        <p className="mt-4 rounded-xl border border-dashed px-3 py-2.5 text-xs text-muted-foreground">
          Campanha aprovada. O relatório do disparo aparece aqui assim que a ATONNS o anexar.
        </p>
      )}

      {erro && (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive"
        >
          {erro}
        </p>
      )}

      <p className="mt-3 flex flex-wrap items-center gap-1 border-t pt-3 font-subtitle text-[11px] text-muted-foreground">
        {c.midia && (
          <span className="inline-flex items-center gap-1">
            <MediaIcon kind={c.midia.kind} className="h-3 w-3" />
            {MEDIA_SPECS[c.midia.kind].label} · {formatarBytes(c.midia.tamanho)} ·
          </span>
        )}
        <span>Criada em {formatarDataHora(c.criadaEm)}</span>
        {c.revisadaPorNome && c.revisadaEm && (
          <span>
            · Revisada por {c.revisadaPorNome} em {formatarDataHora(c.revisadaEm)}
          </span>
        )}
      </p>
    </div>
  );
}
