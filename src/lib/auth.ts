/**
 * Autenticação — ponte entre o cliente e o servidor.
 *
 * Os handlers só rodam no servidor; o cliente recebe apenas um stub que faz a
 * chamada RPC. O `import()` dinâmico dentro de cada handler garante que o
 * driver do Postgres nunca entre no grafo de módulos do navegador.
 *
 * (Antes daqui existia um objeto CREDENTIALS com e-mail e senha fixos no
 * código, visíveis para qualquer um que abrisse o bundle. Foi aposentado —
 * agora as contas vivem na tabela `usuarios`, com hash scrypt.)
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type Papel = "admin" | "cliente";

export type Sessao = {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
};

const credenciais = z.object({
  email: z.string().trim().min(1, "Informe o e-mail").email("E-mail inválido"),
  senha: z.string().min(1, "Informe a senha"),
});

export const entrar = createServerFn({ method: "POST" })
  .validator(credenciais)
  .handler(async ({ data }) => {
    const { autenticar } = await import("./server/autenticacao");
    return autenticar(data.email, data.senha);
  });

export const sair = createServerFn({ method: "POST" }).handler(async () => {
  const { destruirSessao } = await import("./server/sessao");
  await destruirSessao();
  return { ok: true as const };
});

/** Sessão do request atual, ou `null`. Base de toda a proteção de rota. */
export const sessaoAtual = createServerFn({ method: "GET" }).handler(
  async (): Promise<Sessao | null> => {
    const { lerSessao } = await import("./server/sessao");
    return lerSessao();
  },
);
