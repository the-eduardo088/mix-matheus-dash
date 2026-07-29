/**
 * Editor de PDF — modal para edição/visualização de PDFs.
 *
 * Permite visualizar o PDF e enviar uma versão editada.
 * Após salvar, notifica os admins.
 */
import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { X, Upload, Check, ExternalLink, FilePen } from "lucide-react";

import {
  enviarMidia,
  registrarEdicaoPdf,
  urlDoArquivo,
  MEDIA_SPECS,
  classificarMedia,
  formatarBytes,
  type CampanhaDTO,
  type MidiaCampanha,
} from "@/lib/campanhas";
import { mensagemDeUpload } from "@/lib/erro-upload";

type EditorPdfProps = {
  campanha: CampanhaDTO;
  midia: MidiaCampanha;
  onFechar: () => void;
  onSalvo: () => void;
};

export function EditorPdf({ campanha, midia, onFechar, onSalvo }: EditorPdfProps) {
  const [novoArquivo, setNovoArquivo] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const enviarMutation = useMutation({
    mutationFn: async (form: FormData) => {
      setEnviando(true);
      setErro(null);
      try {
        const novaMidia = await enviarMidia({ data: form });
        await registrarEdicaoPdf({ data: { campanhaId: campanha.id } });
        return novaMidia;
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro ao enviar arquivo.");
        throw e;
      } finally {
        setEnviando(false);
      }
    },
    onSuccess: () => {
      onSalvo();
      onFechar();
    },
  });

  function onArquivoSelecionado(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErro(null);

    const kind = classificarMedia(file.type);
    if (kind !== "documento") {
      setErro("Envie apenas arquivos PDF ou documento.");
      e.target.value = "";
      return;
    }

    setNovoArquivo(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function handleSalvar() {
    if (!novoArquivo) return;

    const form = new FormData();
    form.append("arquivo", novoArquivo);
    enviarMutation.mutate(form);
  }

  function handleRemover() {
    setNovoArquivo(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl bg-card shadow-2xl">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <FilePen className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-display text-lg font-semibold">Editar PDF</h3>
              <p className="text-sm text-muted-foreground">
                {midia.nome} · {formatarBytes(midia.tamanho)}
              </p>
            </div>
          </div>
          <button
            onClick={onFechar}
            className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="flex flex-col lg:flex-row">
          {/* Preview do PDF original */}
          <div className="flex-1 border-r p-4">
            <p className="mb-2 font-subtitle text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              PDF Atual
            </p>
            <iframe
              src={urlDoArquivo(midia.id)}
              className="h-[50vh] w-full rounded-lg border"
              title="PDF atual"
            />
          </div>

          {/* Upload de nova versão */}
          <div className="w-full p-4 lg:w-80">
            <p className="mb-2 font-subtitle text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Nova versão
            </p>

            {novoArquivo ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 rounded-lg border bg-background p-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <FilePen className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{novoArquivo.name}</span>
                    <span className="font-num block text-xs text-muted-foreground">
                      {formatarBytes(novoArquivo.size)}
                    </span>
                  </span>
                </div>

                {previewUrl && (
                  <iframe
                    src={previewUrl}
                    className="h-48 w-full rounded-lg border"
                    title="Preview do novo PDF"
                  />
                )}

                <div className="flex gap-2">
                  <button
                    onClick={handleSalvar}
                    disabled={enviando}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[color:var(--success)] px-3 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                  >
                    {enviando ? (
                      "Enviando…"
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        Salvar e notificar admin
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleRemover}
                    disabled={enviando}
                    className="rounded-lg border bg-background px-3 py-2.5 text-sm font-semibold transition hover:bg-muted"
                  >
                    Remover
                  </button>
                </div>
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed bg-background/50 px-4 py-8 text-center transition hover:bg-muted/50">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-muted">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">Clique para selecionar</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    PDF ou documento (até {formatarBytes(MEDIA_SPECS.documento.maxBytes)})
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                  onChange={onArquivoSelecionado}
                  className="sr-only"
                />
              </label>
            )}

            {/* Link para abrir em nova aba */}
            <a
              href={urlDoArquivo(midia.id)}
              target="_blank"
              rel="noreferrer"
              className="mt-4 flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <ExternalLink className="h-4 w-4" />
              Abrir PDF em nova aba
            </a>

            {erro && (
              <p className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {erro}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
