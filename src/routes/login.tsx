import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react";

import { entrar } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  // Já logado não vê tela de login — vai direto para onde queria ir.
  beforeLoad: ({ context, search }) => {
    if (context.sessao) throw redirect({ to: search.redirect || "/" });
  },
  head: () => ({
    meta: [
      { title: "Entrar · Painel Mix Mateus" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const router = useRouter();
  const { redirect: destino } = Route.useSearch();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      const r = await entrar({ data: { email, senha } });
      if (r.ok) {
        // `invalidate` refaz o beforeLoad do root, que relê a sessão nova.
        await router.invalidate();
        await router.navigate({ to: destino || "/" });
      } else {
        setErro(r.erro);
        setCarregando(false);
      }
    } catch {
      setErro("Não foi possível entrar agora. Tente novamente.");
      setCarregando(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10 text-foreground">
      {/* brilho de fundo sutil na cor da marca */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full opacity-[0.14] blur-3xl"
        style={{ background: "radial-gradient(closest-side, var(--brand-red), transparent)" }}
      />

      <div className="relative w-full max-w-md">
        <div className="rounded-2xl border bg-card p-7 shadow-xl sm:p-8">
          <div className="flex flex-col items-center text-center">
            <img src="/logo-mix.png" alt="Mix Mateus" className="h-14 w-auto" />
            <h1 className="mt-6 font-display text-2xl font-bold tracking-tight">
              Acesso ao painel
            </h1>
            <p className="mt-2 max-w-xs text-sm text-muted-foreground">
              Campanhas de WhatsApp e análise da base. Entre com suas credenciais para continuar.
            </p>
          </div>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <div>
              <label
                htmlFor="email"
                className="font-subtitle mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
              >
                E-mail
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@empresa.com.br"
                  className="w-full rounded-xl border bg-background py-2.5 pl-10 pr-4 text-sm shadow-sm outline-none transition focus:ring-2 focus:ring-ring"
                  required
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="senha"
                className="font-subtitle mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Senha
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="senha"
                  type={mostrarSenha ? "text" : "password"}
                  autoComplete="current-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border bg-background py-2.5 pl-10 pr-11 text-sm shadow-sm outline-none transition focus:ring-2 focus:ring-ring"
                  required
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                >
                  {mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {erro && (
              <p
                role="alert"
                className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive"
              >
                {erro}
              </p>
            )}

            <button
              type="submit"
              disabled={carregando}
              className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-60"
            >
              {carregando ? "Verificando…" : "Entrar no painel"}
              {!carregando && (
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              )}
            </button>
          </form>
        </div>

        {/* Assinatura ATONNS — logo branca sobre chip escuro para aparecer em qualquer tema */}
        <div className="mt-6 flex flex-col items-center gap-3 text-center">
          <span className="font-subtitle text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Uma realização
          </span>
          <div className="inline-flex items-center justify-center rounded-2xl bg-neutral-900 px-6 py-4 shadow-sm ring-1 ring-black/10">
            <img
              src="/logo-atonns.png"
              alt="ATONNS Tecnologia e Comunicação"
              width={550}
              height={170}
              className="h-9 w-auto"
            />
          </div>
          <p className="font-num text-[11px] text-muted-foreground">
            ATONNS Tecnologia e Comunicação LTDA · CNPJ 24.016.351/0001-59
          </p>
        </div>
      </div>
    </div>
  );
}
