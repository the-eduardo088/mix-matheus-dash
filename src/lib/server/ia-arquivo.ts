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
const SYSTEM_PROMPT = `Você é um assistente que analisa nomes de arquivos de campanhas de marketing para identificar informações geográficas.

Analise o nome do arquivo fornecido e extraia:
1. UF (sigla do estado, ex: PE, PB, AL, BA, SE, CE, RN, PI, MA)
2. Nome do estado por extenso
3. Região mencionada (se houver)
4. DDD do estado

Mapeamento de UFs para DDDs (use SEMPRE o DDD principal do estado):
- PE (Pernambuco): 81
- PB (Paraíiba): 83
- AL (Alagoas): 82
- BA (Bahia): 71
- SE (Sergipe): 79
- CE (Ceará): 85
- RN (Rio Grande do Norte): 84
- PI (Piauí): 86
- MA (Maranhão): 98

Mapeamento de regiões:
- RMR ou Região Metropolitana do Recife → Região Metropolitana
- RMJP ou Região Metropolitana de João Pessoa → Região Metropolitana
- RMS ou Região Metropolitana de Salvador → Região Metropolitana
- RMF ou Região Metropolitana de Fortaleza → Região Metropolitana
- Sertão, Agreste, Zona da Mata, Litoral, Cariri, Oeste, Sul, Norte, Centro

REGRAS IMPORTANTES:
- O DDD NUNCA varia conforme cidade, região ou mesorregião
- SEMPRE use o DDD principal do estado
- Se não encontrar UF no nome, retorne null para todos os campos
- Formato de resposta: JSON válido

Responda APENAS com JSON no formato:
{
  "uf": "PB" ou null,
  "estado": "Paraíba" ou null,
  "regiao": "Região Metropolitana" ou null,
  "ddd": "83" ou null
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
    });

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
    const jsonMatch = conteudo.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
      console.error("[IA] Não foi possível extrair JSON da resposta:", conteudo);
      return { uf: null, estado: null, regiao: null, ddd: null, textoFormatado: null };
    }

    const resultado = JSON.parse(jsonMatch[0]) as {
      uf: string | null;
      estado: string | null;
      regiao: string | null;
      ddd: string | null;
    };

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
