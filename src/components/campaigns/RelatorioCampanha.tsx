import { BarChart3 } from "lucide-react";

import { MediaIcon } from "@/components/campaigns/MediaPreview";
import { formatNumber, formatPercent, pct } from "@/lib/mix-data";
import {
  formatarBytes,
  formatarDataHora,
  urlDoArquivo,
  type CampanhaDTO,
  type RelatorioDTO,
} from "@/lib/campanhas";

/**
 * Uma métrica do disparo. Métrica ausente mostra "—", nunca zero: a plataforma
 * pode simplesmente não ter reportado aquele número, e exibir 0 afirmaria que
 * ninguém leu quando o certo é "não sabemos".
 */
function Metrica({
  label,
  valor,
  base,
  destaque,
}: {
  label: string;
  valor: number | null;
  base: number;
  destaque?: string;
}) {
  return (
    <div className="rounded-xl border bg-background p-3">
      <p className="font-subtitle text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      {valor == null ? (
        <p className="mt-1 font-display text-xl font-bold leading-none text-muted-foreground/40">
          —
        </p>
      ) : (
        <>
          <p
            className={`font-num mt-1 font-display text-xl font-bold leading-none ${destaque ?? "text-foreground"}`}
          >
            {formatNumber(valor)}
          </p>
          {base > 0 && (
            <p className="font-num mt-1 text-[11px] text-muted-foreground">
              {formatPercent(pct(valor, base))} do alcance
            </p>
          )}
        </>
      )}
    </div>
  );
}

export function RelatorioCampanha({
  relatorio,
  campanha,
}: {
  relatorio: RelatorioDTO;
  campanha: CampanhaDTO;
}) {
  const base = campanha.alcanceContatos;

  return (
    <div className="mt-4 rounded-xl border border-[color:var(--success)]/30 bg-[color:var(--success)]/[0.06] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="inline-flex items-center gap-1.5 font-display text-sm font-semibold">
          <BarChart3 className="h-4 w-4 text-[color:var(--success)]" />
          Relatório do disparo
        </h4>
        <p className="font-subtitle text-[11px] text-muted-foreground">
          {relatorio.criadoPorNome} · {formatarDataHora(relatorio.criadoEm)}
        </p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metrica
          label="Entregues"
          valor={relatorio.entregues}
          base={base}
          destaque="text-[color:var(--success)]"
        />
        <Metrica label="Lidas" valor={relatorio.lidas} base={base} />
        <Metrica label="Respostas" valor={relatorio.respostas} base={base} />
        <Metrica label="Falhas" valor={relatorio.falhas} base={base} destaque="text-destructive" />
      </div>

      {relatorio.observacoes && (
        <p className="mt-3 whitespace-pre-wrap rounded-lg bg-background/60 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          {relatorio.observacoes}
        </p>
      )}

      {relatorio.anexo && (
        <a
          href={urlDoArquivo(relatorio.anexo.id)}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-xs font-medium transition hover:bg-muted"
        >
          <MediaIcon kind={relatorio.anexo.kind} className="h-3.5 w-3.5 text-primary" />
          {relatorio.anexo.nome}
          <span className="font-num text-muted-foreground">
            ({formatarBytes(relatorio.anexo.tamanho)})
          </span>
        </a>
      )}
    </div>
  );
}
