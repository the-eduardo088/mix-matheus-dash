/**
 * Arquivos em disco. SOMENTE SERVIDOR.
 *
 * O binário vai para UPLOADS_DIR; o Postgres guarda só metadado e caminho.
 * Guardar o arquivo no banco (base64 ou bytea) obrigaria a carregar os 100 MB
 * inteiros na RAM a cada download e incharia todo `pg_dump`.
 */
import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, stat, unlink } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import { query, queryOne } from "./db";

export type MediaKind = "imagem" | "video" | "audio" | "documento";

const MB = 1024 * 1024;

/** Tipos e tetos por categoria, conforme a WhatsApp Cloud API. */
export const LIMITES: Record<MediaKind, { tipos: string[]; maxBytes: number }> = {
  imagem: { tipos: ["image/jpeg", "image/png"], maxBytes: 5 * MB },
  video: { tipos: ["video/mp4", "video/3gpp"], maxBytes: 16 * MB },
  audio: {
    tipos: ["audio/aac", "audio/mpeg", "audio/mp4", "audio/ogg", "audio/amr"],
    maxBytes: 16 * MB,
  },
  documento: {
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
  },
};

export function classificar(mime: string): MediaKind | null {
  for (const [kind, spec] of Object.entries(LIMITES)) {
    if (spec.tipos.includes(mime)) return kind as MediaKind;
  }
  return null;
}

/** Raiz dos uploads, resolvida uma vez. */
function raiz(): string {
  return resolve(process.env.UPLOADS_DIR || "./uploads");
}

/**
 * Confere que um caminho vindo do banco continua dentro da raiz de uploads.
 * Defesa contra path traversal: mesmo que alguém grave `../../etc/passwd` na
 * coluna, a leitura é recusada.
 */
function dentroDaRaiz(caminhoRelativo: string): string {
  const base = raiz();
  const alvo = resolve(base, caminhoRelativo);
  if (alvo !== base && !alvo.startsWith(base + sep)) {
    throw new Error("Caminho de arquivo fora da pasta de uploads.");
  }
  return alvo;
}

export type ArquivoSalvo = {
  id: string;
  nome: string;
  mime: string;
  tamanho: number;
  kind: MediaKind;
};

/**
 * Grava o arquivo e registra no banco.
 *
 * O nome no disco é sorteado (UUID) e nunca deriva do nome enviado: um arquivo
 * chamado `../../.env` ou `foto.png.sh` não vira caminho nem executável. O nome
 * original fica só no banco, para exibição e download.
 */
export async function salvarArquivo(file: File, usuarioId: string): Promise<ArquivoSalvo> {
  const kind = classificar(file.type);
  if (!kind) throw new Error("Formato não aceito pelo WhatsApp.");

  const limite = LIMITES[kind].maxBytes;
  if (file.size > limite) {
    throw new Error(
      `Arquivo de ${(file.size / MB).toFixed(1)} MB excede o limite de ${limite / MB} MB.`,
    );
  }
  if (file.size === 0) throw new Error("Arquivo vazio.");

  // Subpasta por ano/mês: evita milhares de arquivos num diretório só, o que
  // degrada listagem e backup.
  const agora = new Date();
  const pasta = `${agora.getFullYear()}/${String(agora.getMonth() + 1).padStart(2, "0")}`;
  const relativo = join(pasta, randomUUID());
  const absoluto = dentroDaRaiz(relativo);

  // Grava em STREAMING: o arquivo (até 100 MB) nunca é materializado inteiro
  // na RAM. `file.arrayBuffer()` faria isso — dois ou três uploads grandes
  // simultâneos estouravam a memória de uma VPS pequena.
  //
  // Erros de disco viram mensagem que diz o que fazer, em vez de "tente
  // novamente" para uma permissão negada que tentar de novo não resolve.
  try {
    await mkdir(dirname(absoluto), { recursive: true });
    // `file.stream()` é um ReadableStream web; Readable.fromWeb o adapta para
    // o stream do Node, e o pipeline aplica backpressure sozinho.
    await pipeline(
      Readable.fromWeb(file.stream() as import("node:stream/web").ReadableStream),
      createWriteStream(absoluto),
    );
  } catch (err) {
    const codigo = (err as NodeJS.ErrnoException)?.code;
    const pasta = raiz();
    if (codigo === "EACCES" || codigo === "EPERM") {
      throw new Error(
        `Sem permissão para gravar em ${pasta}. Dê acesso ao usuário que roda a aplicação (ex.: chown -R app:app ${pasta}).`,
      );
    }
    if (codigo === "ENOSPC") {
      throw new Error(`Sem espaço em disco para gravar em ${pasta}.`);
    }
    if (codigo === "EROFS") {
      throw new Error(`O disco em ${pasta} está montado como somente leitura.`);
    }
    throw new Error(`Falha ao gravar o arquivo em ${pasta}: ${codigo ?? (err as Error).message}`);
  }

  try {
    const row = await queryOne<{ id: string }>(
      `insert into arquivos (nome_original, mime, tamanho, kind, caminho, criado_por)
       values ($1,$2,$3,$4,$5,$6) returning id`,
      [file.name.slice(0, 255), file.type, file.size, kind, relativo, usuarioId],
    );
    return { id: row!.id, nome: file.name, mime: file.type, tamanho: file.size, kind };
  } catch (err) {
    // Insert falhou: o arquivo já está no disco e ficaria órfão para sempre.
    await unlink(absoluto).catch(() => {});
    throw err;
  }
}

export type ArquivoParaEnvio = {
  caminhoAbsoluto: string;
  nome: string;
  mime: string;
  tamanho: number;
};

/** Metadados para servir o download. `null` se não existe. */
export async function localizarArquivo(id: string): Promise<ArquivoParaEnvio | null> {
  const row = await queryOne<{
    caminho: string;
    nome_original: string;
    mime: string;
    tamanho: string;
  }>("select caminho, nome_original, mime, tamanho from arquivos where id = $1", [id]);
  if (!row) return null;

  const absoluto = dentroDaRaiz(row.caminho);
  try {
    await stat(absoluto);
  } catch {
    return null; // registro existe mas o arquivo sumiu do disco
  }

  return {
    caminhoAbsoluto: absoluto,
    nome: row.nome_original,
    mime: row.mime,
    tamanho: Number(row.tamanho),
  };
}

/**
 * Stream de leitura com backpressure — nunca carrega o arquivo inteiro na
 * memória E pausa quando o cliente é lento.
 *
 * A versão anterior fazia `enqueue` a cada chunk sem olhar `desiredSize`: um
 * cliente lento baixando um PDF de 100 MB acumulava o arquivo todo na fila do
 * ReadableStream — o mesmo estouro de RAM que o disco deveria evitar. Pausar o
 * stream do Node quando a fila enche resolve.
 */
export function abrirStream(caminhoAbsoluto: string): ReadableStream {
  const node = createReadStream(caminhoAbsoluto);
  return new ReadableStream({
    start(controller) {
      node.on("data", (chunk) => {
        controller.enqueue(new Uint8Array(chunk as Buffer));
        if ((controller.desiredSize ?? 1) <= 0) node.pause();
      });
      node.on("end", () => controller.close());
      node.on("error", (err) => controller.error(err));
    },
    pull() {
      node.resume();
    },
    cancel() {
      node.destroy();
    },
  });
}

/** Apaga do disco. Usado quando a campanha dona é excluída. */
export async function apagarDoDisco(caminhoRelativo: string): Promise<void> {
  try {
    await unlink(dentroDaRaiz(caminhoRelativo));
  } catch {
    /* já não existe — nada a fazer */
  }
}

/** ETag estável para cache do navegador. */
export function etagDe(id: string, tamanho: number): string {
  return `"${createHash("sha1").update(`${id}:${tamanho}`).digest("hex").slice(0, 16)}"`;
}

/**
 * A sessão pode ver este arquivo?
 *
 * Sim quando o arquivo é o anexo de uma campanha, OU o anexo de um relatório,
 * que a pessoa alcança pelo papel: admin vê tudo; cliente vê o que criou.
 * Consulta única com `exists`.
 */
export async function podeVerArquivo(
  sessao: { id: string; papel: "admin" | "cliente" },
  arquivoId: string,
): Promise<boolean> {
  if (sessao.papel === "admin") {
    const r = await queryOne<{ ok: boolean }>(
      `select exists(
         select 1 from campanhas where midia_id = $1
         union all
         select 1 from relatorios where anexo_id = $1
       ) as ok`,
      [arquivoId],
    );
    return r?.ok ?? false;
  }

  // Cliente: o arquivo tem de pertencer a uma campanha dele — seja a mídia da
  // campanha, seja o anexo do relatório daquela campanha.
  const r = await queryOne<{ ok: boolean }>(
    `select exists(
       select 1 from campanhas c where c.midia_id = $1 and c.criada_por = $2
       union all
       select 1 from relatorios r
         join campanhas c on c.id = r.campanha_id
        where r.anexo_id = $1 and c.criada_por = $2
     ) as ok`,
    [arquivoId, sessao.id],
  );
  return r?.ok ?? false;
}
