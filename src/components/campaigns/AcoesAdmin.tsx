import { useState } from "react";
import { AlertTriangle, BarChart3, Check, Paperclip, Trash2, X } from "lucide-react";

import { MediaIcon } from "@/components/campaigns/MediaPreview";
import {
  MEDIA_ACCEPT,
  MEDIA_SPECS,
  abaixoDaAntecedencia,
  aprovarCampanha,
  classificarMedia,
  enviarMidia,
  formatarBytes,
  recusarCampanha,
  salvarRelatorio,
  type CampanhaDTO,
  type MidiaCampanha,
} from "@/lib/campanhas";

/** Aprovar ou recusar. A recusa exige motivo — o banco também obriga. */
export function RevisaoCampanha({ c, onMudou }: { c: CampanhaDTO; onMudou: () => void }) {
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function executar(acao: () => Promise<unknown>) {
    setOcupado(true);
    setErro(null);
    try {
      await acao();
      onMudou();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível concluir.");
      setOcupado(false);
    }
  }

  if (recusando) {
    return (
      <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
        <label
          htmlFor={`motivo-${c.id}`}
          className="font-subtitle mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-destructive"
        >
          Motivo da recusa
        </label>
        <textarea
          id={`motivo-${c.id}`}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="Ex.: a imagem está fora do padrão da marca — reenviar em alta resolução."
          className="w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          O Mix Mateus vê este texto — explique o que precisa mudar.
        </p>

        {erro && <p className="mt-2 text-xs font-medium text-destructive">{erro}</p>}

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() =>
              executar(() => recusarCampanha({ data: { id: c.id, motivo: motivo.trim() } }))
            }
            disabled={ocupado || !motivo.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-2 text-xs font-semibold text-destructive-foreground transition hover:bg-destructive/90 disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" />
            Confirmar recusa
          </button>
          <button
            onClick={() => {
              setRecusando(false);
              setErro(null);
            }}
            disabled={ocupado}
            className="rounded-lg border bg-background px-3 py-2 text-xs font-semibold transition hover:bg-muted"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  const prazoCurto = abaixoDaAntecedencia(c.agendadaPara, c.criadaEm);

  return (
    <div className="mt-4 rounded-xl border bg-muted/40 p-3">
      {prazoCurto && (
        <p className="mb-3 flex items-start gap-2 rounded-lg border border-[color:var(--warning)]/40 bg-[color:var(--warning)]/10 p-2.5 text-xs leading-relaxed text-foreground">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--warning)]" />
          <span>
            Agendada com <strong>menos de 24 h</strong> de antecedência. Confirme se dá tempo de
            aprovar o template e aquecer os números antes de liberar.
          </span>
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-subtitle mr-auto text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Aguardando sua revisão
        </span>
        {erro && <p className="w-full text-xs font-medium text-destructive">{erro}</p>}
        <button
          onClick={() => executar(() => aprovarCampanha({ data: { id: c.id } }))}
          disabled={ocupado}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[color:var(--success)] px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" />
          Aprovar
        </button>
        <button
          onClick={() => setRecusando(true)}
          disabled={ocupado}
          className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 bg-background px-3 py-2 text-xs font-semibold text-destructive transition hover:bg-destructive/10 disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" />
          Recusar
        </button>
      </div>
    </div>
  );
}

/**
 * Formulário do relatório do disparo. Todos os números são opcionais: nem toda
 * plataforma reporta tudo, e meia informação verdadeira é melhor que um campo
 * preenchido por obrigação.
 */
export function FormularioRelatorio({ c, onMudou }: { c: CampanhaDTO; onMudou: () => void }) {
  const jaTem = c.relatorio;
  const [aberto, setAberto] = useState(false);
  const [entregues, setEntregues] = useState(jaTem?.entregues?.toString() ?? "");
  const [lidas, setLidas] = useState(jaTem?.lidas?.toString() ?? "");
  const [respostas, setRespostas] = useState(jaTem?.respostas?.toString() ?? "");
  const [falhas, setFalhas] = useState(jaTem?.falhas?.toString() ?? "");
  const [observacoes, setObservacoes] = useState(jaTem?.observacoes ?? "");
  const [anexo, setAnexo] = useState<MidiaCampanha | null>(jaTem?.anexo ?? null);
  const [enviando, setEnviando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const num = (v: string) => {
    const t = v.trim();
    if (!t) return null;
    const n = Number(t.replace(/\D/g, ""));
    return Number.isFinite(n) ? n : null;
  };

  async function onArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErro(null);

    const kind = classificarMedia(file.type);
    if (!kind) {
      setErro("Formato não aceito. Envie PDF, planilha ou imagem.");
      e.target.value = "";
      return;
    }
    if (file.size > MEDIA_SPECS[kind].maxBytes) {
      setErro(`Arquivo acima do limite de ${formatarBytes(MEDIA_SPECS[kind].maxBytes)}.`);
      e.target.value = "";
      return;
    }

    setEnviando(true);
    try {
      const form = new FormData();
      form.append("arquivo", file);
      setAnexo(await enviarMidia({ data: form }));
    } catch {
      setErro("Não foi possível enviar o arquivo.");
    } finally {
      setEnviando(false);
    }
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      await salvarRelatorio({
        data: {
          campanhaId: c.id,
          entregues: num(entregues),
          lidas: num(lidas),
          respostas: num(respostas),
          falhas: num(falhas),
          observacoes: observacoes.trim() || null,
          anexoId: anexo?.id ?? null,
        },
      });
      setAberto(false);
      onMudou();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar o relatório.");
    } finally {
      setSalvando(false);
    }
  }

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-2 text-xs font-semibold transition hover:bg-muted"
      >
        <BarChart3 className="h-3.5 w-3.5" />
        {jaTem ? "Editar relatório" : "Anexar relatório do disparo"}
      </button>
    );
  }

  const campos: [string, string, (v: string) => void][] = [
    ["Entregues", entregues, setEntregues],
    ["Lidas", lidas, setLidas],
    ["Respostas", respostas, setRespostas],
    ["Falhas", falhas, setFalhas],
  ];

  return (
    <div className="mt-4 rounded-xl border bg-muted/30 p-4">
      <h4 className="font-display text-sm font-semibold">Relatório do disparo</h4>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Preencha o que você tiver. Campo em branco fica vazio no painel, em vez de virar zero.
      </p>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {campos.map(([label, valor, set]) => (
          <div key={label}>
            <label className="font-subtitle mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {label}
            </label>
            <input
              inputMode="numeric"
              value={valor}
              onChange={(e) => set(e.target.value)}
              placeholder="—"
              className="font-num w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        ))}
      </div>

      <div className="mt-3">
        <label className="font-subtitle mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Observações
        </label>
        <textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          rows={2}
          maxLength={2000}
          placeholder="Ex.: disparo concluído em 3 h, sem bloqueio de número."
          className="w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="mt-3">
        <label className="font-subtitle mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Arquivo do relatório (opcional)
        </label>
        {anexo ? (
          <div className="flex items-center gap-2.5 rounded-lg border bg-background p-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <MediaIcon kind={anexo.kind} className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium">{anexo.nome}</span>
              <span className="font-num block text-[11px] text-muted-foreground">
                {formatarBytes(anexo.tamanho)}
              </span>
            </span>
            <button
              onClick={() => setAnexo(null)}
              className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-destructive"
              aria-label="Remover arquivo"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed bg-background px-3 py-2.5 text-xs transition hover:bg-muted/50">
            <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
            {enviando ? "Enviando…" : "Escolher arquivo (PDF, planilha, imagem)"}
            <input type="file" accept={MEDIA_ACCEPT} onChange={onArquivo} className="sr-only" />
          </label>
        )}
      </div>

      {erro && <p className="mt-2 text-xs font-medium text-destructive">{erro}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={salvar}
          disabled={salvando || enviando}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" />
          {salvando ? "Salvando…" : "Salvar relatório"}
        </button>
        <button
          onClick={() => setAberto(false)}
          disabled={salvando}
          className="rounded-lg border bg-background px-3 py-2 text-xs font-semibold transition hover:bg-muted"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
