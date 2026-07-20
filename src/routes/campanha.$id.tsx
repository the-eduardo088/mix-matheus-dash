import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CalendarClock,
  Clock,
  ExternalLink,
  MapPin,
  MessageSquare,
  Send,
  Trash2,
  User,
  Users,
} from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { exigirSessao } from "@/lib/guards";
import { BalaoWhatsApp } from "@/components/campaigns/BalaoWhatsApp";
import { MediaIcon } from "@/components/campaigns/MediaPreview";
import { FormularioRelatorio, RevisaoCampanha } from "@/components/campaigns/AcoesAdmin";
import { RelatorioCampanha } from "@/components/campaigns/RelatorioCampanha";
import { formatNumber } from "@/lib/mix-data";
import type { Sessao } from "@/lib/auth";
import {
  MEDIA_SPECS,
  STATUS_ROTULO,
  abaixoDaAntecedencia,
  buscarCampanha,
  cancelarCampanha,
  distanciaAte,
  excluirCampanha,
  formatarBytes,
  formatarDataHora,
  urlDoArquivo,
  type StatusCampanha,
} from "@/lib/campanhas";
import { useState } from "react";

export const Route = createFileRoute("/campanha/$id")({
  head: () => ({
    meta: [{ title: "Campanha · Mix Mateus" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  beforeLoad: ({ context, location }) => ({
    sessao: exigirSessao(context.sessao, location.href),
  }),
  // Carrega no servidor para a página abrir preenchida, com o cache pronto.
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["campanha", params.id],
      queryFn: () => buscarCampanha({ data: { id: params.id } }),
    }),
  component: DetalheCampanhaPage,
});

const STATUS_STYLE: Record<StatusCampanha, string> = {
  aguardando_aprovacao:
    "bg-[color:var(--warning)]/12 text-[color:var(--warning)] ring-[color:var(--warning)]/25",
  aprovada:
    "bg-[color:var(--success)]/12 text-[color:var(--success)] ring-[color:var(--success)]/25",
  recusada: "bg-destructive/10 text-destructive ring-destructive/20",
  cancelada: "bg-muted text-muted-foreground ring-border",
  rascunho: "bg-muted text-muted-foreground ring-border",
};

function DetalheCampanhaPage() {
  const { sessao } = Route.useRouteContext();
  return (
    <AppShell sessao={sessao}>
      <Detalhe sessao={sessao} />
    </AppShell>
  );
}

/** Uma linha rótulo → valor, com respiro. Espaçamento é o ponto desta tela. */
function Linha({
  icon,
  rotulo,
  children,
}: {
  icon: React.ReactNode;
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-3">
      <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="font-subtitle text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {rotulo}
        </p>
        <div className="mt-0.5 text-sm text-foreground">{children}</div>
      </div>
    </div>
  );
}

function Detalhe({ sessao }: { sessao: Sessao }) {
  const { id } = Route.useParams();
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  const {
    data: c,
    isPending,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["campanha", id],
    queryFn: () => buscarCampanha({ data: { id } }),
  });

  function recarregar() {
    void refetch();
    void router.invalidate();
  }

  async function agir(acao: () => Promise<unknown>, depois?: () => void) {
    setOcupado(true);
    setErroAcao(null);
    try {
      await acao();
      if (depois) depois();
      else recarregar();
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : "Não foi possível concluir a ação.");
      setOcupado(false);
    }
  }

  if (isPending) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-40 animate-pulse rounded-lg bg-muted" />
        <div className="h-96 animate-pulse rounded-2xl border bg-card" />
      </div>
    );
  }

  if (isError || !c) {
    return (
      <section className="rounded-2xl border bg-card p-8 text-center shadow-sm">
        <h2 className="font-display text-xl font-bold">Campanha não encontrada</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          Ela pode ter sido excluída, ou você não tem acesso a ela.
        </p>
        <Link
          to="/relatorios"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>
      </section>
    );
  }

  const prazoCurto = abaixoDaAntecedencia(c.agendadaPara, c.criadaEm);
  const encerrada = c.status === "cancelada" || c.status === "recusada";
  const ehAdmin = sessao.papel === "admin";

  function cancelar() {
    void agir(() => cancelarCampanha({ data: { id: c!.id } }));
  }
  function excluir() {
    if (!window.confirm(`Excluir a campanha "${c!.nome}"? Esta ação não pode ser desfeita.`))
      return;
    void agir(
      () => excluirCampanha({ data: { id: c!.id } }),
      () => router.navigate({ to: "/relatorios" }),
    );
  }

  return (
    <>
      {/* Voltar + título */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => router.history.back()}
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>

        <div className="no-print flex items-center gap-1.5">
          {!encerrada && (
            <button
              onClick={cancelar}
              disabled={ocupado}
              className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-muted disabled:opacity-50"
            >
              <Ban className="h-3.5 w-3.5" />
              Cancelar
            </button>
          )}
          <button
            onClick={excluir}
            disabled={ocupado}
            className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-destructive disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Excluir
          </button>
        </div>
      </div>

      <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{c.nome}</h1>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-subtitle text-[11px] font-semibold uppercase tracking-wider ring-1 ${STATUS_STYLE[c.status]}`}
          >
            {STATUS_ROTULO[c.status]}
          </span>
          {prazoCurto && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--warning)]/12 px-2.5 py-0.5 font-subtitle text-[11px] font-semibold uppercase tracking-wider text-[color:var(--warning)] ring-1 ring-[color:var(--warning)]/25">
              <AlertTriangle className="h-3 w-3" />
              Prazo curto
            </span>
          )}
        </div>

        {c.status === "recusada" && c.motivoRecusa && (
          <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <strong>Motivo da recusa:</strong> {c.motivoRecusa}
          </p>
        )}
        {erroAcao && (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
          >
            {erroAcao}
          </p>
        )}
      </section>

      {/* Duas colunas: dados à esquerda, prévia do WhatsApp à direita */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-start">
        <div className="space-y-6">
          {/* Segmentação e agendamento */}
          <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
            <h2 className="font-display text-base font-semibold">Segmentação e disparo</h2>
            <div className="mt-2 divide-y">
              <Linha icon={<Users className="h-4 w-4" />} rotulo="Base">
                {c.scopeRotulo}
                {c.cidade && (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    <MapPin className="h-3 w-3" />
                    {c.cidade}
                  </span>
                )}
              </Linha>
              <Linha icon={<Send className="h-4 w-4" />} rotulo="Alcance">
                {c.alcanceADefinir ? (
                  <span className="text-muted-foreground">A definir na segmentação</span>
                ) : (
                  <span>
                    <span className="font-num font-semibold">
                      {formatNumber(c.alcanceContatos)}
                    </span>{" "}
                    telefones ·{" "}
                    <span className="font-num font-semibold">{formatNumber(c.alcancePessoas)}</span>{" "}
                    pessoas
                  </span>
                )}
              </Linha>
              <Linha icon={<CalendarClock className="h-4 w-4" />} rotulo="Agendado para">
                <span className="font-num font-medium">{formatarDataHora(c.agendadaPara)}</span>
                {!encerrada && (
                  <span className="text-muted-foreground"> · {distanciaAte(c.agendadaPara)}</span>
                )}
              </Linha>
              <Linha icon={<User className="h-4 w-4" />} rotulo="Criada por">
                {c.criadaPorNome}{" "}
                <span className="text-muted-foreground">em {formatarDataHora(c.criadaEm)}</span>
              </Linha>
              {c.revisadaPorNome && c.revisadaEm && (
                <Linha icon={<Clock className="h-4 w-4" />} rotulo="Revisada por">
                  {c.revisadaPorNome}{" "}
                  <span className="text-muted-foreground">em {formatarDataHora(c.revisadaEm)}</span>
                </Linha>
              )}
            </div>
          </section>

          {/* Conteúdo: copy, anexo, botão */}
          <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
            <h2 className="flex items-center gap-2 font-display text-base font-semibold">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              Conteúdo da mensagem
            </h2>

            <div className="mt-4">
              <p className="font-subtitle text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Texto
              </p>
              <p className="mt-1.5 whitespace-pre-wrap break-words rounded-xl bg-muted/50 px-4 py-3 text-sm leading-relaxed">
                {c.copy}
              </p>
            </div>

            {c.midia && (
              <div className="mt-4">
                <p className="font-subtitle text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Anexo
                </p>
                <a
                  href={urlDoArquivo(c.midia.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1.5 flex items-center gap-3 rounded-xl border bg-background p-3 transition hover:bg-muted"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <MediaIcon kind={c.midia.kind} className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{c.midia.nome}</span>
                    <span className="font-num block text-xs text-muted-foreground">
                      {MEDIA_SPECS[c.midia.kind].label} · {formatarBytes(c.midia.tamanho)}
                    </span>
                  </span>
                  <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
                </a>
              </div>
            )}

            {c.botaoTexto && c.botaoUrl && (
              <div className="mt-4">
                <p className="font-subtitle text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Botão de link
                </p>
                <a
                  href={c.botaoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1.5 flex items-center gap-3 rounded-xl border bg-background p-3 transition hover:bg-muted"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#00a5f4]/10 text-[#00a5f4]">
                    <ExternalLink className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{c.botaoTexto}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {c.botaoUrl}
                    </span>
                  </span>
                </a>
              </div>
            )}
          </section>

          {/* Ações do admin / relatório */}
          {ehAdmin && c.status === "aguardando_aprovacao" && (
            <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
              <RevisaoCampanha c={c} onMudou={recarregar} />
            </section>
          )}

          {c.relatorio ? (
            <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
              <RelatorioCampanha relatorio={c.relatorio} campanha={c} />
              {ehAdmin && <FormularioRelatorio c={c} onMudou={recarregar} />}
            </section>
          ) : (
            ehAdmin &&
            c.status === "aprovada" && (
              <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
                <FormularioRelatorio c={c} onMudou={recarregar} />
              </section>
            )
          )}

          {c.status === "aprovada" && !c.relatorio && !ehAdmin && (
            <p className="rounded-2xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
              Campanha aprovada. O relatório do disparo aparece aqui assim que a ATONNS o anexar.
            </p>
          )}
        </div>

        {/* Prévia do WhatsApp, grudada ao rolar */}
        <div className="lg:sticky lg:top-32">
          <p className="font-subtitle mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Como chega no celular
          </p>
          <BalaoWhatsApp
            copy={c.copy}
            midia={c.midia}
            botaoTexto={c.botaoTexto}
            botaoUrl={c.botaoUrl}
          />
        </div>
      </div>
    </>
  );
}
