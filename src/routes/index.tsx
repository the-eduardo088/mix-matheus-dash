import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Phone,
  MessageCircle,
  Users,
  Signal,
  BarChart3,
  Building2,
  GraduationCap,
  Briefcase,
  Wallet,
  Sun,
  Moon,
  Laptop,
  LogOut,
  Layers,
} from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";

import { isAuthed, clearAuthed } from "@/lib/auth";
import { LoginScreen } from "@/components/auth/LoginScreen";
import {
  NA_FILL,
  PRESTADORA_COLORS,
  SEXO_COLORS,
  formatCompact,
  formatCurrency,
  formatNumber,
  formatPercent,
  getScope,
  meta,
  pct,
  rampFill,
  scopes,
  toBuckets,
} from "@/lib/mix-data";
import { StatCard } from "@/components/dashboard/StatCard";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { DonutChart } from "@/components/dashboard/DonutChart";
import { DownloadMenu } from "@/components/dashboard/DownloadMenu";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mix Mateus · Painel da Base para Campanhas de WhatsApp" },
      {
        name: "description",
        content:
          "Painel analítico restrito da base Mix Mateus: telefones por cluster, operadoras, perfil demográfico e cobertura regional. Segmentação e disparos por ATONNS Tecnologia.",
      },
    ],
  }),
  component: PainelGate,
});

/**
 * Portão de acesso: enquanto não autenticado, renderiza a tela de login.
 * O servidor sempre renderiza como "não autenticado" (o dashboard nunca vai no
 * HTML inicial); no cliente, o efeito confere a sessão e libera o painel.
 */
function PainelGate() {
  const [authed, setAuthedState] = useState(false);

  useEffect(() => {
    if (isAuthed()) setAuthedState(true);
  }, []);

  if (!authed) return <LoginScreen onSuccess={() => setAuthedState(true)} />;
  return <Dashboard onLogout={() => setAuthedState(false)} />;
}

type ThemeMode = "auto" | "light" | "dark";

function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>("auto");

  function apply(next: ThemeMode) {
    setMode(next);
    const root = document.documentElement;
    if (next === "auto") {
      const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.toggle("dark", dark);
    } else {
      root.classList.toggle("dark", next === "dark");
    }
  }

  const opts: { id: ThemeMode; icon: any; label: string }[] = [
    { id: "auto", icon: Laptop, label: "Auto" },
    { id: "light", icon: Sun, label: "Claro" },
    { id: "dark", icon: Moon, label: "Escuro" },
  ];

  const activeOpt = opts.find((o) => o.id === mode) ?? opts[0];
  const CurrentIcon = activeOpt.icon;
  function cycle() {
    const idx = opts.findIndex((o) => o.id === mode);
    apply(opts[(idx + 1) % opts.length].id);
  }

  return (
    <>
      {/* Mobile: um único botão que alterna Auto → Claro → Escuro (economiza espaço no header) */}
      <button
        onClick={cycle}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-card text-muted-foreground shadow-sm transition hover:text-foreground sm:hidden"
        aria-label={`Tema: ${activeOpt.label} — toque para alternar`}
        title={`Tema: ${activeOpt.label}`}
      >
        <CurrentIcon className="h-4 w-4" />
      </button>

      {/* Desktop: controle segmentado com os três modos */}
      <div className="hidden items-center gap-1 rounded-full border bg-card p-1 shadow-sm sm:inline-flex">
        {opts.map((o) => {
          const Icon = o.icon;
          const active = mode === o.id;
          return (
            <button
              key={o.id}
              onClick={() => apply(o.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
              aria-label={`Tema ${o.label}`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{o.label}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

function TooltipBox({ active, payload, label, unit = "" }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg">
      {label && <p className="mb-1 font-semibold text-popover-foreground">{label}</p>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: p.color ?? p.payload?.fill }}
          />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-num font-semibold text-popover-foreground">
            {formatNumber(p.value)}
            {unit}
          </span>
        </div>
      ))}
    </div>
  );
}

function Dashboard({ onLogout }: { onLogout: () => void }) {
  function handleLogout() {
    clearAuthed();
    onLogout();
  }

  const [scopeId, setScopeId] = useState<string>("geral");
  const scope = getScope(scopeId);

  const totalContatos = scope.contatos;
  const totalPessoas = scope.pessoas;

  // Operadora — carrier-recognisable hues (identity, not rank)
  const prestadoraData = useMemo(
    () =>
      toBuckets(scope.prestadora, meta.ordens.prest)
        .filter((b) => b.value > 0)
        .map((b) => ({ name: b.key, value: b.value, fill: PRESTADORA_COLORS[b.key] ?? NA_FILL })),
    [scope],
  );

  // Faixa etária — ordered dimension → sequential amber ramp (light = novo, escuro = idoso)
  const idadeData = useMemo(() => {
    const buckets = toBuckets(scope.idade_g, meta.ordens.idade_g);
    const ordered = buckets.filter((b) => b.key !== "Não informado");
    return buckets.map((b) => ({
      faixa: b.key,
      contatos: b.value,
      fill: b.key === "Não informado" ? NA_FILL : rampFill("idade", ordered.indexOf(b), ordered.length),
    }));
  }, [scope]);

  // Faixa de renda — ordered dimension → sequential blue ramp (light = baixa, escuro = alta)
  const rendaData = useMemo(() => {
    const buckets = toBuckets(scope.renda_f, meta.ordens.renda_f);
    const ordered = buckets.filter((b) => b.key !== "Não informado");
    return buckets.map((b) => ({
      faixa: b.key,
      contatos: b.value,
      fill: b.key === "Não informado" ? NA_FILL : rampFill("renda", ordered.indexOf(b), ordered.length),
    }));
  }, [scope]);

  // Classe — ordered A→E → rampa violeta. Invertida: A (classe mais alta) recebe
  // o tom mais forte/escuro, coerente com "quanto mais alto, mais escuro".
  const classeData = useMemo(() => {
    const ordered = toBuckets(scope.classe, meta.ordens.classe).filter(
      (b) => b.key !== "Não informado" && b.value > 0,
    );
    return ordered.map((b, i) => ({
      name: b.key,
      value: b.value,
      fill: rampFill("classe", ordered.length - 1 - i, ordered.length),
    }));
  }, [scope]);

  const sexoData = useMemo(
    () =>
      toBuckets(scope.sexo, meta.ordens.sexo)
        .filter((b) => b.value > 0)
        .map((b) => ({ name: b.key, value: b.value, fill: SEXO_COLORS[b.key] ?? NA_FILL })),
    [scope],
  );

  const cboData = useMemo(
    () =>
      toBuckets(scope.cbo)
        .filter((b) => b.key !== "Não informado")
        .slice(0, 8)
        .map((b) => ({ nome: b.key, contatos: b.value })),
    [scope],
  );

  // Escolaridade — ordered → sequential teal ramp
  const escData = useMemo(() => {
    const ordered = toBuckets(scope.esc, meta.ordens.esc).filter(
      (b) => b.key !== "Não informado" && b.value > 0,
    );
    return ordered.map((b, i) => ({
      nivel: b.key,
      contatos: b.value,
      fill: rampFill("esc", i, ordered.length),
    }));
  }, [scope]);

  const piramideData = useMemo(() => {
    const rows = Object.entries(scope.piramide ?? {}).map(([faixa, v]) => ({
      faixa,
      Feminino: v.Feminino ?? 0,
      Masculino: -(v.Masculino ?? 0),
    }));
    rows.sort((a, b) => a.faixa.localeCompare(b.faixa));
    return rows;
  }, [scope]);


  const lojasScope = useMemo(() => {
    if (scope.tipo !== "cluster" || !scope.lojas) return [];
    return [...scope.lojas].sort((a, b) => b.contatos - a.contatos);
  }, [scope]);

  const estados = scopes.filter((s) => s.tipo === "estado");
  const clusters = scopes.filter((s) => s.tipo === "cluster");

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 py-3 sm:gap-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <img
              src="/logo-mix.png"
              alt="Mix Mateus"
              width={1000}
              height={313}
              className="h-8 w-auto shrink-0 sm:h-11"
            />
            <div className="min-w-0 border-l pl-2 sm:pl-3">
              <p className="font-subtitle text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:text-[10px]">
                Painel Analítico
              </p>
              <h1 className="truncate font-display text-sm font-bold tracking-tight sm:text-xl">
                Base para Campanhas de WhatsApp
              </h1>
            </div>
          </div>
          <div className="no-print flex shrink-0 items-center gap-1.5 sm:gap-2">
            <DownloadMenu />
            <ThemeToggle />
            <button
              onClick={handleLogout}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-card p-2 text-xs font-semibold text-muted-foreground shadow-sm transition hover:bg-muted hover:text-foreground sm:px-3"
              aria-label="Sair do painel"
              title="Sair do painel"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* Intro + Scope selector */}
        <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <p className="font-subtitle text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                Extração {meta.extracao}
              </p>
              <h2 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">
                {scope.rotulo}
              </h2>
            </div>
            <div className="min-w-0">
              <label className="font-subtitle mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Recorte
              </label>
              <select
                value={scopeId}
                onChange={(e) => setScopeId(e.target.value)}
                className="w-full min-w-[260px] rounded-xl border bg-background px-4 py-2.5 text-sm font-medium shadow-sm outline-none focus:ring-2 focus:ring-ring lg:w-auto"
              >
                <optgroup label="Geral">
                  <option value="geral">Base Completa</option>
                </optgroup>
                <optgroup label="Estados">
                  {estados.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.rotulo}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Clusters">
                  {clusters.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.rotulo}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
          </div>
        </section>

        {/* KPIs */}
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Telefones (contatos)"
            value={formatNumber(totalContatos)}
            hint={<span>Linhas prontas para disparo · métrica principal</span>}
            icon={<MessageCircle className="h-5 w-5" />}
            accent="success"
          />
          <StatCard
            label="Pessoas únicas"
            value={formatNumber(totalPessoas)}
            hint={
              <span>
                Média de{" "}
                <span className="font-num font-semibold text-foreground">
                  {(totalContatos / Math.max(totalPessoas, 1)).toFixed(2)}
                </span>{" "}
                telefones por pessoa
              </span>
            }
            icon={<Users className="h-5 w-5" />}
            accent="violet"
          />
          <StatCard
            label="Renda média"
            value={formatCurrency(scope.renda?.media)}
            hint={<span>Mediana {formatCurrency(scope.renda?.mediana)}</span>}
            icon={<Wallet className="h-5 w-5" />}
            accent="blue"
          />
          <StatCard
            label="Idade média"
            value={
              scope.idade?.media != null ? (
                <>
                  {scope.idade.media.toFixed(0)}
                  <span className="ml-1 text-lg text-muted-foreground">anos</span>
                </>
              ) : (
                "—"
              )
            }
            hint={<span>Mediana {scope.idade?.mediana ?? "—"} anos</span>}
            icon={<Signal className="h-5 w-5" />}
            accent="amber"
          />
        </section>

        {/* Row 1 · Perfil da base — proporções do todo (categórico → rosca) */}
        <section className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="Operadora dos telefones"
            subtitle="Distribuição por prestadora — planeje disparo por operadora"
            icon={<Phone className="h-4 w-4" />}
          >
            <DonutChart data={prestadoraData} centerLabel="telefones" />
          </ChartCard>

          <ChartCard
            title="Sexo"
            subtitle="Perfil da base para segmentação"
            icon={<Users className="h-4 w-4" />}
          >
            <DonutChart data={sexoData} centerLabel="contatos" />
          </ChartCard>
        </section>

        {/* Row 2 · Idade & renda — dimensões ordenadas, rampa sequencial de cor */}
        <section className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="Faixa etária"
            subtitle="Contatos por grupo · tom da cor = idade (claro → escuro)"
            icon={<BarChart3 className="h-4 w-4" />}
          >
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={idadeData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="faixa" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} tickFormatter={(v) => formatCompact(v)} />
                  <Tooltip content={<TooltipBox />} cursor={{ fill: "var(--color-muted)", opacity: 0.5 }} wrapperStyle={{ zIndex: 50, outline: "none" }} allowEscapeViewBox={{ x: false, y: false }} />
                  <Bar dataKey="contatos" radius={[6, 6, 0, 0]}>
                    {idadeData.map((d, i) => (
                      <Cell key={i} fill={d.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard
            title="Faixa de renda"
            subtitle="Distribuição salarial · tom da cor = renda (baixa → alta)"
            icon={<Wallet className="h-4 w-4" />}
          >
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rendaData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="faixa" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} angle={-20} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} tickFormatter={(v) => formatCompact(v)} />
                  <Tooltip content={<TooltipBox />} cursor={{ fill: "var(--color-muted)", opacity: 0.5 }} wrapperStyle={{ zIndex: 50, outline: "none" }} allowEscapeViewBox={{ x: false, y: false }} />
                  <Bar dataKey="contatos" radius={[6, 6, 0, 0]}>
                    {rendaData.map((d, i) => (
                      <Cell key={i} fill={d.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </section>

        {/* Row 3 · Perfil socioeconômico — dimensões ordenadas (barra = ordem no eixo) */}
        <section className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="Classe social"
            subtitle="Participação por classe (A → E) · tom = nível (A mais forte)"
            icon={<Layers className="h-4 w-4" />}
          >
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={classeData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} tickFormatter={(v) => formatCompact(v)} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} width={36} />
                  <Tooltip content={<TooltipBox />} cursor={{ fill: "var(--color-muted)", opacity: 0.5 }} wrapperStyle={{ zIndex: 50, outline: "none" }} allowEscapeViewBox={{ x: false, y: false }} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                    {classeData.map((d, i) => (
                      <Cell key={i} fill={d.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard
            title="Escolaridade"
            subtitle="Nível informado · tom da cor = grau (baixo → alto)"
            icon={<GraduationCap className="h-4 w-4" />}
          >
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={escData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} tickFormatter={(v) => formatCompact(v)} />
                  <YAxis dataKey="nivel" type="category" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} width={90} />
                  <Tooltip content={<TooltipBox />} cursor={{ fill: "var(--color-muted)", opacity: 0.5 }} wrapperStyle={{ zIndex: 50, outline: "none" }} allowEscapeViewBox={{ x: false, y: false }} />
                  <Bar dataKey="contatos" radius={[0, 6, 6, 0]}>
                    {escData.map((d, i) => (
                      <Cell key={i} fill={d.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </section>

        {/* Row 3b · Ocupação (CBO) — largura total */}
        <section>
          <ChartCard
            title="Ocupação (CBO)"
            subtitle="Top 8 grandes grupos — volume de contatos"
            icon={<Briefcase className="h-4 w-4" />}
          >
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cboData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} tickFormatter={(v) => formatCompact(v)} />
                  <YAxis dataKey="nome" type="category" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} width={170} />
                  <Tooltip content={<TooltipBox />} cursor={{ fill: "var(--color-muted)", opacity: 0.5 }} wrapperStyle={{ zIndex: 50, outline: "none" }} allowEscapeViewBox={{ x: false, y: false }} />
                  <Bar dataKey="contatos" fill="var(--color-chart-3)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </section>

        {/* Row 5 · Pirâmide etária (largura total) */}
        <section>
          <ChartCard
            title="Pirâmide etária"
            subtitle="Distribuição por idade e sexo — Masculino (esquerda) · Feminino (direita)"
            icon={<BarChart3 className="h-4 w-4" />}
          >
            <div className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={piramideData} layout="vertical" stackOffset="sign" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => formatCompact(Math.abs(v))} tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} />
                  <YAxis dataKey="faixa" type="category" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} width={55} />
                  <Tooltip
                    content={({ active, payload, label }: any) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg">
                          <p className="mb-1 font-semibold">{label}</p>
                          {payload.map((p: any, i: number) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
                              <span className="text-muted-foreground">{p.name}:</span>
                              <span className="font-num font-semibold">{formatNumber(Math.abs(p.value))}</span>
                            </div>
                          ))}
                        </div>
                      );
                    }}
                    cursor={{ fill: "var(--color-muted)", opacity: 0.5 }}
                    wrapperStyle={{ zIndex: 50, outline: "none" }}
                    allowEscapeViewBox={{ x: false, y: false }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, fontFamily: "var(--font-subtitle)" }} />
                  <Bar dataKey="Masculino" fill="var(--sexo-masculino)" stackId="a" radius={[6, 0, 0, 6]} />
                  <Bar dataKey="Feminino" fill="var(--sexo-feminino)" stackId="a" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </section>

        {/* Row 6: Lojas do cluster (se cluster) */}
        {lojasScope.length > 0 && (
          <section>
            <ChartCard
              title={`Lojas do ${scope.rotulo}`}
              subtitle={`${lojasScope.length} lojas · ordenadas por telefones capturados`}
              icon={<Building2 className="h-4 w-4" />}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left font-subtitle text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <th className="px-3 py-2">Loja</th>
                      <th className="px-3 py-2">CEP</th>
                      <th className="px-3 py-2 text-right">Telefones</th>
                      <th className="px-3 py-2 text-right">Pessoas</th>
                      <th className="px-3 py-2 text-right">Com e-mail</th>
                      <th className="px-3 py-2 text-right">% base do cluster</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lojasScope.map((l) => (
                      <tr key={l.codigo} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="px-3 py-2 font-medium">{l.nome}</td>
                        <td className="px-3 py-2 font-num text-xs text-muted-foreground">{l.cep}</td>
                        <td className="px-3 py-2 text-right font-num font-semibold text-primary">
                          {formatNumber(l.contatos)}
                        </td>
                        <td className="px-3 py-2 text-right font-num">{formatNumber(l.pessoas)}</td>
                        <td className="px-3 py-2 text-right font-num text-muted-foreground">
                          {formatNumber(l.com_email)}
                        </td>
                        <td className="px-3 py-2 text-right font-num text-xs text-muted-foreground">
                          {pct(l.contatos, scope.contatos).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ChartCard>
          </section>
        )}

        <footer className="print-card mt-2 rounded-2xl border bg-card p-6 shadow-sm">
          <div className="flex flex-col items-center gap-5 text-center md:flex-row md:justify-between md:text-left">
            {/* Assinatura ATONNS — responsável por base, segmentação, este painel e os disparos */}
            <div className="flex flex-col items-center gap-3 md:flex-row md:items-center">
              <div className="inline-flex items-center gap-2.5 rounded-xl bg-neutral-900 px-4 py-2.5 shadow-sm ring-1 ring-black/10">
                <img
                  src="/logo-atonns.png"
                  alt="ATONNS Tecnologia e Comunicação"
                  width={550}
                  height={170}
                  className="h-6 w-auto"
                />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  ATONNS Tecnologia e Comunicação LTDA
                </p>
                <p className="font-subtitle text-xs text-muted-foreground">
                  Base de dados · segmentação · painel · disparos ·{" "}
                  <span className="font-num">CNPJ 24.016.351/0001-59</span>
                </p>
              </div>
            </div>

            <p className="font-subtitle max-w-sm text-xs text-muted-foreground">
              Fonte: {meta.fonte} · Extração {meta.extracao} ·{" "}
              <span className="font-num">{formatNumber(meta.total_linhas)}</span> linhas totais na
              base
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}
