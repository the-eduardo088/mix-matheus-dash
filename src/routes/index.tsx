import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
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
  MapPin,
  PieChart as PieIcon,
  BarChart3,
  Building2,
  GraduationCap,
  Briefcase,
  Wallet,
  AlertTriangle,
  Sun,
  Moon,
  Laptop,
} from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";

import logoAsset from "@/assets/mix-mateus-logo.png.asset.json";
import {
  CHART_COLORS,
  formatCurrency,
  formatNumber,
  getScope,
  lojasSemRegistro,
  meta,
  pct,
  scopes,
  toBuckets,
} from "@/lib/mix-data";
import { StatCard } from "@/components/dashboard/StatCard";
import { ChartCard } from "@/components/dashboard/ChartCard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Painel Mix Mateus · Base para Campanhas de WhatsApp" },
      {
        name: "description",
        content:
          "Dashboard interativo da base Mix Mateus: telefones por cluster, prestadoras, perfil demográfico e cobertura por loja.",
      },
    ],
  }),
  component: Dashboard,
});

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

  return (
    <div className="inline-flex items-center gap-1 rounded-full border bg-card p-1 shadow-sm">
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

function Dashboard() {
  const [scopeId, setScopeId] = useState<string>("geral");
  const scope = getScope(scopeId);

  const totalContatos = scope.contatos;
  const totalPessoas = scope.pessoas;

  const prestadoraData = useMemo(
    () =>
      toBuckets(scope.prestadora, meta.ordens.prest)
        .filter((b) => b.value > 0)
        .map((b, i) => ({ name: b.key, value: b.value, fill: CHART_COLORS[i % CHART_COLORS.length] })),
    [scope],
  );

  const dddData = useMemo(
    () =>
      toBuckets(scope.ddd).map((b, i) => ({
        name: b.key,
        value: b.value,
        fill: CHART_COLORS[i % CHART_COLORS.length],
      })),
    [scope],
  );

  const idadeData = useMemo(
    () => toBuckets(scope.idade_g, meta.ordens.idade_g).map((b) => ({ faixa: b.key, contatos: b.value })),
    [scope],
  );

  const rendaData = useMemo(
    () => toBuckets(scope.renda_f, meta.ordens.renda_f).map((b) => ({ faixa: b.key, contatos: b.value })),
    [scope],
  );

  const classeData = useMemo(
    () =>
      toBuckets(scope.classe, meta.ordens.classe)
        .filter((b) => b.key !== "Não informado" && b.value > 0)
        .map((b, i) => ({ name: b.key, value: b.value, fill: CHART_COLORS[i % CHART_COLORS.length] })),
    [scope],
  );

  const sexoData = useMemo(
    () =>
      toBuckets(scope.sexo, meta.ordens.sexo)
        .filter((b) => b.value > 0)
        .map((b, i) => ({
          name: b.key,
          value: b.value,
          fill:
            b.key === "Feminino"
              ? "var(--color-chart-1)"
              : b.key === "Masculino"
                ? "var(--color-chart-2)"
                : "var(--color-chart-7)",
        })),
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

  const escData = useMemo(
    () =>
      toBuckets(scope.esc, meta.ordens.esc)
        .filter((b) => b.key !== "Não informado" && b.value > 0)
        .map((b) => ({ nivel: b.key, contatos: b.value })),
    [scope],
  );

  const cidadesData = useMemo(
    () => (scope.cidades ?? []).map(([nome, v]) => ({ cidade: nome, contatos: v })),
    [scope],
  );

  const piramideData = useMemo(() => {
    const rows = Object.entries(scope.piramide ?? {}).map(([faixa, v]) => ({
      faixa,
      Feminino: v.Feminino ?? 0,
      Masculino: -(v.Masculino ?? 0),
    }));
    rows.sort((a, b) => a.faixa.localeCompare(b.faixa));
    return rows;
  }, [scope]);

  const clusterCompare = useMemo(
    () =>
      scopes
        .filter((s) => s.tipo === "cluster")
        .map((s) => ({ nome: s.rotulo.replace(/^..·\s*/, ""), contatos: s.contatos }))
        .sort((a, b) => b.contatos - a.contatos),
    [],
  );

  const lojasAusentes = useMemo(() => lojasSemRegistro(), []);

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
        <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src={logoAsset.url}
              alt="Mix Mateus"
              className="h-10 w-auto shrink-0 sm:h-12"
            />
            <div className="min-w-0">
              <p className="font-subtitle text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Painel Analítico
              </p>
              <h1 className="truncate font-display text-lg font-bold tracking-tight sm:text-xl">
                Base para Campanhas de WhatsApp
              </h1>
            </div>
          </div>
          <ThemeToggle />
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
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Foco em <strong className="font-semibold text-foreground">contatos (telefones)</strong> —
                o volume real disponível para disparos. Pessoas únicas ficam apenas como referência.
              </p>
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
            accent="primary"
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
            accent="muted"
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
            accent="success"
          />
        </section>

        {/* Row 1: Prestadoras (pizza) + DDD (pizza) + Comparação clusters (barras) */}
        <section className="grid gap-4 lg:grid-cols-3">
          <ChartCard
            title="Operadora dos telefones"
            subtitle="Distribuição por prestadora — planeje disparo por operadora"
            icon={<Phone className="h-4 w-4" />}
          >
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={prestadoraData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={95}
                    paddingAngle={2}
                  >
                    {prestadoraData.map((d, i) => (
                      <Cell key={i} fill={d.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<TooltipBox />} />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    wrapperStyle={{ fontSize: 11, fontFamily: "var(--font-subtitle)" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard
            title="DDD dos telefones"
            subtitle="Onde estão os números — cobertura regional"
            icon={<MapPin className="h-4 w-4" />}
          >
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dddData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={95}
                    paddingAngle={2}
                  >
                    {dddData.map((d, i) => (
                      <Cell key={i} fill={d.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<TooltipBox />} />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    wrapperStyle={{ fontSize: 11, fontFamily: "var(--font-subtitle)" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard
            title="Sexo"
            subtitle="Perfil da base para segmentação"
            icon={<PieIcon className="h-4 w-4" />}
          >
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sexoData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={95}
                    label={(e: any) => `${((e.percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {sexoData.map((d, i) => (
                      <Cell key={i} fill={d.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<TooltipBox />} />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    wrapperStyle={{ fontSize: 11, fontFamily: "var(--font-subtitle)" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </section>

        {/* Row 2: Faixa etária + Renda (barras) */}
        <section className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="Faixa etária"
            subtitle="Contatos por grupo — ajuste tom da campanha"
            icon={<BarChart3 className="h-4 w-4" />}
          >
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={idadeData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="faixa" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} tickFormatter={(v) => formatNumber(v)} />
                  <Tooltip content={<TooltipBox />} cursor={{ fill: "var(--color-muted)", opacity: 0.5 }} />
                  <Bar dataKey="contatos" fill="var(--color-chart-1)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard
            title="Faixa de renda"
            subtitle="Distribuição salarial dos contatos"
            icon={<Wallet className="h-4 w-4" />}
          >
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rendaData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="faixa" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} angle={-20} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} tickFormatter={(v) => formatNumber(v)} />
                  <Tooltip content={<TooltipBox />} cursor={{ fill: "var(--color-muted)", opacity: 0.5 }} />
                  <Bar dataKey="contatos" fill="var(--color-chart-2)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </section>

        {/* Row 3: Classe (pizza) + Escolaridade (barra horizontal) + CBO (barra horizontal) */}
        <section className="grid gap-4 lg:grid-cols-3">
          <ChartCard
            title="Classe social"
            subtitle="Segmentação por classe"
            icon={<PieIcon className="h-4 w-4" />}
          >
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={classeData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={95}
                    paddingAngle={2}
                    label={(e: any) => e.name}
                    labelLine={false}
                    style={{ fontSize: 11, fontFamily: "var(--font-subtitle)" }}
                  >
                    {classeData.map((d, i) => (
                      <Cell key={i} fill={d.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<TooltipBox />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard
            title="Escolaridade"
            subtitle="Nível informado (excluindo não informados)"
            icon={<GraduationCap className="h-4 w-4" />}
          >
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={escData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} tickFormatter={(v) => formatNumber(v)} />
                  <YAxis dataKey="nivel" type="category" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} width={90} />
                  <Tooltip content={<TooltipBox />} cursor={{ fill: "var(--color-muted)", opacity: 0.5 }} />
                  <Bar dataKey="contatos" fill="var(--color-chart-4)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard
            title="Ocupação (CBO)"
            subtitle="Top 8 grandes grupos"
            icon={<Briefcase className="h-4 w-4" />}
          >
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cboData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} tickFormatter={(v) => formatNumber(v)} />
                  <YAxis dataKey="nome" type="category" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} width={130} />
                  <Tooltip content={<TooltipBox />} cursor={{ fill: "var(--color-muted)", opacity: 0.5 }} />
                  <Bar dataKey="contatos" fill="var(--color-chart-3)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </section>

        {/* Row 4: Pirâmide + Top cidades */}
        <section className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="Pirâmide etária"
            subtitle="Homens (esquerda) · Mulheres (direita)"
            icon={<BarChart3 className="h-4 w-4" />}
          >
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={piramideData} layout="vertical" stackOffset="sign" margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => formatNumber(Math.abs(v))} tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} />
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
                  />
                  <Legend wrapperStyle={{ fontSize: 11, fontFamily: "var(--font-subtitle)" }} />
                  <Bar dataKey="Masculino" fill="var(--color-chart-2)" stackId="a" radius={[6, 0, 0, 6]} />
                  <Bar dataKey="Feminino" fill="var(--color-chart-1)" stackId="a" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard
            title="Top 10 cidades"
            subtitle="Onde a base está concentrada"
            icon={<Building2 className="h-4 w-4" />}
          >
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cidadesData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} tickFormatter={(v) => formatNumber(v)} />
                  <YAxis dataKey="cidade" type="category" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} width={100} />
                  <Tooltip content={<TooltipBox />} cursor={{ fill: "var(--color-muted)", opacity: 0.5 }} />
                  <Bar dataKey="contatos" fill="var(--color-chart-5)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </section>

        {/* Row 5: Comparativo entre clusters (sempre visível) */}
        <section>
          <ChartCard
            title="Comparativo entre clusters"
            subtitle="Volume de telefones por cluster — priorize disparos"
            icon={<BarChart3 className="h-4 w-4" />}
          >
            <div className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={clusterCompare} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} tickFormatter={(v) => formatNumber(v)} />
                  <YAxis dataKey="nome" type="category" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} width={220} />
                  <Tooltip content={<TooltipBox />} cursor={{ fill: "var(--color-muted)", opacity: 0.5 }} />
                  <Bar dataKey="contatos" fill="var(--color-chart-1)" radius={[0, 6, 6, 0]}>
                    {clusterCompare.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
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

        {/* Row 7: Lojas / CEPs não encontrados */}
        <section>
          <div className="rounded-2xl border border-[color:var(--warning)]/40 bg-[color:var(--warning)]/5 p-5 shadow-sm sm:p-6">
            <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-4">
              <div className="rounded-xl bg-[color:var(--warning)]/15 p-2.5 text-[color:var(--warning)]">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-display text-lg font-bold tracking-tight">
                  Lojas / CEPs não encontrados na base
                </h3>
                <p className="font-subtitle mt-1 text-sm text-muted-foreground">
                  Estas lojas foram enviadas pelo Mix Mateus mas não retornaram registros no cruzamento
                  por CEP — precisam de revisão de cadastro ou reenvio de base.
                </p>

                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {lojasAusentes.map((l) => (
                    <div
                      key={`${l.codigo}-${l.nome}`}
                      className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-xl border bg-card p-3"
                    >
                      <span className="shrink-0 rounded-lg bg-primary/10 px-2 py-1 font-num text-xs font-bold text-primary">
                        #{l.codigo}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{l.nome}</p>
                        <p className="font-num text-[11px] text-muted-foreground">
                          CEP {l.cep ?? "—"} · {l.motivo}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <footer className="pb-8 pt-4 text-center">
          <p className="font-subtitle text-xs text-muted-foreground">
            Fonte: {meta.fonte} · Extração {meta.extracao} ·{" "}
            <span className="font-num">{formatNumber(meta.total_linhas)}</span> linhas totais na base
          </p>
        </footer>
      </main>
    </div>
  );
}
