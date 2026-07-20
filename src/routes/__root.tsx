import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { createServerOnlyFn } from "@tanstack/react-start";
import { getRequestUrl } from "@tanstack/react-start/server";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { sessaoAtual } from "../lib/auth";

/**
 * Lê o host real do request no servidor (respeitando o proxy da Lovable/
 * Cloudflare via x-forwarded-host). `createServerOnlyFn` faz o bundler remover
 * este código do pacote do cliente.
 */
const getServerOrigin = createServerOnlyFn(() => {
  try {
    return new URL(getRequestUrl({ xForwardedHost: true })).origin;
  } catch {
    return "";
  }
});

/**
 * Origem absoluta do site (ex.: https://meudominio.com). Crawlers de preview
 * (WhatsApp, Facebook, X) exigem URL absoluta em og:image — caminho relativo é
 * ignorado. No cliente usamos window.location; no servidor, o host do request.
 */
function siteOrigin(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return getServerOrigin();
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  /**
   * Resolve a sessão uma vez por navegação e injeta no contexto do roteador.
   * Assim toda rota filha decide se libera ou redireciona sem repetir consulta,
   * e o SSR já sai com o estado certo — nada de piscar a tela de login.
   */
  beforeLoad: async () => ({ sessao: await sessaoAtual() }),

  head: () => {
    const origin = siteOrigin();
    // Absoluta quando há origin (SSR/cliente); relativa só em último caso.
    const ogImage = origin ? `${origin}/logo-mix.png` : "/logo-mix.png";
    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { title: "Mix Mateus · Painel da Base para Campanhas de WhatsApp" },
        {
          name: "description",
          content:
            "Painel analítico restrito da base Mix Mateus: telefones, operadoras, clusters, perfil demográfico e cobertura regional. Base, segmentação e disparos por ATONNS Tecnologia.",
        },
        { name: "theme-color", content: "#e01e1e" },
        { name: "robots", content: "noindex, nofollow" },
        { property: "og:site_name", content: "Mix Mateus · ATONNS" },
        { property: "og:title", content: "Mix Mateus · Painel da Base para Campanhas" },
        {
          property: "og:description",
          content:
            "Análise da base de telefones e perfis para campanhas de WhatsApp. Segmentação e disparos por ATONNS Tecnologia e Comunicação.",
        },
        { property: "og:type", content: "website" },
        ...(origin ? [{ property: "og:url", content: origin }] : []),
        { property: "og:image", content: ogImage },
        { property: "og:image:secure_url", content: ogImage },
        { property: "og:image:type", content: "image/png" },
        { property: "og:image:width", content: "1000" },
        { property: "og:image:height", content: "313" },
        { property: "og:image:alt", content: "Mix Mateus" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: "Mix Mateus · Painel da Base para Campanhas" },
        {
          name: "twitter:description",
          content:
            "Análise da base para campanhas de WhatsApp. Por ATONNS Tecnologia e Comunicação.",
        },
        { name: "twitter:image", content: ogImage },
      ],
      links: [
        { rel: "stylesheet", href: appCss },
        { rel: "icon", href: "/logo-mix.png", type: "image/png" },
        { rel: "shortcut icon", href: "/logo-mix.png", type: "image/png" },
        { rel: "apple-touch-icon", href: "/logo-mix.png" },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Manrope:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500;600&display=swap",
        },
      ],
      scripts: [
        {
          children: `(function(){try{var m=window.matchMedia('(prefers-color-scheme: dark)');function a(e){document.documentElement.classList.toggle('dark', e.matches);}a(m);m.addEventListener('change',a);}catch(e){}})();`,
        },
      ],
    };
  },
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
