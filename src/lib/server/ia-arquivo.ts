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
2. Nomes de cidades
3. Nomes de regiões: Sertão, Agreste, Zona da Mata, Litoral, Cariri, Oeste, Sul, Norte, Centro, Metropolitana
4. Siglas de regiões metropolitanas: RMR, RMJP, RMS, RMF

Mapeamento de UFs para DDDs (use quando NÃO encontrar cidade específica):
- PE = Pernambuco = 81
- PB = Paraíba = 83
- AL = Alagoas = 82
- BA = Bahia = 71
- SE = Sergipe = 79
- CE = Ceará = 85
- RN = Rio Grande do Norte = 84
- PI = Piauí = 86
- MA = Maranhão = 98

Mapeamento de CIDADES para DDDs (use quando encontrar cidade no nome):
PE:
- Recife = 81, Petrolina = 87, Caruaru = 81, Paulista = 81, Olinda = 81, Jaboatão = 81, Cabo = 81, Igarassu = 81, Abreu e Lima = 81, Sirinhaém = 81, Escada = 81, Rio Formoso = 81, Tamandaré = 81, Maragogi = 82,葡属Garanhuns = 87, Palmares = 81, Goiana = 81, Itamaracá = 81, Araçoiaba = 81, Itambé = 81

PB:
- João Pessoa = 83, Campina Grande = 83, Patos = 83, Bayeux = 83, Santa Rita = 83, Cabedelo = 83, Lagoa Seca = 83, Queimadas = 83, Sapé = 83, Alhandra = 83, Cajazeiras = 83, Sousa = 83, Pombal = 83, Itabaiana = 83, Solânea = 83, Esperança = 83, Bananeiras = 83, Montes Claros = 83

AL:
- Maceió = 82, Arapiraca = 82, Palmeira dos Índios = 82, Rio Largo = 82, Penedo = 82, Delmiro Gouveia = 82, São Miguel dos Campos = 82, Marechal Deodoro = 82, Unai dos Palmares = 82, Viçosa = 82, Atalaia = 82, Teotônio Vilela = 82, Capela = 82, Coruripe = 82, Feliz Deserto = 82

BA:
- Salvador = 71, Feira de Santana = 74, Vitória da Conquista = 77, Camaçari = 71, Ilhéus = 73, Itabuna = 73, Juazeiro = 74, Jequié = 73, Barreiras = 77, Porto Seguro = 73, Simões Filho = 71, Lauro de Freitas = 71, Candeias = 71, São Francisco do Conde = 71, Madre de Deus = 71, Alagoinhas = 75, Serrinha = 75, Irecê = 74, Paulo Afonso = 75, Eunápolis = 73, Santa Cruz Cabrália = 73, Teixeira de Freitas = 73, Porto Seguro = 73

SE:
- Aracaju = 79, Nossa Senhora do Socorro = 79, Lagarto = 79, Itabaiana = 79, Estância = 79, Tobias Barreto = 79, Simão Dias = 79, Capela = 79, Boquim = 79, Salgado = 79

CE:
- Fortaleza = 85, Caucaia = 85, Juazeiro do Norte = 88, Maracanaú = 85, Sobral = 88, Crato = 88, Itapipoca = 88, Maranguape = 85, Iguatu = 85, Quixadá = 85, Pacatuba = 85, Aquiraz = 85, Eusébio = 85, Itaitinga = 85, Guaiúba = 85, Pacajus = 85, Horizonte = 85, Acarau = 88, Canindé = 85, Russas = 88, Limoeiro do Norte = 88, Morada Nova = 88, Aracati = 88, Tianguá = 88, Ubajara = 88, Cratéus = 88

RN:
- Natal = 84, Mossoró = 84, Parnamirim = 84, São Gonçalo do Amarante = 84, Macaíba = 84, Canguaretama = 84, Vera Cruz = 84, Santo Antônio = 84, São José de Mipibu = 84, Caicó = 84, Currais Novos = 84, Nova Cruz = 84, Santa Cruz = 84, Touros = 84, Lajes = 84

PI:
- Teresina = 86, Parnaíba = 86, Picos = 86, Piripiri = 86, Floriano = 86, Campo Maior = 86, Barras = 86, União = 86, Altos = 86, José de Freitas = 86, Castelo do Piauí = 86, São Pedro do Piauí = 86, Paulistana = 86, Aroazes = 86

MA:
- São Luís = 98, Imperatriz = 99, São José de Ribamar = 98, Timon = 99, Caxias = 99, Codó = 99, Paço do Lumiar = 98, Bacabal = 99, Balsas = 99, Tutóia = 98, Araioses = 98, Campo Maior = 98, Buriticupu = 99, Santa Inês = 98, Bacabeira = 98, Rosário = 98, Icatu = 98, Morros = 98

Mapeamento de regiões (procure essas PALAVRAS no nome do arquivo):
- "Metropolitana" ou "RMR" ou "RMJP" ou "RMS" ou "RMF" → "Região Metropolitana"
- "Sertão" → "Sertão"
- "Agreste" → "Agreste"
- "Zona da Mata" → "Zona da Mata"
- "Litoral" → "Litoral"
- "Cariri" → "Cariri"

REGRAS RÍGIDAS:
1. PRIMEIRO procure CIDADE no nome. Se encontrar, use o DDD da cidade
2. Se NÃO encontrar cidade, use o DDD principal do estado
3. SE encontrar UF no nome, OBRIGATORIAMENTE retorne todos os campos
4. Se encontrar palavra de região, OBRIGATORIAMENTE retorne o campo "regiao"
5. NUNCA retorne null para "regiao" se a palavra estiver no nome do arquivo
6. Formato: JSON válido APENAS

EXEMPLOS:
- "2965 PE Petrolina" → {"uf":"PE","estado":"Pernambuco","regiao":null,"ddd":"87"}
- "Semanal RMJP Paraíba" → {"uf":"PB","estado":"Paraíba","regiao":"Região Metropolitana","ddd":"83"}
- "Promoção Alagoas Maceió" → {"uf":"AL","estado":"Alagoas","regiao":null,"ddd":"82"}
- "96 Itens BA Cariri" → {"uf":"BA","estado":"Bahia","regiao":"Cariri","ddd":"77"}
- "Lista RN Natal" → {"uf":"RN","estado":"Rio Grande do Norte","regiao":null,"ddd":"84"}
- "PE Sertão Petrolina" → {"uf":"PE","estado":"Pernambuco","regiao":"Sertão","ddd":"87"}
- "BA Feira de Santana" → {"uf":"BA","estado":"Bahia","regiao":null,"ddd":"74"}

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
