/**
 * Transforma a falha de um upload em mensagem acionável.
 *
 * Antes a tela dizia "Não foi possível enviar o arquivo. Tente novamente." para
 * qualquer erro — inclusive permissão de disco e corte por proxy, casos em que
 * tentar de novo nunca resolveria. O servidor sabia o motivo e a pessoa não.
 */
export function mensagemDeUpload(err: unknown): string {
  const bruta = err instanceof Error ? err.message : String(err ?? "");

  // Corpo cortado pelo proxy: o navegador não recebe resposta útil, então o
  // erro chega como falha de rede ou de parsing.
  if (
    /failed to fetch|networkerror|load failed|unexpected token|não é json|body/i.test(bruta) ||
    bruta.trim() === ""
  ) {
    return "O envio foi interrompido antes de chegar ao servidor. Se o arquivo for grande, provavelmente há um limite de tamanho no proxy (nginx: client_max_body_size).";
  }

  // 413 explícito
  if (/413|payload too large|request entity too large/i.test(bruta)) {
    return "O servidor recusou o arquivo por tamanho. Ajuste o limite do proxy (nginx: client_max_body_size 120m).";
  }

  return bruta || "Não foi possível enviar o arquivo.";
}
