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
} from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { StatCard } from "@/components/dashboard/StatCard";
import { CampanhaCard } from "@/components/campaigns/CampanhaCard";
import { exigirSessao } from "@/lib/guards";
import { formatNumber } from "@/lib/mix-data";
import type { Sessao } from "@/lib/auth";
import { listarCampanhas, somarMetrica } from "@/lib/campanhas";

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
  // Carrega no SERVIDOR, não só depois da hidratação. Assim a lista já vem no
  // HTML: a página abre preenchida e, se a consulta falhar, o erro aparece em
  // vez de uma tela vazia que parece "nenhuma campanha".
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["campanhas"],
      queryFn: () => listarCampanhas(),
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
  const semAlcance = ativas.filter((c) => c.alcanceADefinir).length;
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
            hint={
              semAlcance > 0 ? (
                <span>
                  Fora {semAlcance} campanha(s) por cidade, cujo volume sai na segmentação
                </span>
              ) : (
                <span>Telefones das bases selecionadas</span>
              )
            }
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
