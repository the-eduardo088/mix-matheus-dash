/**
 * Proteção de rota. Roda no `beforeLoad`, ou seja, ANTES de a página montar —
 * quem não tem sessão é redirecionado sem que o conteúdo chegue a renderizar.
 */
import { redirect } from "@tanstack/react-router";

import type { Papel, Sessao } from "./auth";

/**
 * Exige sessão. Guarda o destino em `?redirect=` para devolver a pessoa ao
 * lugar certo depois do login, em vez de jogá-la sempre na home.
 */
export function exigirSessao(sessao: Sessao | null | undefined, href: string): Sessao {
  if (!sessao) {
    throw redirect({ to: "/login", search: { redirect: href } });
  }
  return sessao;
}

/** Exige sessão E papel. Manda para a home quem está logado mas sem permissão. */
export function exigirPapel(
  sessao: Sessao | null | undefined,
  href: string,
  ...papeis: Papel[]
): Sessao {
  const s = exigirSessao(sessao, href);
  if (!papeis.includes(s.papel)) {
    throw redirect({ to: "/" });
  }
  return s;
}
