const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ImageInput = { id: string; nome?: string; dataUrl: string };

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return Response.json({ error: "Método não permitido." }, { status: 405, headers: corsHeaders });
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    return Response.json({ error: "A chave OPENAI_API_KEY não foi configurada na Edge Function." }, { status: 500, headers: corsHeaders });
  }

  try {
    const body = await request.json();
    const imagens = body?.imagens as ImageInput[] | undefined;
    if (!Array.isArray(imagens) || imagens.length < 1 || imagens.length > 4) {
      return Response.json({ error: "Envie de 1 a 4 imagens por chamada." }, { status: 400, headers: corsHeaders });
    }
    for (const imagem of imagens) {
      if (!imagem?.id || typeof imagem.dataUrl !== "string" || imagem.dataUrl.length > 12_000_000 ||
        !/^data:image\/(jpeg|jpg|png|webp|gif);base64,/i.test(imagem.dataUrl)) {
        return Response.json({ error: "Uma das imagens está inválida ou excede o limite aceito." }, { status: 400, headers: corsHeaders });
      }
    }

    const content: Array<Record<string, unknown>> = [{
      type: "text",
      text: "Analise cada imagem de obra e crie uma legenda curta, profissional e factual em português brasileiro, apropriada para relatório fotográfico. Descreva apenas o que for visualmente observável; não invente materiais, local, etapa ou causa. Não inclua o nome do arquivo. Retorne JSON no formato {\"legendas\":[{\"id\":\"id recebido\",\"legenda\":\"texto\"}]}, com exatamente uma legenda para cada id fornecido.",
    }];
    for (const imagem of imagens) {
      content.push({ type: "text", text: `ID da próxima imagem: ${imagem.id}` });
      content.push({ type: "image_url", image_url: { url: imagem.dataUrl, detail: "low" } });
    }

    const resposta = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages: [{ role: "user", content }],
        response_format: { type: "json_object" },
        max_completion_tokens: 600,
      }),
    });
    const resultado = await resposta.json();
    if (!resposta.ok) {
      const detalhe = String(resultado?.error?.message || "Falha na chamada da API.")
        .replace(/sk-[A-Za-z0-9_-]+/g, "[chave ocultada]");
      console.error("OpenAI caption request failed:", resposta.status, detalhe);
      return Response.json({ error: `OpenAI (${resposta.status}): ${detalhe}` }, { status: 502, headers: corsHeaders });
    }

    const texto = resultado?.choices?.[0]?.message?.content;
    const parseado = JSON.parse(texto || "{}");
    const idsPermitidos = new Set(imagens.map((imagem) => imagem.id));
    const legendas = Array.isArray(parseado?.legendas)
      ? parseado.legendas
          .filter((item: { id?: string; legenda?: string }) => idsPermitidos.has(String(item?.id)) && typeof item?.legenda === "string")
          .map((item: { id: string; legenda: string }) => ({ id: String(item.id), legenda: item.legenda.trim().slice(0, 240) }))
      : [];
    return Response.json({ legendas }, { headers: corsHeaders });
  } catch (error) {
    console.error("Caption function error:", error);
    return Response.json({ error: "Não foi possível processar as imagens enviadas." }, { status: 500, headers: corsHeaders });
  }
});
