import { useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  ExternalLink,
  Info,
  MessageSquare,
  Paperclip,
  Send,
  Trash2,
  Users,
  X,
} from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { MediaIcon } from "@/components/campaigns/MediaPreview";
import { BalaoWhatsApp } from "@/components/campaigns/BalaoWhatsApp";
import { exigirSessao } from "@/lib/guards";
import { mensagemDeUpload } from "@/lib/erro-upload";
import { formatNumber, type IndiceBase } from "@/lib/mix-data";
import { carregarIndice } from "@/lib/base";
import {
  ANTECEDENCIA_MINIMA_HORAS,
  BOTAO_TEXTO_MAX,
  COPY_MAX_CHARS,
  MEDIA_ACCEPT,
  MEDIA_SPECS,
  classificarMedia,
  criarCampanha,
  enviarMidia,
  formatarBytes,
  formatarDataHora,
  minimoAgendamento,
  paraInputLocal,
  abaixoDaAntecedencia,
  horasDeAntecedencia,
  temErros,
  validarCampanha,
  type ErrosCampanha,
  type MidiaCampanha,
} from "@/lib/campanhas";

export const Route = createFileRoute("/campanhas")({
  head: () => ({
    meta: [
      { title: "Nova campanha · Mix Mateus" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  beforeLoad: ({ context, location }) => ({
    sessao: exigirSessao(context.sessao, location.href),
  }),
  loader: () => carregarIndice(),
  component: NovaCampanhaPage,
});

function Campo({
  label,
  hint,
  erro,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  erro?: string;
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="font-subtitle mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
      >
        {label}
      </label>
      {children}
      {erro ? (
        <p role="alert" className="mt-1.5 text-xs font-medium text-destructive">
          {erro}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

function NovaCampanhaPage() {
  const { sessao } = Route.useRouteContext();
  const indice = Route.useLoaderData();
  return (
    <AppShell sessao={sessao} meta={indice.meta}>
      <FormularioCampanha indice={indice} />
    </AppShell>
  );
}

function FormularioCampanha({ indice }: { indice: IndiceBase }) {
  const router = useRouter();
  const [minimo] = useState(() => minimoAgendamento());

  const [nome, setNome] = useState("");
  const [scopeId, setScopeId] = useState("");
  const [cidade, setCidade] = useState("");
  const [copy, setCopy] = useState("");
  const [botaoTexto, setBotaoTexto] = useState("");
  const [botaoUrl, setBotaoUrl] = useState("");
  const [midia, setMidia] = useState<MidiaCampanha | null>(null);
  const [enviandoArquivo, setEnviandoArquivo] = useState(false);
  const [agendadaPara, setAgendadaPara] = useState("");
  const [erros, setErros] = useState<ErrosCampanha>({});
  const [erroArquivo, setErroArquivo] = useState<string | null>(null);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [criada, setCriada] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // O alcance vem do índice (leve). O servidor recalcula na hora de gravar —
  // o número enviado pelo cliente nunca é aceito como verdade.
  const recorte = scopeId ? (indice.recortes.find((r) => r.id === scopeId) ?? null) : null;
  const estados = useMemo(() => indice.recortes.filter((s) => s.tipo === "estado"), [indice]);
  const clusters = useMemo(() => indice.recortes.filter((s) => s.tipo === "cluster"), [indice]);

  async function onArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    setErroArquivo(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const kind = classificarMedia(file.type);
    if (!kind) {
      setErroArquivo("Formato não aceito pelo WhatsApp. Veja os tipos suportados acima.");
      e.target.value = "";
      return;
    }

    const spec = MEDIA_SPECS[kind];
    if (file.size > spec.maxBytes) {
      setErroArquivo(
        `${spec.label} de ${formatarBytes(file.size)} — o limite do WhatsApp para ${spec.label.toLowerCase()} é ${formatarBytes(spec.maxBytes)}.`,
      );
      e.target.value = "";
      return;
    }

    setEnviandoArquivo(true);
    try {
      const form = new FormData();
      form.append("arquivo", file);
      setMidia(await enviarMidia({ data: form }));
    } catch (err) {
      setErroArquivo(mensagemDeUpload(err));
    } finally {
      setEnviandoArquivo(false);
    }
  }

  function removerMidia() {
    // O arquivo já subiu; soltar a referência basta. Anexo que nunca chega a
    // virar campanha fica órfão no disco — a faxina disso entra depois.
    setMidia(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErroEnvio(null);

    const entrada = {
      nome: nome.trim(),
      scopeId,
      cidade: cidade.trim() || null,
      copy: copy.trim(),
      botaoTexto: botaoTexto.trim() || null,
      botaoUrl: botaoUrl.trim() || null,
      midiaId: midia?.id ?? null,
      // datetime-local devolve horário local sem fuso; o Date interpreta como
      // local, que é exatamente o que a regra das 24 h espera.
      agendadaPara: agendadaPara ? new Date(agendadaPara).toISOString() : "",
    };

    const v = validarCampanha({
      ...entrada,
      botaoTexto: botaoTexto.trim(),
      botaoUrl: botaoUrl.trim(),
    });
    setErros(v);
    if (temErros(v)) return;

    setSalvando(true);
    try {
      const campanha = await criarCampanha({ data: entrada });
      setCriada(campanha.id);
    } catch (err) {
      setErroEnvio(
        err instanceof Error ? err.message : "Não foi possível salvar a campanha. Tente novamente.",
      );
    } finally {
      setSalvando(false);
    }
  }

  function novaCampanha() {
    setNome("");
    setScopeId("");
    setCidade("");
    setCopy("");
    setBotaoTexto("");
    setBotaoUrl("");
    setMidia(null);
    if (fileRef.current) fileRef.current.value = "";
    setAgendadaPara("");
    setErros({});
    setErroEnvio(null);
    setCriada(null);
    void router.invalidate();
  }

  if (criada) {
    return (
      <section className="rounded-2xl border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[color:var(--success)]/12 text-[color:var(--success)]">
          <Check className="h-7 w-7" />
        </div>
        <h2 className="mt-5 font-display text-2xl font-bold tracking-tight">
          Campanha enviada para aprovação
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Ela já está salva no servidor e aparece em Relatórios com o status{" "}
          <strong className="text-foreground">Aguardando aprovação</strong>. A ATONNS revisa e
          libera o disparo.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link
            to="/relatorios"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
          >
            Ver em Relatórios
          </Link>
          <button
            onClick={novaCampanha}
            className="inline-flex items-center gap-2 rounded-xl border bg-background px-4 py-2.5 text-sm font-semibold shadow-sm transition hover:bg-muted"
          >
            Criar outra campanha
          </button>
        </div>
      </section>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        <p className="font-subtitle text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
          Nova campanha
        </p>
        <h2 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Agendar disparo de WhatsApp
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Escolha a base, escreva a mensagem e defina quando ela deve sair. Depois de enviada, a
          campanha passa por aprovação da ATONNS. O ideal é agendar com{" "}
          <strong className="text-foreground">
            {ANTECEDENCIA_MINIMA_HORAS} horas de antecedência
          </strong>{" "}
          — dá tempo de a Meta aprovar o template e de aquecer os números.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
        {/* ── Coluna do formulário ─────────────────────────────────────── */}
        <div className="space-y-6">
          <ChartCard
            title="Base e identificação"
            subtitle="Qual recorte recebe o disparo"
            icon={<Users className="h-4 w-4" />}
          >
            <div className="space-y-4">
              <Campo label="Nome da campanha" erro={erros.nome} htmlFor="nome">
                <input
                  id="nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex.: Encarte de Julho · Agreste"
                  className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm shadow-sm outline-none transition focus:ring-2 focus:ring-ring"
                />
              </Campo>

              <Campo
                label="Base de disparo"
                erro={erros.scopeId}
                hint="Recortes já segmentados — não é preciso subir lista."
                htmlFor="base"
              >
                <select
                  id="base"
                  value={scopeId}
                  onChange={(e) => {
                    setScopeId(e.target.value);
                    setCidade(""); // a cidade sugerida pertencia ao recorte anterior
                  }}
                  className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm font-medium shadow-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Selecione a base…</option>
                  <optgroup label="Geral">
                    <option value="geral">Base Completa</option>
                  </optgroup>
                  <optgroup label="Estados">
                    {estados.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.rotulo}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Clusters">
                    {clusters.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.rotulo}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </Campo>

              {recorte && (
                <Campo
                  label="Cidade (opcional)"
                  hint="Deixe em branco para disparar no recorte inteiro."
                  htmlFor="cidade"
                >
                  <input
                    id="cidade"
                    list={`cidades-${scopeId}`}
                    value={cidade}
                    onChange={(e) => setCidade(e.target.value)}
                    placeholder="Ex.: Arapiraca"
                    className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm shadow-sm outline-none transition focus:ring-2 focus:ring-ring"
                  />
                  {/* Sugestão, não restrição: a base lista só as 10 maiores de
                      cada recorte, então qualquer cidade digitada vale. */}
                  <datalist id={`cidades-${scopeId}`}>
                    {recorte.cidades.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </Campo>
              )}

              {recorte && (
                <div className="rounded-xl border bg-muted/40 p-4">
                  {cidade.trim() ? (
                    <>
                      <p className="font-subtitle text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Alcance
                      </p>
                      <p className="mt-1 font-display text-lg font-bold leading-tight text-foreground">
                        A definir na segmentação
                      </p>
                      <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                        A ATONNS filtra <strong className="text-foreground">{cidade.trim()}</strong>{" "}
                        dentro de {recorte.rotulo} e o volume real vem no relatório do disparo.
                      </p>
                    </>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="font-subtitle text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Telefones alcançados
                        </p>
                        <p className="mt-1 font-num font-display text-2xl font-bold leading-none text-[color:var(--success)]">
                          {formatNumber(recorte.contatos)}
                        </p>
                      </div>
                      <div>
                        <p className="font-subtitle text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Pessoas únicas
                        </p>
                        <p className="mt-1 font-num font-display text-2xl font-bold leading-none text-[color:var(--color-chart-5)]">
                          {formatNumber(recorte.pessoas)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </ChartCard>

          <ChartCard
            title="Conteúdo da mensagem"
            subtitle="Texto e imagem que vão para o celular"
            icon={<MessageSquare className="h-4 w-4" />}
          >
            <div className="space-y-4">
              <Campo label="Copy" erro={erros.copy} htmlFor="copy">
                <textarea
                  id="copy"
                  value={copy}
                  onChange={(e) => setCopy(e.target.value)}
                  rows={7}
                  maxLength={COPY_MAX_CHARS}
                  placeholder={"Olá! 👋\n\nAs ofertas da semana no Mix Mateus já começaram…"}
                  className="w-full resize-y rounded-xl border bg-background px-4 py-3 text-sm leading-relaxed shadow-sm outline-none transition focus:ring-2 focus:ring-ring"
                />
                <div className="mt-1.5 flex justify-end">
                  <span
                    className={`font-num text-[11px] ${
                      copy.length > COPY_MAX_CHARS * 0.9
                        ? "font-semibold text-[color:var(--warning)]"
                        : "text-muted-foreground"
                    }`}
                  >
                    {copy.length} / {COPY_MAX_CHARS}
                  </span>
                </div>
              </Campo>

              <Campo label="Anexo (opcional)" erro={erroArquivo ?? undefined}>
                {midia ? (
                  <div className="flex items-center gap-3 rounded-xl border bg-background p-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      <MediaIcon kind={midia.kind} className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{midia.nome}</p>
                      <p className="font-num text-xs text-muted-foreground">
                        {MEDIA_SPECS[midia.kind].label} · {formatarBytes(midia.tamanho)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={removerMidia}
                      className="shrink-0 rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-destructive"
                      aria-label="Remover anexo"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <label
                    className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-background px-4 py-7 text-center transition hover:bg-muted/50 ${
                      enviandoArquivo ? "pointer-events-none opacity-60" : ""
                    }`}
                  >
                    <Paperclip className="h-6 w-6 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      {enviandoArquivo ? "Carregando…" : "Escolher arquivo"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Imagem, vídeo, áudio ou documento
                    </span>
                    <input
                      ref={fileRef}
                      type="file"
                      accept={MEDIA_ACCEPT}
                      onChange={onArquivo}
                      className="sr-only"
                    />
                  </label>
                )}

                {/* Limites por tipo, direto da Cloud API — evita descobrir o teto só no erro. */}
                <ul className="mt-2 grid gap-x-4 gap-y-1 text-[11px] text-muted-foreground sm:grid-cols-2">
                  {(Object.keys(MEDIA_SPECS) as (keyof typeof MEDIA_SPECS)[]).map((k) => (
                    <li key={k} className="flex items-center gap-1.5">
                      <MediaIcon kind={k} className="h-3 w-3 shrink-0" />
                      <span className="font-medium text-foreground">{MEDIA_SPECS[k].label}:</span>
                      <span className="truncate">
                        {MEDIA_SPECS[k].extensoes} · até {formatarBytes(MEDIA_SPECS[k].maxBytes)}
                      </span>
                    </li>
                  ))}
                </ul>
              </Campo>
            </div>
          </ChartCard>

          <ChartCard
            title="Botão de link (opcional)"
            subtitle="Um botão clicável abaixo da mensagem — leva a pessoa a um site"
            icon={<ExternalLink className="h-4 w-4" />}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo
                label="Texto do botão"
                hint={`Ex.: Ver ofertas · até ${BOTAO_TEXTO_MAX} caracteres`}
                erro={erros.botaoTexto}
                htmlFor="botao-texto"
              >
                <input
                  id="botao-texto"
                  value={botaoTexto}
                  onChange={(e) => setBotaoTexto(e.target.value)}
                  maxLength={BOTAO_TEXTO_MAX}
                  placeholder="Ver ofertas"
                  className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm shadow-sm outline-none transition focus:ring-2 focus:ring-ring"
                />
              </Campo>
              <Campo
                label="Link do botão"
                hint="Comece com https://"
                erro={erros.botaoUrl}
                htmlFor="botao-url"
              >
                <input
                  id="botao-url"
                  type="url"
                  inputMode="url"
                  value={botaoUrl}
                  onChange={(e) => setBotaoUrl(e.target.value)}
                  placeholder="https://mixmateus.com/ofertas"
                  className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm shadow-sm outline-none transition focus:ring-2 focus:ring-ring"
                />
              </Campo>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Deixe os dois vazios para enviar sem botão. Para usar, preencha os dois.
            </p>
          </ChartCard>

          <ChartCard
            title="Agendamento"
            subtitle={`${ANTECEDENCIA_MINIMA_HORAS} h de antecedência recomendadas`}
            icon={<CalendarClock className="h-4 w-4" />}
          >
            <Campo
              label="Data e hora do disparo"
              erro={erros.agendadaPara}
              hint={`Recomendado a partir de ${formatarDataHora(minimo.toISOString())}`}
              htmlFor="quando"
            >
              {/* Sem `min`: agendar para menos de 24 h é permitido, só avisado. */}
              <input
                id="quando"
                type="datetime-local"
                value={agendadaPara}
                onChange={(e) => setAgendadaPara(e.target.value)}
                className="w-full rounded-xl border bg-background px-4 py-2.5 font-num text-sm shadow-sm outline-none transition focus:ring-2 focus:ring-ring"
              />
            </Campo>

            {agendadaPara && abaixoDaAntecedencia(new Date(agendadaPara).toISOString()) ? (
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-[color:var(--warning)]/40 bg-[color:var(--warning)]/10 p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--warning)]" />
                <p className="text-xs leading-relaxed text-foreground">
                  <strong>
                    Faltam ~{horasDeAntecedencia(new Date(agendadaPara).toISOString())} h para este
                    disparo.
                  </strong>{" "}
                  Abaixo das {ANTECEDENCIA_MINIMA_HORAS} h recomendadas, pode não haver tempo para a
                  Meta aprovar o template e para aquecer os números. Você ainda pode enviar — a
                  ATONNS avalia na aprovação.
                </p>
              </div>
            ) : (
              <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-muted/50 p-3">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  A janela de {ANTECEDENCIA_MINIMA_HORAS} h cobre a aprovação do template pela Meta
                  e o aquecimento dos números. É uma recomendação, não um bloqueio.
                </p>
              </div>
            )}
          </ChartCard>
        </div>

        {/* ── Coluna da prévia (gruda ao rolar) ────────────────────────── */}
        <div className="space-y-4 lg:sticky lg:top-32">
          <ChartCard
            title="Prévia"
            subtitle="Como a mensagem chega no celular"
            icon={<MessageSquare className="h-4 w-4" />}
          >
            <BalaoWhatsApp copy={copy} midia={midia} botaoTexto={botaoTexto} />
          </ChartCard>

          {temErros(erros) && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-destructive/40 bg-destructive/10 p-3"
            >
              <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <p className="text-xs font-medium text-destructive">
                Revise os campos destacados antes de agendar.
              </p>
            </div>
          )}

          {erroEnvio && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-destructive/40 bg-destructive/10 p-3"
            >
              <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <p className="text-xs font-medium text-destructive">{erroEnvio}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={salvando || enviandoArquivo}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            {salvando ? "Enviando…" : "Enviar para aprovação"}
          </button>
        </div>
      </div>
    </form>
  );
}
