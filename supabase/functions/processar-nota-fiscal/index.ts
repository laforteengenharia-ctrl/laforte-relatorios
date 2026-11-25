const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Categorias fixas usadas em Custos (CustosFrente.jsx). Mantenha em sincronia.
const CATEGORIAS_CUSTO = [
  "Alvenaria",
  "Pintura",
  "Serviços Gerais",
  "Hidráulica",
  "Impermeabilização",
  "Madeira",
  "Esquadrias",
  "Serralheria",
  "Móveis",
  "Elétrica",
  "Ferramentas",
  "Segurança/EPI",
  "Combustível",
  "Alimentação",
  "Mão de obra",
  "Aluguel",
  "Impostos",
  "Terceirizados",
  "Outros",
];

const LIMITE_CARACTERES_PDF = 24_000_000; // ~18 MB de PDF em base64.
const LIMITE_ITENS = 80;

function numeroOuNulo(valor: unknown): number | null {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

function textoOuVazio(valor: unknown, limite: number): string {
  return typeof valor === "string" ? valor.trim().slice(0, limite) : "";
}

function aguardar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// O nível gratuito do Gemini volta e meia responde 503 ("sobrecarregado,
// tente novamente") ou 429 (limite momentâneo) — tentamos de novo sozinhos
// algumas vezes antes de devolver erro ao usuário.
async function chamarGeminiComRetentativa(url: string, opcoes: RequestInit, tentativas = 5): Promise<Response> {
  let ultimaResposta: Response | null = null;
  for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
    const resposta = await fetch(url, opcoes);
    if (resposta.status !== 503 && resposta.status !== 429) return resposta;
    ultimaResposta = resposta;
    if (tentativa < tentativas) await aguardar(2000 * tentativa);
  }
  return ultimaResposta as Response;
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return Response.json({ error: "Método não permitido." }, { status: 405, headers: corsHeaders });
  }

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    return Response.json({ error: "A chave GEMINI_API_KEY não foi configurada na Edge Function." }, { status: 500, headers: corsHeaders });
  }

  try {
    const body = await request.json();
    const arquivo = body?.arquivo as { nome?: string; dataUrl?: string } | undefined;

    if (
      !arquivo ||
      typeof arquivo.dataUrl !== "string" ||
      arquivo.dataUrl.length > LIMITE_CARACTERES_PDF ||
      !/^data:application\/pdf;base64,/i.test(arquivo.dataUrl)
    ) {
      return Response.json({ error: "Envie um único arquivo PDF válido (limite de 18 MB)." }, { status: 400, headers: corsHeaders });
    }

    const nomeArquivo = textoOuVazio(arquivo.nome, 120) || "nota-fiscal.pdf";

    const instrucoes = [
      "Você recebeu o PDF de uma nota fiscal (NF-e) brasileira de uma obra de construção civil.",
      "Leia o documento e extraia os dados em JSON estrito, sem comentários, no formato exato:",
      '{"nota":{"numero":"","data":"AAAA-MM-DD","fornecedor":""},"itens":[{"descricao":"","quantidade":0,"unidade":"","valor_unitario":0,"valor_total":0,"categoria_sugerida":""}]}',
      "Regras:",
      "- \"numero\": número da nota fiscal (apenas os dígitos relevantes, sem série se não houver certeza).",
      "- \"data\": data de emissão da nota, no formato AAAA-MM-DD. Se não encontrar, use string vazia.",
      "- \"fornecedor\": nome ou razão social de quem emitiu a nota (o vendedor/prestador), não o destinatário.",
      "- \"itens\": um item para cada produto ou serviço listado na nota (não agrupe itens diferentes).",
      "- \"quantidade\", \"valor_unitario\" e \"valor_total\" devem ser números (use ponto decimal, nunca vírgula, e nunca formate como moeda).",
      "- Se a nota não informar valor unitário mas informar valor total e quantidade, calcule o valor unitário.",
      "- \"unidade\" é a unidade comercial do item (ex.: un, m, m², kg, cx, pç, h). Se não houver, use \"un\".",
      `- "categoria_sugerida" deve ser exatamente uma destas opções, a que melhor combinar com a descrição do item: ${CATEGORIAS_CUSTO.join(", ")}. Se não tiver certeza, use "Outros".`,
      "Não invente itens que não estão na nota. Não inclua texto fora do JSON.",
    ].join("\n");

    // Usamos o Gemini (nível gratuito do Google) em vez da OpenAI para este
    // recurso não gerar custo: o modelo "flash" tem uso gratuito dentro de
    // limites bem acima do volume esperado aqui (algumas notas por semana).
    const dadosBase64 = arquivo.dataUrl.replace(/^data:application\/pdf;base64,/i, "");
    // "gemini-2.5-flash" deixou de estar disponível para novas chaves (erro
    // 404 confirmado em produção em 24/11/2026, orientando usar este modelo).
    const modeloGemini = "gemini-3.8-flash";
    const resposta = await chamarGeminiComRetentativa(
      `https://generativelanguage.googleapis.com/v1beta/models/${modeloGemini}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: instrucoes },
                { inline_data: { mime_type: "application/pdf", data: dadosBase64 } },
              ],
            },
          ],
          generationConfig: {
            response_mime_type: "application/json",
            maxOutputTokens: 8192,
          },
        }),
      },
    );

    const resultado = await resposta.json();
    if (!resposta.ok) {
      const detalhe = String(resultado?.error?.message || "Falha na chamada da API.")
        .replace(new RegExp(apiKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "[chave ocultada]");
      console.error("Gemini invoice request failed:", resposta.status, detalhe);
      if (resposta.status === 503 || resposta.status === 429) {
        return Response.json(
          { error: "O serviço de IA (Gemini, nível gratuito) está temporariamente sobrecarregado. Aguarde um instante e tente novamente." },
          { status: 503, headers: corsHeaders },
        );
      }
      return Response.json({ error: `Gemini (${resposta.status}): ${detalhe}` }, { status: 502, headers: corsHeaders });
    }

    const texto = resultado?.candidates?.[0]?.content?.parts?.[0]?.text;
    let parseado: Record<string, unknown> = {};
    try {
      parseado = JSON.parse(texto || "{}");
    } catch (erroParse) {
      console.error("Falha ao interpretar JSON retornado pelo Gemini:", erroParse, texto);
      return Response.json({ error: "Não foi possível interpretar os dados extraídos da nota. Tente novamente." }, { status: 502, headers: corsHeaders });
    }

    const notaBruta = parseado?.nota as Record<string, unknown> | undefined;
    const nota = {
      numero: textoOuVazio(notaBruta?.numero, 80),
      data: /^\d{4}-\d{2}-\d{2}$/.test(String(notaBruta?.data || "")) ? String(notaBruta?.data) : "",
      fornecedor: textoOuVazio(notaBruta?.fornecedor, 160),
    };

    const itensBrutos = Array.isArray(parseado?.itens) ? parseado.itens : [];
    const itens = itensBrutos
      .slice(0, LIMITE_ITENS)
      .map((itemBruto: Record<string, unknown>) => {
        const descricao = textoOuVazio(itemBruto?.descricao, 160);
        if (!descricao) return null;

        const quantidade = numeroOuNulo(itemBruto?.quantidade) ?? 1;
        let valorUnitario = numeroOuNulo(itemBruto?.valor_unitario);
        let valorTotal = numeroOuNulo(itemBruto?.valor_total);
        if (valorUnitario == null && valorTotal != null && quantidade > 0) valorUnitario = valorTotal / quantidade;
        if (valorTotal == null && valorUnitario != null) valorTotal = valorUnitario * quantidade;
        if (valorUnitario == null || valorTotal == null) return null;

        const categoriaSugerida = CATEGORIAS_CUSTO.includes(String(itemBruto?.categoria_sugerida))
          ? String(itemBruto.categoria_sugerida)
          : "Outros";

        return {
          descricao,
          unidade: textoOuVazio(itemBruto?.unidade, 20) || "un",
          quantidade: quantidade > 0 ? quantidade : 1,
          valor_unitario: Math.round(valorUnitario * 100) / 100,
          valor_total: Math.round(valorTotal * 100) / 100,
          categoria_sugerida: categoriaSugerida,
        };
      })
      .filter(Boolean);

    if (!itens.length) {
      return Response.json({ error: "Não foi possível identificar itens com valores nesta nota fiscal. Confira o arquivo e tente novamente." }, { status: 422, headers: corsHeaders });
    }

    return Response.json({ nota, itens }, { headers: corsHeaders });
  } catch (error) {
    console.error("Invoice function error:", error);
    return Response.json({ error: "Não foi possível processar a nota fiscal enviada." }, { status: 500, headers: corsHeaders });
  }
});
