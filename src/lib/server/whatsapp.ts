/**
 * WhatsApp — envio de notificações para grupo. SOMENTE SERVIDOR.
 *
 * Envia DUAS mensagens automáticas para o grupo:
 * 1. Notificação administrativa (quem criou/editou, status, data)
 * 2. Campanha "limpa" — copy exato + mídia — pronta pra encaminhar
 *
 * Usa a API Uazapi para envio via WhatsApp normal (não Business API).
 * Não usa botões/interactive — apenas texto e mídia simples.
 */

const UAZAPI_BASE = process.env.UAZAPI_BASE_URL ?? "https://free.uazapi.com";
const UAZAPI_TOKEN = process.env.UAZAPI_TOKEN ?? "";
const WHATSAPP_GROUP_ID = process.env.WHATSAPP_GROUP_ID ?? "";

type MediaKind = "imagem" | "video" | "audio" | "documento";

/** Headers padrão para a API Uazapi */
function headers(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    token: UAZAPI_TOKEN,
  };
}

/** Envia mensagem de texto simples para o grupo */
async function enviarTexto(texto: string): Promise<void> {
  if (!UAZAPI_TOKEN || !WHATSAPP_GROUP_ID) {
    console.error("[WhatsApp] Token ou Group ID não configurados");
    return;
  }

  const resp = await fetch(`${UAZAPI_BASE}/send/text`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      number: WHATSAPP_GROUP_ID,
      text: texto,
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    console.error("[WhatsApp] Erro ao enviar texto:", resp.status, body);
  }
}

/** Envia mídia (imagem, vídeo, documento) para o grupo */
async function enviarMidia(
  tipo: "image" | "video" | "document",
  fileUrl: string,
  caption?: string,
  docName?: string,
): Promise<void> {
  if (!UAZAPI_TOKEN || !WHATSAPP_GROUP_ID) {
    console.warn("[WhatsApp] Token ou Group ID não configurados — ignorando envio de mídia");
    return;
  }

  const body: Record<string, string> = {
    number: WHATSAPP_GROUP_ID,
    type: tipo,
    file: fileUrl,
  };

  if (caption) body.text = caption;
  if (docName && tipo === "document") body.docName = docName;

  const resp = await fetch(`${UAZAPI_BASE}/send/media`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const respBody = await resp.text();
    console.error("[WhatsApp] Erro ao enviar mídia:", resp.status, respBody);
  }
}

/** Mapeia kind do banco para tipo da API */
function mapTipoMidia(kind: MediaKind): "image" | "video" | "document" {
  if (kind === "imagem") return "image";
  if (kind === "video") return "video";
  return "document";
}

/** URL pública de download de um arquivo da campanha (sem autenticação) */
function urlArquivoPublico(host: string, arquivoId: string): string {
  return `${host}/pub/${arquivoId}`;
}

/** Formata data para notificação */
function formatarData(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

type CampanhaNotificacao = {
  id: string;
  nome: string;
  agendadaPara: string;
  status: string;
  copy: string;
  criadaPorNome: string;
  midia?: {
    id: string;
    nome: string;
    kind: MediaKind;
    mime: string;
  } | null;
  botaoTexto?: string | null;
  botaoUrl?: string | null;
  cidade?: string | null;
};

/**
 * Envia a campanha "limpa" para o grupo — pronta pra encaminhar.
 *
 * Monta o texto exato da campanha (com formatação WhatsApp) e anexa a mídia.
 * Se tiver botão, inclui o link no final do texto.
 * A mensagem chega como se fosse uma mensagem normal — sem indicar que é automática.
 */
async function enviarCampanhaLimpa(
  campanha: CampanhaNotificacao,
  host: string,
): Promise<void> {
  // Montar texto da campanha exatamente como está
  let textoCampanha = campanha.copy;

  // Se tiver botão de link, adicionar o link no final do texto
  if (campanha.botaoTexto && campanha.botaoUrl) {
    textoCampanha += `\n\n${campanha.botaoTexto}: ${campanha.botaoUrl}`;
  }

  // Se tiver mídia, enviar com a mídia (caption = texto da campanha)
  if (campanha.midia) {
    const url = urlArquivoPublico(host, campanha.midia.id);
    const tipo = mapTipoMidia(campanha.midia.kind);

    await enviarMidia(
      tipo,
      url,
      textoCampanha,
      tipo === "document" ? campanha.midia.nome : undefined,
    );
  } else {
    // Sem mídia — enviar só o texto
    await enviarTexto(textoCampanha);
  }
}

/**
 * Envia notificação de campanha nova para o grupo.
 *
 * 1ª mensagem: Notificação administrativa (quem criou, status, data)
 * 2ª mensagem: Campanha limpa — pronta pra encaminhar
 */
export async function notificarCampanhaNova(
  campanha: CampanhaNotificacao,
  host: string,
): Promise<void> {
  const dataFormatada = formatarData(campanha.agendadaPara);

  // 1ª mensagem: Notificação administrativa
  let notif = `📋 *Campanha Nova*\n\n`;
  notif += `*Nome:* ${campanha.nome}\n`;
  notif += `*Status:* Nova\n`;
  notif += `*Criada por:* ${campanha.criadaPorNome}\n`;
  notif += `*Programada para:* ${dataFormatada}\n`;
  if (campanha.cidade) notif += `*Cidade:* ${campanha.cidade}\n`;

  await enviarTexto(notif);

  // 2ª mensagem: Campanha limpa — pronta pra encaminhar
  await enviarCampanhaLimpa(campanha, host);
}

/**
 * Envia notificação de campanha editada para o grupo.
 *
 * 1ª mensagem: Notificação administrativa (quem editou, status, data)
 * 2ª mensagem: Campanha limpa atualizada — pronta pra encaminhar
 */
export async function notificarCampanhaEditada(
  campanha: CampanhaNotificacao,
  editorNome: string,
  host: string,
): Promise<void> {
  const dataFormatada = formatarData(campanha.agendadaPara);

  // 1ª mensagem: Notificação administrativa
  let notif = `📋 *Campanha Atualizada*\n\n`;
  notif += `*Nome:* ${campanha.nome}\n`;
  notif += `*Status:* Editada\n`;
  notif += `*Editada por:* ${editorNome}\n`;
  notif += `*Programada para:* ${dataFormatada}\n`;
  if (campanha.cidade) notif += `*Cidade:* ${campanha.cidade}\n`;

  await enviarTexto(notif);

  // 2ª mensagem: Campanha limpa atualizada — pronta pra encaminhar
  await enviarCampanhaLimpa(campanha, host);
}
