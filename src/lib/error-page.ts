/**
 * Página de erro do servidor (500). Mostrada quando o SSR falha antes de a
 * aplicação React montar — banco fora, migração pendente, schema divergente.
 *
 * `detalhe` é opcional e passa por allowlist: quando a causa é acionável (as
 * mensagens que o `db.ts` produz — "Rode: npm run db:migrate", "Estrutura do
 * banco não corresponde…"), ela aparece na tela em vez de morrer só no log do
 * servidor. Antes, esta página descartava `error.message` por completo, e
 * quem estava na VPS via apenas "algo deu errado".
 */
function escapar(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Só deixa passar mensagens que a própria aplicação escreveu — nunca o texto
 * cru de uma exceção, que poderia expor caminho de arquivo, SQL ou stack.
 */
function detalheSeguro(error?: unknown): string | null {
  if (!(error instanceof Error)) return null;
  const msg = error.message ?? "";
  const seguras = [
    "Banco desatualizado",
    "Banco não inicializado",
    "Estrutura do banco",
    "Não foi possível conectar ao banco",
    "DATABASE_URL",
  ];
  return seguras.some((p) => msg.startsWith(p)) ? msg : null;
}

export function renderErrorPage(error?: unknown): string {
  const detalhe = detalheSeguro(error);
  const blocoDetalhe = detalhe ? `<pre class="detail">${escapar(detalhe)}</pre>` : "";

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>O painel não carregou</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font: 15px/1.5 system-ui, -apple-system, sans-serif; background: #fafafa; color: #111; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 32rem; width: 100%; text-align: center; padding: 2rem; }
      h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
      p { color: #4b5563; margin: 0 0 1.5rem; }
      .detail { text-align: left; background: #fff7ed; border: 1px solid #fed7aa; color: #7c2d12; padding: 0.75rem 1rem; border-radius: 0.5rem; margin: 0 0 1.5rem; white-space: pre-wrap; word-break: break-word; font: 13px/1.5 ui-monospace, SFMono-Regular, monospace; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.5rem 1rem; border-radius: 0.375rem; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: #111; color: #fff; }
      .secondary { background: #fff; color: #111; border-color: #d1d5db; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>O painel não carregou</h1>
      <p>${detalhe ? "O servidor apontou o motivo abaixo." : "Algo deu errado do nosso lado. Tente recarregar ou volte ao início."}</p>
      ${blocoDetalhe}
      <div class="actions">
        <button class="primary" onclick="location.reload()">Tentar de novo</button>
        <a class="secondary" href="/">Início</a>
      </div>
    </div>
  </body>
</html>`;
}
