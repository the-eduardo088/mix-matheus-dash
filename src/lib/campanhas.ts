/**
 * Campanhas — ponte cliente ↔ servidor.
 *
 * Substitui o antigo `campaigns.ts`, que guardava tudo no navegador (
 * localStorage + IndexedDB). Aquilo não permitia que o admin enxergasse a
 * campanha criada pelo cliente: o dado nunca saía da máquina de quem digitou.
 *
 * As regras puras (limites de mídia, validação, formatação) continuam no
 * cliente para o formulário dar retorno imediato — mas são reaplicadas no
 * servidor, que é quem de fato decide.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { CampanhaDTO, MidiaCampanha, RelatorioDTO, StatusCampanha } from "./server/campanhas";

export type { CampanhaDTO, MidiaCampanha, RelatorioDTO, StatusCampanha };
export type MediaKind = MidiaCampanha["kind"];

/* ────────────────────────── REGRAS (cliente + servidor) ──────────────────── */

export const ANTECEDENCIA_MINIMA_HORAS = 24;
export const COPY_MAX_CHARS = 1024;

const MB = 1024 * 1024;

export const MEDIA_SPECS: Record<
  MediaKind,
  { label: string; tipos: string[]; maxBytes: number; extensoes: string }
> = {
  imagem: {
    label: "Imagem",
    tipos: ["image/jpeg", "image/png"],
    maxBytes: 5 * MB,
    extensoes: "JPG, PNG",
  },
  video: {
    label: "Vídeo",
    tipos: ["video/mp4", "video/3gpp"],
    maxBytes: 16 * MB,
    extensoes: "MP4, 3GP",
  },
  audio: {
    label: "Áudio",
    tipos: ["audio/aac", "audio/mpeg", "audio/mp4", "audio/ogg", "audio/amr"],
    maxBytes: 16 * MB,
    extensoes: "MP3, AAC, OGG, AMR",
  },
  documento: {
    label: "Documento",
    tipos: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "text/plain",
    ],
    maxBytes: 100 * MB,
    extensoes: "PDF, DOC, XLS, PPT, TXT",
  },
};

export const MEDIA_ACCEPT = Object.values(MEDIA_SPECS)
  .flatMap((s) => s.tipos)
  .join(",");

export function classificarMedia(mime: string): MediaKind | null {
  for (const [kind, spec] of Object.entries(MEDIA_SPECS)) {
    if (spec.tipos.includes(mime)) return kind as MediaKind;
  }
  return null;
}

export function formatarBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < MB) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / MB).toFixed(1)} MB`;
}

/** URL de download do anexo. Passa pela checagem de sessão em `server.ts`. */
export function urlDoArquivo(id: string): string {
  return `/arquivos/${id}`;
}

/* ────────────────────────────── AGENDAMENTO ─────────────────────────────── */

export function minimoAgendamento(agora: Date = new Date()): Date {
  return new Date(agora.getTime() + ANTECEDENCIA_MINIMA_HORAS * 60 * 60 * 1000);
}

/**
 * Formata para `<input type="datetime-local">`, que exige horário LOCAL no
 * formato `YYYY-MM-DDTHH:mm` — usar `toISOString()` aqui deslocaria o horário
 * pelo fuso e abriria brecha na regra das 24 h.
 */
export function paraInputLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function formatarDataHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function distanciaAte(iso: string, agora: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diffMin = Math.round((d.getTime() - agora.getTime()) / 60000);
  const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
  const abs = Math.abs(diffMin);
  if (abs < 60) return rtf.format(diffMin, "minute");
  if (abs < 60 * 24) return rtf.format(Math.round(diffMin / 60), "hour");
  return rtf.format(Math.round(diffMin / 1440), "day");
}

export type ErrosCampanha = Partial<
  Record<"nome" | "scopeId" | "copy" | "agendadaPara" | "botaoTexto" | "botaoUrl", string>
>;

/** Validação do formulário. O servidor repete tudo isso — aqui é só retorno rápido. */
export function validarCampanha(
  input: {
    nome?: string;
    scopeId?: string;
    copy?: string;
    agendadaPara?: string;
    botaoTexto?: string;
    botaoUrl?: string;
  },
  agora: Date = new Date(),
): ErrosCampanha {
  const erros: ErrosCampanha = {};

  if (!input.nome?.trim()) erros.nome = "Dê um nome para identificar a campanha.";
  if (!input.scopeId) erros.scopeId = "Selecione a base que vai receber o disparo.";

  const copy = input.copy?.trim() ?? "";
  if (!copy) erros.copy = "Escreva o texto da mensagem.";
  else if (copy.length > COPY_MAX_CHARS)
    erros.copy = `A mensagem tem ${copy.length} caracteres — o limite do WhatsApp é ${COPY_MAX_CHARS}.`;

  if (!input.agendadaPara) {
    erros.agendadaPara = "Escolha a data e a hora do disparo.";
  } else if (Number.isNaN(new Date(input.agendadaPara).getTime())) {
    erros.agendadaPara = "Data inválida.";
  }
  // Antecedência abaixo de 24 h NÃO é erro — ver `abaixoDaAntecedencia`.

  // Botão: texto e link andam juntos, e a URL precisa ser http(s).
  const bt = input.botaoTexto?.trim() ?? "";
  const bu = input.botaoUrl?.trim() ?? "";
  if (bt && !bu) erros.botaoUrl = "Informe o link do botão, ou apague o texto.";
  if (bu && !bt) erros.botaoTexto = "Dê um texto ao botão, ou apague o link.";
  if (bu && !/^https?:\/\//i.test(bu)) erros.botaoUrl = "O link precisa começar com https://";

  return erros;
}

/**
 * A campanha está agendada para menos de 24 h a partir da referência?
 *
 * Serve para AVISAR, nunca para bloquear. A janela existe porque aprovação de
 * template pela Meta e aquecimento de números levam tempo — mas quem decide se
 * vale correr o risco é o admin, na aprovação, não uma validação automática.
 */
export function abaixoDaAntecedencia(
  agendadaPara: string,
  referencia: string | Date = new Date(),
): boolean {
  const alvo = new Date(agendadaPara).getTime();
  const base = new Date(referencia).getTime();
  if (Number.isNaN(alvo) || Number.isNaN(base)) return false;
  return alvo - base < ANTECEDENCIA_MINIMA_HORAS * 60 * 60 * 1000;
}

/** Quanto tempo falta, em horas, entre a referência e o disparo. */
export function horasDeAntecedencia(
  agendadaPara: string,
  referencia: string | Date = new Date(),
): number {
  const diff = new Date(agendadaPara).getTime() - new Date(referencia).getTime();
  return Math.max(0, Math.round(diff / 3_600_000));
}

export function temErros(erros: ErrosCampanha): boolean {
  return Object.keys(erros).length > 0;
}

export const STATUS_ROTULO: Record<StatusCampanha, string> = {
  rascunho: "Rascunho",
  aguardando_aprovacao: "Aguardando aprovação",
  aprovada: "Aprovada",
  recusada: "Recusada",
  cancelada: "Cancelada",
};

/* ────────────────────────────── SERVER FUNCTIONS ────────────────────────── */

async function exigirSessaoServidor() {
  const { lerSessao } = await import("./server/sessao");
  const sessao = await lerSessao();
  if (!sessao) throw new Error("Não autenticado.");
  return sessao;
}

export const listarCampanhas = createServerFn({ method: "GET" }).handler(
  async (): Promise<CampanhaDTO[]> => {
    const sessao = await exigirSessaoServidor();
    const { listarCampanhas: listar } = await import("./server/campanhas");
    return listar(sessao);
  },
);

/** Uma campanha, respeitando o papel. `null` se não existe ou não é sua. */
export const buscarCampanha = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }): Promise<CampanhaDTO | null> => {
    const sessao = await exigirSessaoServidor();
    const { buscarCampanha: buscar } = await import("./server/campanhas");
    return buscar(sessao, data.id);
  });

export const BOTAO_TEXTO_MAX = 25; // limite do rótulo de botão no WhatsApp

const entradaCampanha = z
  .object({
    nome: z.string().trim().min(1).max(200),
    scopeId: z.string().min(1),
    cidade: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .nullable()
      .optional()
      .transform((v) => v ?? null),
    copy: z.string().trim().min(1).max(COPY_MAX_CHARS),
    botaoTexto: z
      .string()
      .trim()
      .max(BOTAO_TEXTO_MAX)
      .nullable()
      .optional()
      .transform((v) => v || null),
    botaoUrl: z
      .string()
      .trim()
      .url("Link do botão inválido — comece com https://")
      .nullable()
      .optional()
      .transform((v) => v || null),
    midiaId: z.string().uuid().nullable(),
    agendadaPara: z.string().min(1),
  })
  // Botão exige rótulo E link juntos — o banco tem a mesma regra.
  .refine((d) => (d.botaoTexto === null) === (d.botaoUrl === null), {
    message: "Para um botão, preencha o texto e o link. Deixe ambos vazios para não usar botão.",
    path: ["botaoTexto"],
  });

export const criarCampanha = createServerFn({ method: "POST" })
  .validator(entradaCampanha)
  .handler(async ({ data }): Promise<CampanhaDTO> => {
    const sessao = await exigirSessaoServidor();

    // A janela de 24 h é RECOMENDAÇÃO, não bloqueio: agendar para daqui a
    // 3 h é aceito, apenas sinalizado para o admin na hora de aprovar. Só a
    // data inválida é recusada aqui.
    const alvo = new Date(data.agendadaPara);
    if (Number.isNaN(alvo.getTime())) throw new Error("Data inválida.");

    const { criarCampanha: criar } = await import("./server/campanhas");
    return criar(sessao, data);
  });

export const cancelarCampanha = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const sessao = await exigirSessaoServidor();
    const { cancelarCampanha: cancelar } = await import("./server/campanhas");
    await cancelar(sessao, data.id);
    return { ok: true as const };
  });

export const excluirCampanha = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const sessao = await exigirSessaoServidor();
    const { excluirCampanha: excluir } = await import("./server/campanhas");
    const caminho = await excluir(sessao, data.id);
    if (caminho) {
      const { apagarDoDisco } = await import("./server/arquivos");
      await apagarDoDisco(caminho);
    }
    return { ok: true as const };
  });

/** Upload do anexo. Recebe FormData porque arquivo não passa por JSON. */
export const enviarMidia = createServerFn({ method: "POST" })
  .validator((data: FormData) => {
    if (!(data instanceof FormData)) throw new Error("Envio inválido.");
    return data;
  })
  .handler(async ({ data }): Promise<MidiaCampanha> => {
    const sessao = await exigirSessaoServidor();

    const file = data.get("arquivo");
    if (!(file instanceof File)) {
      // Chegar aqui com o campo vazio normalmente significa que o corpo do
      // POST foi cortado antes do Node — proxy reverso com limite de tamanho é
      // a causa mais comum (o nginx corta em 1 MB por padrão).
      throw new Error(
        "Nenhum arquivo recebido. Se há um proxy na frente (nginx), confira o limite de tamanho do corpo (client_max_body_size).",
      );
    }

    const { salvarArquivo } = await import("./server/arquivos");
    const salvo = await salvarArquivo(file, sessao.id);
    return {
      id: salvo.id,
      nome: salvo.nome,
      mime: salvo.mime,
      tamanho: salvo.tamanho,
      kind: salvo.kind,
    };
  });

/* ───────────────────────── APROVAÇÃO E RELATÓRIO ────────────────────────── */

export const aprovarCampanha = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const sessao = await exigirSessaoServidor();
    const { aprovarCampanha: aprovar } = await import("./server/campanhas");
    await aprovar(sessao, data.id);
    return { ok: true as const };
  });

export const recusarCampanha = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().uuid(),
      motivo: z.string().trim().min(1, "Explique o motivo da recusa.").max(500),
    }),
  )
  .handler(async ({ data }) => {
    const sessao = await exigirSessaoServidor();
    const { recusarCampanha: recusar } = await import("./server/campanhas");
    await recusar(sessao, data.id, data.motivo);
    return { ok: true as const };
  });

/** Métrica do relatório: inteiro ≥ 0, ou vazio (nem toda plataforma reporta tudo). */
// Teto = maior valor de `integer` no Postgres. Sem isso, colar um número
// gigante estourava com erro cru (22003) em vez de mensagem de validação.
const metrica = z
  .union([z.number().int().min(0).max(2_147_483_647), z.null()])
  .optional()
  .transform((v) => v ?? null);

export const salvarRelatorio = createServerFn({ method: "POST" })
  .validator(
    z.object({
      campanhaId: z.string().uuid(),
      entregues: metrica,
      lidas: metrica,
      respostas: metrica,
      falhas: metrica,
      observacoes: z
        .string()
        .max(2000)
        .nullable()
        .optional()
        .transform((v) => v ?? null),
      anexoId: z
        .string()
        .uuid()
        .nullable()
        .optional()
        .transform((v) => v ?? null),
    }),
  )
  .handler(async ({ data }) => {
    const sessao = await exigirSessaoServidor();
    const { salvarRelatorio: salvar } = await import("./server/campanhas");
    await salvar(sessao, data);
    return { ok: true as const };
  });

/** Soma uma métrica entre as campanhas que já têm relatório. */
export function somarMetrica(
  campanhas: CampanhaDTO[],
  campo: "entregues" | "lidas" | "respostas" | "falhas",
): number | null {
  const valores = campanhas
    .map((c) => c.relatorio?.[campo])
    .filter((v): v is number => typeof v === "number");
  return valores.length ? valores.reduce((a, b) => a + b, 0) : null;
}
