import { useState, type ReactNode } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { BarChart3, LogOut, Send, FileBarChart, Sun, Moon, Laptop } from "lucide-react";

import { sair, type Sessao } from "@/lib/auth";
import { formatNumber, type MetaBase } from "@/lib/mix-data";

type ThemeMode = "auto" | "light" | "dark";

function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>("auto");

  function apply(next: ThemeMode) {
    setMode(next);
    const root = document.documentElement;
    if (next === "auto") {
      root.classList.toggle("dark", window.matchMedia("(prefers-color-scheme: dark)").matches);
    } else {
      root.classList.toggle("dark", next === "dark");
    }
  }

  const opts: { id: ThemeMode; icon: typeof Sun; label: string }[] = [
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
      {/* Mobile: um único botão que alterna Auto → Claro → Escuro (economiza espaço) */}
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

const NAV = [
  { to: "/", label: "Painel da base", icon: BarChart3 },
  { to: "/campanhas", label: "Nova campanha", icon: Send },
  { to: "/relatorios", label: "Relatórios", icon: FileBarChart },
] as const;

function Nav() {
  return (
    <nav className="no-print border-t bg-background/85">
      <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 sm:px-6 lg:px-8">
        {NAV.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact: to === "/" }}
            className="group relative inline-flex shrink-0 items-center gap-2 px-3 py-3 text-sm font-medium text-muted-foreground transition hover:text-foreground"
            activeProps={{ className: "!text-primary" }}
          >
            {({ isActive }) => (
              <>
                <Icon className="h-4 w-4" />
                <span className="whitespace-nowrap">{label}</span>
                <span
                  aria-hidden
                  className={`absolute inset-x-2 -bottom-px h-0.5 rounded-full transition ${
                    isActive ? "bg-primary" : "bg-transparent group-hover:bg-border"
                  }`}
                />
              </>
            )}
          </Link>
        ))}
      </div>
    </nav>
  );
}

function Footer({ meta }: { meta?: MetaBase }) {
  return (
    <footer className="print-card mt-2 rounded-2xl border bg-card p-6 shadow-sm">
      <div className="flex flex-col items-center gap-5 text-center md:flex-row md:justify-between md:text-left">
        {/* Assinatura ATONNS — responsável por base, segmentação, painel e disparos */}
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

        {meta && (
          <p className="font-subtitle max-w-sm text-xs text-muted-foreground">
            Fonte: {meta.fonte} · Extração {meta.extracao} ·{" "}
            <span className="font-num">{formatNumber(meta.total_linhas)}</span> linhas totais na
            base
          </p>
        )}
      </div>
    </footer>
  );
}

const PAPEL_ROTULO: Record<Sessao["papel"], string> = {
  admin: "Administrador",
  cliente: "Mix Mateus",
};

/**
 * Casca do app: cabeçalho + navegação + rodapé.
 *
 * Não há portão de acesso aqui — quem chega já passou pelo `beforeLoad` da
 * rota, que redireciona para /login antes de a página montar.
 */
export function AppShell({
  children,
  actions,
  sessao,
  meta,
}: {
  children: ReactNode;
  actions?: ReactNode;
  sessao: Sessao;
  /** Metadados da base, quando a página os carregou. Só alimenta o rodapé. */
  meta?: MetaBase;
}) {
  const router = useRouter();
  const [saindo, setSaindo] = useState(false);

  async function handleLogout() {
    setSaindo(true);
    await sair({ data: undefined });
    await router.invalidate();
    await router.navigate({ to: "/login", search: { redirect: undefined } });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
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
            {actions}
            <ThemeToggle />

            {/* Quem está logado e com qual papel — evita agir na conta errada */}
            <div className="hidden min-w-0 border-l pl-2 text-right lg:block">
              <p className="truncate text-xs font-semibold leading-tight">{sessao.nome}</p>
              <p className="font-subtitle text-[10px] uppercase tracking-wider text-muted-foreground">
                {PAPEL_ROTULO[sessao.papel]}
              </p>
            </div>

            <button
              onClick={handleLogout}
              disabled={saindo}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-card p-2 text-xs font-semibold text-muted-foreground shadow-sm transition hover:bg-muted hover:text-foreground disabled:opacity-60 sm:px-3"
              aria-label="Sair do painel"
              title={`Sair (${sessao.email})`}
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{saindo ? "Saindo…" : "Sair"}</span>
            </button>
          </div>
        </div>
        <Nav />
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {children}
        <Footer meta={meta} />
      </main>
    </div>
  );
}
