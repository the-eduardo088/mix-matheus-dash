import { useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ClipboardList, Inbox, Send } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { StatCard } from "@/components/dashboard/StatCard";
import { CampanhaCard } from "@/components/campaigns/CampanhaCard";
import { exigirPapel } from "@/lib/guards";
import { formatNumber } from "@/lib/mix-data";
import type { Sessao } from "@/lib/auth";
import { listarCampanhas, type StatusCampanha } from "@/lib/campanhas";

export const Route = createFileRoute("/aprovacoes")({
  head: () => ({
    meta: [{ title: "Aprovações · Mix Mateus" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  // Área do administrador. Quem não é admin é devolvido para a home antes de
  // a página montar — a checagem roda no servidor, não só na tela.
  beforeLoad: ({ context, location }) => ({
    sessao: exigirPapel(context.sessao, location.href, "admin"),
  }),
  // Carrega no SERVIDOR, não só depois da hidratação. Assim a lista já vem no
  // HTML: a página abre preenchida e, se a consulta falhar, o erro aparece em
  // vez de uma tela vazia que parece "nenhuma campanha".
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["campanhas"],
      queryFn: () => listarCampanhas(),
    }),
  component: AprovacoesPage,
});

function AprovacoesPage() {
  const { sessao } = Route.useRouteContext();
  return (
    <AppShell sessao={sessao}>
      <Aprovacoes sessao={sessao} />
    </AppShell>
  );
}

const FILTROS: { id: StatusCampanha | "todas"; rotulo: string }[] = [
  { id: "aguardando_aprovacao", rotulo: "Aguardando" },
  { id: "aprovada", rotulo: "Aprovadas" },
  { id: "recusada", rotulo: "Recusadas" },
  { id: "cancelada", rotulo: "Canceladas" },
  { id: "todas", rotulo: "Todas" },
];

function Aprovacoes({ sessao }: { sessao: Sessao }) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<StatusCampanha | "todas">("aguardando_aprovacao");

  const {
    data: campanhas,
    isPending,
    isError,
    refetch,
  } = useQuery({ queryKey: ["campanhas"], queryFn: () => listarCampanhas() });

  const lista = campanhas ?? [];
  const pendentes = lista.filter((c) => c.status === "aguardando_aprovacao");
  const aprovadas = lista.filter((c) => c.status === "aprovada");
  const semRelatorio = aprovadas.filter((c) => !c.relatorio);

  const visiveis = filtro === "todas" ? lista : lista.filter((c) => c.status === filtro);

  function recarregar() {
    void refetch();
    void router.invalidate();
  }

  function contar(id: StatusCampanha | "todas") {
    return id === "todas" ? lista.length : lista.filter((c) => c.status === id).length;
  }

  return (
    <>
      <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        <p className="font-subtitle text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
          Administração
        </p>
        <h2 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Campanhas enviadas
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Tudo que o Mix Mateus enviou. Aprove ou recuse, e anexe o relatório depois do disparo.
        </p>
      </section>

      {/* O que exige ação sua, em números */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard
          label="Aguardando aprovação"
          value={formatNumber(pendentes.length)}
          hint={
            pendentes.length > 0 ? <span>Precisam da sua revisão</span> : <span>Nada pendente</span>
          }
          icon={<ClipboardList className="h-5 w-5" />}
          accent={pendentes.length > 0 ? "amber" : "muted"}
        />
        <StatCard
          label="Aprovadas"
          value={formatNumber(aprovadas.length)}
          hint={<span>Liberadas para disparo</span>}
          icon={<CheckCircle2 className="h-5 w-5" />}
          accent="success"
        />
        <StatCard
          label="Sem relatório"
          value={formatNumber(semRelatorio.length)}
          hint={<span>Aprovadas aguardando os números</span>}
          icon={<Inbox className="h-5 w-5" />}
          accent={semRelatorio.length > 0 ? "violet" : "muted"}
        />
      </section>

      <section>
        <ChartCard
          title="Campanhas"
          subtitle={`${visiveis.length} em "${FILTROS.find((f) => f.id === filtro)?.rotulo}"`}
          icon={<ClipboardList className="h-4 w-4" />}
        >
          <div className="no-print mb-4 flex flex-wrap gap-1.5">
            {FILTROS.map((f) => {
              const n = contar(f.id);
              const ativo = filtro === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setFiltro(f.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    ativo
                      ? "bg-primary text-primary-foreground"
                      : "border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {f.rotulo}
                  <span className={`font-num ${ativo ? "opacity-80" : "opacity-60"}`}>{n}</span>
                </button>
              );
            })}
          </div>

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
          ) : visiveis.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-card/50 px-6 py-14 text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-muted text-muted-foreground">
                <Inbox className="h-7 w-7" />
              </div>
              <h3 className="mt-5 font-display text-lg font-semibold tracking-tight">
                {lista.length === 0
                  ? "Nenhuma campanha ainda"
                  : `Nenhuma campanha em "${FILTROS.find((f) => f.id === filtro)?.rotulo}"`}
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                {lista.length === 0 ? (
                  <>
                    Assim que alguém do Mix Mateus enviar uma campanha, ela aparece aqui para
                    aprovação. Você também pode criar uma para testar o fluxo.
                  </>
                ) : (
                  <>Existem {lista.length} campanha(s) em outros status — use os filtros acima.</>
                )}
              </p>
              {lista.length === 0 && (
                <Link
                  to="/campanhas"
                  className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
                >
                  <Send className="h-4 w-4" />
                  Criar campanha de teste
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {visiveis.map((c) => (
                <CampanhaCard key={c.id} c={c} sessao={sessao} onMudou={recarregar} />
              ))}
            </div>
          )}
        </ChartCard>
      </section>
    </>
  );
}
