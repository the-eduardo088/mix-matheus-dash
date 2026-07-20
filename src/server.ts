import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

/**
 * Serve os anexos das campanhas com sessão obrigatória e streaming.
 *
 * Fica aqui, antes do handler do TanStack, porque esta versão não tem rotas de
 * API — e porque um `<img src>` / `<video src>` precisa de URL normal, coisa
 * que o endpoint RPC de uma server function não oferece.
 *
 * Streaming importa: um PDF de 100 MB servido por leitura completa em memória
 * derrubaria a VPS com poucos downloads simultâneos.
 */
async function servirArquivo(request: Request, id: string): Promise<Response> {
  const { lerSessaoDoRequest } = await import("./lib/server/sessao-request");
  const sessao = await lerSessaoDoRequest(request);
  if (!sessao) return new Response("Não autorizado", { status: 401 });

  const { localizarArquivo, abrirStream, etagDe } = await import("./lib/server/arquivos");
  const arquivo = await localizarArquivo(id);
  if (!arquivo) return new Response("Arquivo não encontrado", { status: 404 });

  // Se o navegador já tem a versão em cache, devolve 304 e não lê o disco.
  const etag = etagDe(id, arquivo.tamanho);
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { etag } });
  }

  return new Response(abrirStream(arquivo.caminhoAbsoluto), {
    headers: {
      "content-type": arquivo.mime,
      "content-length": String(arquivo.tamanho),
      "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(arquivo.nome)}`,
      etag,
      // `private` para nenhum proxy compartilhado guardar anexo de campanha.
      "cache-control": "private, max-age=3600",
    },
  });
}

const ROTA_ARQUIVO = /^\/arquivos\/([0-9a-f-]{36})$/i;

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const arquivo = ROTA_ARQUIVO.exec(new URL(request.url).pathname);
      if (arquivo) return await servirArquivo(request, arquivo[1]);

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
