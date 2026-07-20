import { ExternalLink } from "lucide-react";

import { MediaBubble } from "@/components/campaigns/MediaPreview";
import type { MidiaCampanha } from "@/lib/campanhas";

/**
 * Prévia fiel ao balão do WhatsApp — o que a pessoa recebe no celular.
 * Compartilhado entre o formulário (ao vivo) e a tela de detalhe.
 */
export function BalaoWhatsApp({
  copy,
  midia,
  botaoTexto,
  botaoUrl,
  hora,
}: {
  copy: string;
  midia?: MidiaCampanha | null;
  botaoTexto?: string | null;
  botaoUrl?: string | null;
  /** Se `true`, o botão vira link clicável (no detalhe). No formulário fica estático. */
  hora?: string;
}) {
  const horaTexto =
    hora ??
    new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date());

  return (
    <div className="rounded-2xl p-4" style={{ background: "var(--color-muted)" }}>
      <div className="mx-auto max-w-[320px]">
        <div className="overflow-hidden rounded-xl rounded-tl-sm bg-card shadow-sm ring-1 ring-black/5">
          {midia && <MediaBubble midia={midia} />}
          <div className="px-3 py-2.5">
            {copy.trim() ? (
              <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-card-foreground">
                {copy}
              </p>
            ) : (
              <p className="text-[13px] italic text-muted-foreground">
                O texto da mensagem aparece aqui…
              </p>
            )}
            <p className="font-num mt-1 text-right text-[10px] text-muted-foreground">
              {horaTexto}
            </p>
          </div>

          {/* Botão de link, como o WhatsApp o desenha: faixa própria abaixo da
              mensagem, separada por linha, com ícone de link. */}
          {botaoTexto?.trim() &&
            (botaoUrl ? (
              <a
                href={botaoUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 border-t border-black/5 py-2.5 text-[13px] font-medium text-[#00a5f4] transition hover:bg-[#00a5f4]/5"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {botaoTexto.trim()}
              </a>
            ) : (
              <div className="flex items-center justify-center gap-1.5 border-t border-black/5 py-2.5 text-[13px] font-medium text-[#00a5f4]">
                <ExternalLink className="h-3.5 w-3.5" />
                {botaoTexto.trim()}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
