// =====================================================
// LAYOUT DE FOTOS (REGRA FIXA DA LA FORTE)
// =====================================================
// Única fonte da verdade para como as fotos do relatório fotográfico são
// classificadas por formato, agrupadas em linhas e distribuídas em páginas.
// Usada tanto pelo gerador do Word (gerarRelatorioWord.js) quanto pela
// pré-visualização/impressão em HTML (Medicoes.jsx -> gerarRelatorioFotografico),
// para que as duas saídas sigam exatamente a mesma regra de layout.
//
// Regra fixa de layout: tipos 1/2 são verticais (2 por linha, até 4 por
// página em 2 linhas); tipos 3/4 são horizontais, uma por linha (maiores),
// até 2 por página empilhadas; o tipo 5 é panorâmico, uma por linha, até 3
// por página. Quando um formato acaba antes de completar a página, a página
// é completada com linhas do próximo formato disponível (um orçamento de
// altura decide quantas linhas cabem em cada página, nunca misturando
// formatos numa mesma linha).

export const LARGURA_CONTEUDO_CM = 19.4;
export const ALTURA_PADRAO_CM = 10;

export const FORMATOS = [
  { tipo: 1, proporcao: 8.44 / 15, largura: 8.44, altura: 15 },
  { tipo: 2, proporcao: 10 / 13.29, largura: 10, altura: 13.29 },
  { tipo: 3, proporcao: 10 / 7.53, largura: 10, altura: 7.53 },
  { tipo: 4, proporcao: 10 / 5.62, largura: 10, altura: 5.62 },
  { tipo: 5, proporcao: 1600 / 600, largura: 17.4, altura: 6.525 },
];

export const FOTOS_POR_LINHA = { 1: 2, 2: 2, 3: 1, 4: 1, 5: 1 };
export const ALTURA_LINHA_CM = { 1: 10, 2: 10, 3: 10, 4: 10, 5: 6.525 };
export const ORCAMENTO_ALTURA_PAGINA_CM = 21.5;

export function identificarFormato(largura, altura) {
  if (!largura || !altura) return FORMATOS[1];
  const proporcao = largura / altura;
  return FORMATOS.reduce((maisProximo, formato) =>
    Math.abs(Math.log(proporcao / formato.proporcao)) < Math.abs(Math.log(proporcao / maisProximo.proporcao))
      ? formato
      : maisProximo
  );
}

// Calcula o tamanho de exibição (em cm) de uma foto dentro do seu formato,
// preservando a proporção real da imagem e limitando pela largura/altura
// máximas do formato. Fotos horizontais (3/4) usam toda a largura do
// conteúdo; a panorâmica (5) mantém sua altura própria, menor; as demais
// ficam limitadas à ALTURA_PADRAO_CM. `largura`/`altura` são as dimensões
// reais da imagem (em qualquer unidade — só a proporção entre elas importa);
// quando não disponíveis, usa a proporção padrão do formato.
export function calcularTamanhoCm({ largura, altura, formato }) {
  const proporcao = largura && altura ? largura / altura : formato.proporcao;
  const larguraMaxima = formato.tipo === 3 || formato.tipo === 4 ? LARGURA_CONTEUDO_CM : formato.largura;
  const alturaMaxima = formato.tipo === 5 ? formato.altura : ALTURA_PADRAO_CM;
  const larguraFinal = Math.min(larguraMaxima, alturaMaxima * proporcao);
  const alturaFinal = larguraFinal / proporcao;
  return { largura: larguraFinal, altura: alturaFinal };
}

// Agrupa itens (cada um com um `.formato.tipo`) em linhas: fotos de formatos
// diferentes nunca dividem a mesma linha, e cada linha tem no máximo
// FOTOS_POR_LINHA[tipo] fotos daquele formato.
export function agruparLinhas(itens) {
  const linhas = [];
  let atual = [];
  itens.forEach((item) => {
    const limite = FOTOS_POR_LINHA[item.formato.tipo] || 1;
    const mudouFormato = atual.length > 0 && atual[0].formato.tipo !== item.formato.tipo;
    if (atual.length && (mudouFormato || atual.length >= limite)) {
      linhas.push(atual);
      atual = [];
    }
    atual.push(item);
  });
  if (atual.length) linhas.push(atual);
  return linhas;
}

// Distribui linhas (já agrupadas por agruparLinhas) em páginas, respeitando
// o orçamento de altura por página; cada linha "pesa" a altura do seu
// formato, e uma página recebe linhas (nunca misturando formatos numa mesma
// linha) até o orçamento ser atingido. Quando um formato acaba antes de
// completar a página, o espaço é aproveitado com linhas do próximo formato
// disponível.
export function paginarPorAltura(linhas) {
  const paginas = [];
  let atual = [];
  let alturaAcumulada = 0;
  linhas.forEach((linha) => {
    const alturaLinha = ALTURA_LINHA_CM[linha[0].formato.tipo] || ALTURA_PADRAO_CM;
    if (atual.length && alturaAcumulada + alturaLinha > ORCAMENTO_ALTURA_PAGINA_CM + 0.01) {
      paginas.push(atual);
      atual = [];
      alturaAcumulada = 0;
    }
    atual.push(linha);
    alturaAcumulada += alturaLinha;
  });
  if (atual.length) paginas.push(atual);
  return paginas;
}

// Junta legendas únicas (ignorando repetidas, sem diferenciar maiúsculas de
// minúsculas) no formato "a, b e c", com a primeira letra da 2ª legenda em
// diante em minúscula (a primeira mantém a capitalização original).
export function formatarLegendas(legendas) {
  const unicas = [];
  const chaves = new Set();
  legendas.forEach((bruta) => {
    const texto = String(bruta || "").trim();
    const chave = texto.toLocaleLowerCase("pt-BR").replace(/\s+/g, " ");
    if (texto && !chaves.has(chave)) {
      chaves.add(chave);
      unicas.push(texto);
    }
  });
  const formatadas = unicas.map((texto, indice) =>
    indice === 0 ? texto : texto.charAt(0).toLocaleLowerCase("pt-BR") + texto.slice(1)
  );
  if (formatadas.length < 2) return formatadas[0] || "";
  if (formatadas.length === 2) return `${formatadas[0]} e ${formatadas[1]}`;
  return `${formatadas.slice(0, -1).join(", ")} e ${formatadas[formatadas.length - 1]}`;
}
