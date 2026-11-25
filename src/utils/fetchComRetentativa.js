// =====================================================
// FETCH COM RETENTATIVA
// =====================================================
// Wrapper em volta de fetch() que tenta novamente (com espera crescente)
// quando a requisição falha por um problema de rede (conexão instável,
// timeout, etc. — não por uma resposta HTTP de erro, que ainda é
// responsabilidade de quem chama tratar via resposta.ok). Usado em todas as
// chamadas ao Apps Script (proxy do Google Drive), já que esse endpoint é
// acessado o tempo todo em conexões de obra, mais sujeitas a instabilidade.
//
// `tentativas` é o número total de tentativas (não de retentativas): o
// valor padrão de 3 significa até 3 chamadas de fetch antes de desistir.
export async function fetchComRetentativa(url, opcoes = {}, tentativas = 3) {
  let ultimoErro;
  for (let tentativa = 1; tentativa <= tentativas; tentativa += 1) {
    try {
      return await fetch(url, opcoes);
    } catch (erro) {
      ultimoErro = erro;
      if (tentativa < tentativas) {
        await new Promise((resolve) => window.setTimeout(resolve, 500 * tentativa));
      }
    }
  }
  throw new Error(`Falha de comunicação após ${tentativas} tentativas: ${ultimoErro?.message || "rede indisponível"}`);
}
