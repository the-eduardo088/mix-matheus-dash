/**
 * Serviço de IA para analisar nome de arquivo e extrair informações de região/DDD.
 *
 * Usa a API Xiaomi MIMO (compatível com OpenAI) para identificar:
 * - UF (estado)
 * - Região (se disponível no nome)
 * - DDD (baseado no estado)
 *
 * O resultado é usado para pré-preencher informações na mensagem WhatsApp.
 */

const MIMO_API_URL = process.env.MIMO_API_URL ?? "https://token-plan-sgp.xiaomimimo.com/v1";
const MIMO_API_KEY = process.env.MIMO_API_KEY ?? "";
const MIMO_MODEL = "mimo-v2.5-pro";

type ResultadoIA = {
  uf: string | null;
  estado: string | null;
  regiao: string | null;
  ddd: string | null;
  textoFormatado: string | null;
};

/** Prompt do sistema para análise de arquivo */
const SYSTEM_PROMPT = `Você é um assistente que analisa NOMES DE ARQUIVOS de campanhas de marketing para identificar informações geográficas.

IMPORTANTE: Analise CADA PALAVRA do nome do arquivo. Procure por:
1. Siglas de estados: PE, PB, AL, BA, SE, CE, RN, PI, MA
2. Nomes de regiões: Sertão, Agreste, Zona da Mata, Litoral, Cariri, Oeste, Sul, Norte, Centro, Metropolitana
3. Siglas de regiões metropolitanas: RMR, RMJP, RMS, RMF
4. Nomes de cidades que indiquem a região

Mapeamento OBRIGATÓRIO de UFs para DDDs:
- PE = Pernambuco = 81
- PB = Paraíba = 83
- AL = Alagoas = 82
- BA = Bahia = 71
- SE = Sergipe = 79
- CE = Ceará = 85
- RN = Rio Grande do Norte = 84
- PI = Piauí = 86
- MA = Maranhão = 98

Mapeamento de regiões (procure essas PALAVRAS no nome do arquivo):
- "Metropolitana" ou "RMR" ou "RMJP" ou "RMS" ou "RMF" → "Região Metropolitana"
- "Sertão" → "Sertão"
- "Agreste" → "Agreste"
- "Zona da Mata" → "Zona da Mata"
- "Litoral" → "Litoral"
- "Cariri" → "Cariri"

REGRAS RÍGIDAS:
1. O DDD é SEMPRE o principal do estado (não varia por cidade/região)
2. SE encontrar UF no nome, OBRIGATORIAMENTE retorne todos os campos
3. Se encontrar palavra de região (Sertão, Agreste, etc.), OBRIGATORIAMENTE retorne o campo "regiao"
4. NUNCA retorne null para "regiao" se a palavra estiver no nome do arquivo
5. Formato: JSON válido APENAS

EXEMPLOS:
- "2965 PE Sertão" → {"uf":"PE","estado":"Pernambuco","regiao":"Sertão","ddd":"81"}
- "Semanal RMJP Paraíba" → {"uf":"PB","estado":"Paraíba","regiao":"Região Metropolitana","ddd":"83"}
- "Promoção Alagoas Litoral" → {"uf":"AL","estado":"Alagoas","regiao":"Litoral","ddd":"82"}
- "96 Itens BA Cariri" → {"uf":"BA","estado":"Bahia","regiao":"Cariri","ddd":"71"}
- "Lista RN Agreste" → {"uf":"RN","estado":"Rio Grande do Norte","regiao":"Agreste","ddd":"84"}

Responda APENAS com JSON:
{
  "uf": "UF" ou null,
  "estado": "Nome do Estado" ou null,
  "regiao": "Nome da Região" ou null,
  "ddd": "DDD" ou null
}`;

/**
 * Analisa o nome do arquivo usando IA e retorna informações de região/DDD.
 *
 * @param nomeArquivo - Nome do arquivo para analisar (ex: "2965 PE Semanal - 96 Itens.pdf")
 * @returns Informações extraídas ou null se não encontrar
 */
export async function analisarNomeArquivo(nomeArquivo: string): Promise<ResultadoIA> {
  if (!MIMO_API_KEY) {
    console.warn("[IA] MIMO_API_KEY não configurada — ignorando análise de arquivo");
    return { uf: null, estado: null, regiao: null, ddd: null, textoFormatado: null };
  }

  try {
    // Timeout de 25 segundos — a IA pode demorar até isso
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    const resp = await fetch(`${MIMO_API_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MIMO_API_KEY}`,
      },
      body: JSON.stringify({
        model: MIMO_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Analise este nome de arquivo: "${nomeArquivo}"` },
        ],
        temperature: 0.1,
        max_tokens: 200,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!resp.ok) {
      const erro = await resp.text();
      console.error("[IA] Erro na API MIMO:", resp.status, erro);
      return { uf: null, estado: null, regiao: null, ddd: null, textoFormatado: null };
    }

    const dados = await resp.json();
    const conteudo = dados.choices?.[0]?.message?.content;

    if (!conteudo) {
      console.error("[IA] Resposta vazia da API MIMO");
      return { uf: null, estado: null, regiao: null, ddd: null, textoFormatado: null };
    }

    // Extrair JSON da resposta (pode vir com ```json ou texto extra)
    // Primeiro, remover blocos de código markdown se existirem
    let conteudoLimpo = conteudo.replace(/```json\s*/gi, "").replace(/```\s*/g, "");
    
    // Encontrar o JSON na resposta
    const jsonMatch = conteudoLimpo.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[IA] Não foi possível extrair JSON da resposta:", conteudo);
      return { uf: null, estado: null, regiao: null, ddd: null, textoFormatado: null };
    }

    // Tentar fazer parse do JSON
    let resultado: { uf: string | null; estado: string | null; regiao: string | null; ddd: string | null };
    try {
      resultado = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      console.error("[IA] Erro ao fazer parse do JSON:", jsonMatch[0], parseErr);
      return { uf: null, estado: null, regiao: null, ddd: null, textoFormatado: null };
    }

    // Montar texto formatado para usar na mensagem
    let textoFormatado: string | null = null;
    if (resultado.uf && resultado.ddd) {
      const partes: string[] = [];

      if (resultado.regiao) {
        partes.push(resultado.regiao);
      }

      partes.push(`${resultado.estado} - DDD ${resultado.ddd}`);
      textoFormatado = partes.join(", ");
    }

    return {
      uf: resultado.uf ?? null,
      estado: resultado.estado ?? null,
      regiao: resultado.regiao ?? null,
      ddd: resultado.ddd ?? null,
      textoFormatado,
    };
  } catch (err) {
    console.error("[IA] Erro ao analisar nome do arquivo:", err);
    return { uf: null, estado: null, regiao: null, ddd: null, textoFormatado: null };
  }
}
