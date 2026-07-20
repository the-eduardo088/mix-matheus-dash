import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Ban,
  CalendarClock,
  CheckCheck,
  Eye,
  Inbox,
  Info,
  MessageSquare,
  PlugZap,
  Send,
  Trash2,
  User,
  Users,
} from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { StatCard } from "@/components/dashboard/StatCard";
import { MediaIcon, MediaThumb } from "@/components/campaigns/MediaPreview";
import { FormularioRelatorio, RevisaoCampanha } from "@/components/campaigns/AcoesAdmin";
import { RelatorioCampanha } from "@/components/campaigns/RelatorioCampanha";
import { exigirSessao } from "@/lib/guards";
import { formatNumber } from "@/lib/mix-data";
import type { Sessao } from "@/lib/auth";
import {
  MEDIA_SPECS,
  STATUS_ROTULO,
  cancelarCampanha,
  distanciaAte,
  excluirCampanha,
  formatarBytes,
  formatarDataHora,
  listarCampanhas,
  somarMetrica,
  type CampanhaDTO,
  type StatusCampanha,
} from "@/lib/campanhas";

export const Route = createFileRoute("/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios de campanha · Mix Mateus" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  beforeLoad: ({ context, location }) => ({
    sessao: exigirSessao(context.sessao, location.href),
  }),
  component: RelatoriosPage,
});

/**
 * KPI sem dado disponível. Deliberadamente não exibe número: enquanto não
 * houver integração de disparo, qualquer valor aqui seria inventado — e o
 * painel já convive com dados projetados sendo lidos como medidos.
 */
function MetricaDisparo({
  label,
  valor,
  icon,
  accent,
}: {
  label: string;
  valor: number | null;
  icon: React.ReactNode;
  accent?: string;
}) {
  // Sem número, o card fica tracejado e vazio — nunca zero. Zero afirmaria que
  // ninguém recebeu; vazio diz que ainda não foi medido, que é a verdade.
  if (valor == null) {
    return (
      <div className="rounded-2xl border border-dashed bg-card/50 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-subtitle text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {label}
            </p>
            <p className="mt-2 font-display text-3xl font-bold leading-none tracking-tight text-muted-foreground/40">
              —
            </p>
            <p className="mt-2 text-xs text-muted-foreground">Aguardando dados do disparo</p>
          </div>
          <div className="shrink-0 rounded-xl bg-muted p-2.5 text-muted-foreground/50">{icon}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-subtitle text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p
            className={`font-num mt-2 font-display text-3xl font-bold leading-none tracking-tight ${accent ?? "text-foreground"}`}
          >
            {formatNumber(valor)}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">Somado dos relatórios anexados</p>
        </div>
        <div className={`shrink-0 rounded-xl bg-muted p-2.5 ${accent ?? "text-muted-foreground"}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

const STATUS_STYLE: Record<StatusCampanha, string> = {
  aguardando_aprovacao:
    "bg-[color:var(--warning)]/12 text-[color:var(--warning)] ring-[color:var(--warning)]/25",
  aprovada:
    "bg-[color:var(--success)]/12 text-[color:var(--success)] ring-[color:var(--success)]/25",
  recusada: "bg-destructive/10 text-destructive ring-destructive/20",
  cancelada: "bg-muted text-muted-foreground ring-border",
  rascunho: "bg-muted text-muted-foreground ring-border",
};

function CampanhaCard({
  c,
  sessao,
  onMudou,
}: {
  c: CampanhaDTO;
  sessao: Sessao;
  onMudou: () => void;
}) {
  const encerrada = c.status === "cancelada" || c.status === "recusada";

  async function cancelar() {
    await cancelarCampanha({ data: { id: c.id } });
    onMudou();
  }

  async function excluir() {
    await excluirCampanha({ data: { id: c.id } });
    onMudou();
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
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
            <span>{c.scopeRotulo}</span>
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
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
              title="Cancelar campanha"
            >
              <Ban className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Cancelar</span>
            </button>
          )}
          <button
            onClick={excluir}
            className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-destructive"
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

function EstadoVazio({ ehAdmin }: { ehAdmin: boolean }) {
  return (
    <div className="rounded-2xl border border-dashed bg-card/50 px-6 py-16 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-muted text-muted-foreground">
        <Inbox className="h-7 w-7" />
      </div>
      <h3 className="mt-5 font-display text-lg font-semibold tracking-tight">
        Nenhuma campanha ainda
      </h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
        {ehAdmin
          ? "Quando o Mix Mateus enviar uma campanha, ela aparece aqui para aprovação."
          : "As campanhas enviadas aparecem aqui, com a base, a mensagem e o horário de disparo."}
      </p>
      <Link
        to="/campanhas"
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
      >
        <Send className="h-4 w-4" />
        Criar campanha
      </Link>
    </div>
  );
}

function RelatoriosPage() {
  const { sessao } = Route.useRouteContext();
  return (
    <AppShell sessao={sessao}>
      <Relatorios sessao={sessao} />
    </AppShell>
  );
}

function Relatorios({ sessao }: { sessao: Sessao }) {
  const router = useRouter();
  const {
    data: campanhas,
    isPending,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["campanhas"],
    queryFn: () => listarCampanhas(),
  });

  const lista = campanhas ?? [];
  const ativas = lista.filter((c) => c.status !== "cancelada" && c.status !== "recusada");
  const alcanceTotal = ativas.reduce((s, c) => s + c.alcanceContatos, 0);
  const pendentes = lista.filter((c) => c.status === "aguardando_aprovacao").length;
  const comRelatorio = lista.filter((c) => c.relatorio).length;

  function recarregar() {
    void refetch();
    void router.invalidate();
  }

  return (
    <>
      <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-subtitle text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              Relatórios
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Campanhas de WhatsApp
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {sessao.papel === "admin"
                ? "Todas as campanhas do painel."
                : "As campanhas que você enviou."}
            </p>
          </div>
          <Link
            to="/campanhas"
            className="no-print inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
          >
            <Send className="h-4 w-4" />
            Nova campanha
          </Link>
        </div>
      </section>

      {/* Separação explícita: o que é medido de verdade vs. o que falta integrar. */}
      <section>
        <h3 className="font-subtitle mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Planejado · calculado a partir da base
        </h3>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <StatCard
            label="Campanhas ativas"
            value={formatNumber(ativas.length)}
            hint={<span>{lista.length} no total</span>}
            icon={<CalendarClock className="h-5 w-5" />}
            accent="violet"
          />
          <StatCard
            label="Aguardando aprovação"
            value={formatNumber(pendentes)}
            hint={
              <span>
                {sessao.papel === "admin" ? "Esperando sua revisão" : "Em análise pela ATONNS"}
              </span>
            }
            icon={<Info className="h-5 w-5" />}
            accent="amber"
          />
          <StatCard
            label="Alcance planejado"
            value={formatNumber(alcanceTotal)}
            hint={<span>Telefones das bases selecionadas</span>}
            icon={<Send className="h-5 w-5" />}
            accent="success"
          />
        </div>
      </section>

      <section>
        <h3 className="font-subtitle mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Desempenho do disparo · requer integração
        </h3>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricaDisparo
            label="Entregues"
            valor={somarMetrica(lista, "entregues")}
            icon={<CheckCheck className="h-5 w-5" />}
            accent="text-[color:var(--success)]"
          />
          <MetricaDisparo
            label="Lidas"
            valor={somarMetrica(lista, "lidas")}
            icon={<Eye className="h-5 w-5" />}
          />
          <MetricaDisparo
            label="Respostas"
            valor={somarMetrica(lista, "respostas")}
            icon={<MessageSquare className="h-5 w-5" />}
          />
          <MetricaDisparo
            label="Falhas"
            valor={somarMetrica(lista, "falhas")}
            icon={<Ban className="h-5 w-5" />}
            accent="text-destructive"
          />
        </div>

        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-[color:var(--warning)]/40 bg-[color:var(--warning)]/10 p-4">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--warning)]" />
          <div className="text-xs leading-relaxed text-foreground">
            <p>
              <strong>Estes números ficam vazios de propósito.</strong> O painel não está conectado
              a nenhuma plataforma de disparo, então não existe dado real de entrega, leitura ou
              resposta — e preencher com estimativa seria apresentar suposição como medição.
            </p>
            <p className="mt-2 inline-flex items-center gap-1.5 text-muted-foreground">
              <PlugZap className="h-3.5 w-3.5" />
              Em breve o administrador poderá anexar o relatório do disparo aqui.
            </p>
          </div>
        </div>
      </section>

      <section>
        <ChartCard
          title="Campanhas registradas"
          subtitle={`${lista.length} no total · mais recentes primeiro`}
          icon={<Inbox className="h-4 w-4" />}
        >
          {isPending ? (
            <div className="space-y-4">
              {[0, 1].map((i) => (
                <div key={i} className="h-40 animate-pulse rounded-2xl border bg-muted/30" />
              ))}
            </div>
          ) : isError ? (
            <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              Não foi possível carregar as campanhas. Recarregue a página.
            </p>
          ) : lista.length === 0 ? (
            <EstadoVazio ehAdmin={sessao.papel === "admin"} />
          ) : (
            <div className="space-y-4">
              {lista.map((c) => (
                <CampanhaCard key={c.id} c={c} sessao={sessao} onMudou={recarregar} />
              ))}
            </div>
          )}
        </ChartCard>
      </section>
    </>
  );
}
