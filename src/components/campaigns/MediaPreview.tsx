import { FileText, Film, Image as ImageIcon, Music, Paperclip } from "lucide-react";

import {
  MEDIA_SPECS,
  formatarBytes,
  urlDoArquivo,
  type MediaKind,
  type MidiaCampanha,
} from "@/lib/campanhas";

const ICONES: Record<MediaKind, typeof FileText> = {
  imagem: ImageIcon,
  video: Film,
  audio: Music,
  documento: FileText,
};

export function MediaIcon({ kind, className }: { kind: MediaKind; className?: string }) {
  const Icon = ICONES[kind] ?? Paperclip;
  return <Icon className={className} />;
}

/**
 * O arquivo agora vem por URL (`/arquivos/<id>`), servida com sessão e
 * streaming. Antes era um blob do IndexedDB, que só existia no navegador de
 * quem subiu — o admin nunca conseguiria ver o anexo do cliente.
 */

/** Cartão de arquivo — usado para documento e áudio, e como fallback. */
function CartaoArquivo({ midia, compacto }: { midia: MidiaCampanha; compacto?: boolean }) {
  return (
    <a
      href={urlDoArquivo(midia.id)}
      target="_blank"
      rel="noreferrer"
      className={`flex items-center gap-2.5 rounded-lg border bg-background p-2.5 transition hover:bg-muted ${
        compacto ? "" : "w-full"
      }`}
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <MediaIcon kind={midia.kind} className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium">{midia.nome}</span>
        <span className="font-num block text-[11px] text-muted-foreground">
          {MEDIA_SPECS[midia.kind].label} · {formatarBytes(midia.tamanho)}
        </span>
      </span>
    </a>
  );
}

/**
 * Mídia dentro do balão do WhatsApp: imagem e vídeo aparecem inline,
 * documento e áudio viram anexo — igual ao app real.
 */
export function MediaBubble({ midia }: { midia: MidiaCampanha }) {
  const url = urlDoArquivo(midia.id);

  if (midia.kind === "imagem") {
    return <img src={url} alt="Mídia da campanha" className="aspect-[4/3] w-full object-cover" />;
  }

  if (midia.kind === "video") {
    return <video src={url} controls className="aspect-[4/3] w-full bg-black object-contain" />;
  }

  if (midia.kind === "audio") {
    return (
      <div className="px-3 pt-3">
        <audio src={url} controls className="w-full" />
      </div>
    );
  }

  return (
    <div className="px-3 pt-3">
      <CartaoArquivo midia={midia} />
    </div>
  );
}

/** Miniatura para a lista de campanhas em Relatórios. */
export function MediaThumb({ midia }: { midia: MidiaCampanha }) {
  const url = urlDoArquivo(midia.id);

  if (midia.kind === "imagem") {
    return (
      <img
        src={url}
        alt="Mídia da campanha"
        className="h-24 w-24 shrink-0 rounded-xl object-cover ring-1 ring-border"
      />
    );
  }

  if (midia.kind === "video") {
    return (
      <video
        src={url}
        controls
        className="h-24 w-32 shrink-0 rounded-xl bg-black object-contain ring-1 ring-border"
      />
    );
  }

  return (
    <div className="w-full sm:w-56">
      <CartaoArquivo midia={midia} compacto />
    </div>
  );
}
