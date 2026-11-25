import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../services/supabase";
import { obterTokenDrive } from "../../services/driveAuth";
import { fetchComRetentativa } from "../../utils/fetchComRetentativa";
import { GOOGLE_DRIVE_SCRIPT_URL } from "../../config/googleDriveScript";
import "./CustosFrente.css";
// Precisa acompanhar VERSAO_CUSTOS_IMPORTADOR no Apps Script (.gs): é o que
// confirma que a implantação em uso já tem a versão esperada.
const VERSAO_CUSTOS_IMPORTADOR_ESPERADA = "custos-itens-2026-11-25-r12";

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

function dataLocalHoje() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");
  return ano + "-" + mes + "-" + dia;
}

function formatarMoeda(valor) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(valor) || 0);
}

function interpretarData(data) {
  if (!data) return null;
  if (data instanceof Date) return Number.isNaN(data.getTime()) ? null : data;

  const texto = String(data).trim();
  if (!texto) return null;

  // Datas sem horário são construídas em UTC para não mudar de dia por fuso.
  let partes = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|[T\s])/);
  if (partes) {
    const dataIso = new Date(Date.UTC(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3])));
    if (dataIso.getUTCFullYear() === Number(partes[1]) && dataIso.getUTCMonth() === Number(partes[2]) - 1 && dataIso.getUTCDate() === Number(partes[3])) return dataIso;
    return null;
  }

  partes = texto.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
  if (partes) {
    const dia = Number(partes[1]);
    const mes = Number(partes[2]) - 1;
    const ano = Number(partes[3]);
    const dataBrasileira = new Date(Date.UTC(ano, mes, dia));
    if (dataBrasileira.getUTCFullYear() === ano && dataBrasileira.getUTCMonth() === mes && dataBrasileira.getUTCDate() === dia) return dataBrasileira;
    return null;
  }

  // Aceita, por exemplo, a data textual que o Google Sheets devolve.
  const dataInterpretada = new Date(texto);
  return Number.isNaN(dataInterpretada.getTime()) ? null : dataInterpretada;
}

function formatarData(data) {
  const dataInterpretada = interpretarData(data);
  if (!dataInterpretada) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeZone: "UTC",
  }).format(dataInterpretada);
}

function nomeDoMes(data) {
  const dataInterpretada = interpretarData(data);
  if (!dataInterpretada) return "Sem data";
  const dataMes = new Date(Date.UTC(dataInterpretada.getUTCFullYear(), dataInterpretada.getUTCMonth(), 1));
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(dataMes);
}

function valorLancamento(item) {
  if (item.valor != null) return Number(item.valor) || 0;
  return (Number(item.quantidade) || 1) * (Number(item.valor_unitario) || 0);
}

function formatarPeriodo(medicao) {
  if (!medicao.data_inicio && !medicao.data_fim) return "Período não informado";
  const inicio = medicao.data_inicio ? formatarData(medicao.data_inicio) : "início não informado";
  const fim = medicao.data_fim ? formatarData(medicao.data_fim) : "em andamento";
  return inicio + " a " + fim;
}

function percentual(valorGrupo, itemValor) {
  if (!valorGrupo) return "0,00%";
  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(itemValor / valorGrupo);
}

// ------------------------------------------------------------------
// Gráfico de pizza da distribuição de custos (acompanha a visualização
// ativa: por categoria, por medição ou por mês).
// ------------------------------------------------------------------

// Paleta categórica validada (ordem fixa, nunca ciclada por valor — ver
// scripts/validate_palette.js da skill de dataviz). "Outros" usa um cinza
// neutro fora desta paleta, para nunca ser confundido com uma fatia real.
const CORES_GRAFICO_PIZZA = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];
const COR_OUTROS_GRAFICO_PIZZA = "#898781";
const MAX_FATIAS_GRAFICO_PIZZA = 8;
const RUBRICA_VISUALIZACAO_PIZZA = { categoria: "categoria", medicao: "medição", mes: "mês" };

function corTextoDaFatiaPizza(cor) {
  // Só a fatia amarela (slot 4 da paleta) precisa de texto escuro para ter
  // contraste suficiente; todas as outras usam texto branco.
  return cor === "#eda100" ? "#17140a" : "#fff";
}

// Agrupa os grupos da visualização atual em fatias para o gráfico: mantém as
// maiores e junta o restante em "Outros", para o gráfico nunca ter mais
// fatias do que dá para diferenciar por cor (limite de 8). A cor de cada
// fatia segue a ordem em que o grupo já aparece na visualização (não o
// valor), para uma categoria/medição não trocar de cor só porque o valor
// dela mudou de uma consulta para outra.
//
// Por padrão a lista final (fatias + legenda) fica ordenada da maior para a
// menor — faz sentido em "Por categoria"/"Por frente", onde não existe uma
// ordem natural. Já em "Por mês"/"Por medição" a ordem natural é cronológica
// (o `grupos` recebido já vem nessa ordem), então passar
// `preservarOrdem: true` mantém essa ordem em vez de reordenar por valor.
function montarFatiasPizza(grupos, totalGeral, opcoes = {}) {
  const preservarOrdem = Boolean(opcoes.preservarOrdem);

  const comValor = grupos
    .filter((grupo) => grupo.subtotal > 0)
    .map((grupo, indiceEstavel) => ({ chave: grupo.chave, titulo: grupo.titulo, valor: grupo.subtotal, indiceEstavel }));

  let combinadas;
  if (comValor.length <= MAX_FATIAS_GRAFICO_PIZZA) {
    combinadas = comValor;
  } else {
    const chavesPrincipais = new Set(
      [...comValor].sort((a, b) => b.valor - a.valor).slice(0, MAX_FATIAS_GRAFICO_PIZZA - 1).map((item) => item.chave)
    );
    const resto = comValor.filter((item) => !chavesPrincipais.has(item.chave));
    combinadas = [
      ...comValor.filter((item) => chavesPrincipais.has(item.chave)),
      {
        chave: "outros-grafico-pizza",
        titulo: "Outros (" + resto.length + ")",
        valor: resto.reduce((soma, item) => soma + item.valor, 0),
        indiceEstavel: null,
      },
    ];
  }

  const comCor = combinadas.map((fatia) => ({
    ...fatia,
    cor: fatia.indiceEstavel == null ? COR_OUTROS_GRAFICO_PIZZA : CORES_GRAFICO_PIZZA[fatia.indiceEstavel % CORES_GRAFICO_PIZZA.length],
  }));

  return preservarOrdem ? comCor : comCor.sort((a, b) => b.valor - a.valor);
}

function pontoNoCirculoPizza(centro, raio, anguloGraus) {
  const anguloRad = ((anguloGraus - 90) * Math.PI) / 180;
  return { x: centro + raio * Math.cos(anguloRad), y: centro + raio * Math.sin(anguloRad) };
}

function caminhoDaFatiaPizza(centro, raio, anguloInicial, anguloFinal) {
  // Fatia que ocupa quase 100% do círculo (só um grupo com valor): o traço
  // final some, então desenhamos como dois arcos de 180° para fechar certo.
  if (anguloFinal - anguloInicial >= 359.99) {
    const p1 = pontoNoCirculoPizza(centro, raio, anguloInicial);
    const p2 = pontoNoCirculoPizza(centro, raio, anguloInicial + 180);
    return `M ${p1.x} ${p1.y} A ${raio} ${raio} 0 1 1 ${p2.x} ${p2.y} A ${raio} ${raio} 0 1 1 ${p1.x} ${p1.y} Z`;
  }
  const inicio = pontoNoCirculoPizza(centro, raio, anguloInicial);
  const fim = pontoNoCirculoPizza(centro, raio, anguloFinal);
  const arcoGrande = anguloFinal - anguloInicial > 180 ? 1 : 0;
  return `M ${centro} ${centro} L ${inicio.x} ${inicio.y} A ${raio} ${raio} 0 ${arcoGrande} 1 ${fim.x} ${fim.y} Z`;
}

// Gráfico de pizza com legenda — a tabela de lançamentos logo abaixo, na
// tela, já serve como a "visão em tabela" equivalente para quem prefere (ou
// precisa) ler os números em vez de interpretar cores.
function GraficoPizzaCustos({ fatias, totalGeral, rotuloVisualizacao }) {
  const [fatiaEmFoco, setFatiaEmFoco] = useState(null);
  const centro = 110;
  const raio = 100;

  let anguloAcumulado = 0;
  const fatiasComAngulo = fatias.map((fatia) => {
    const anguloInicial = anguloAcumulado;
    anguloAcumulado += (totalGeral > 0 ? fatia.valor / totalGeral : 0) * 360;
    return { ...fatia, anguloInicial, anguloFinal: anguloAcumulado };
  });

  if (!fatias.length) {
    return <p className="custos-info">Nenhum valor para exibir no gráfico nesta visualização.</p>;
  }

  // Com muitos itens (até 8, já que montarFatiasPizza limita as fatias),
  // a legenda fica mais fácil de ler dividida em colunas em vez de uma
  // lista única bem comprida.
  const colunasLegenda = fatiasComAngulo.length >= 6 ? 2 : 1;
  const linhasPorColuna = Math.ceil(fatiasComAngulo.length / colunasLegenda);

  return (
    <div className="custos-grafico-pizza">
      <svg viewBox="0 0 220 220" role="img" aria-label={"Gráfico de pizza: distribuição dos custos por " + rotuloVisualizacao} className="custos-grafico-pizza-svg">
        {fatiasComAngulo.map((fatia) => {
          const emFoco = fatiaEmFoco === fatia.chave;
          const anguloMeio = (fatia.anguloInicial + fatia.anguloFinal) / 2;
          const participacao = totalGeral > 0 ? fatia.valor / totalGeral : 0;
          const pontoRotulo = pontoNoCirculoPizza(centro, raio * 0.66, anguloMeio);
          return (
            <g key={fatia.chave} onMouseEnter={() => setFatiaEmFoco(fatia.chave)} onMouseLeave={() => setFatiaEmFoco(null)}>
              <path
                d={caminhoDaFatiaPizza(centro, raio, fatia.anguloInicial, fatia.anguloFinal)}
                fill={fatia.cor}
                stroke="#fff"
                strokeWidth={2}
                opacity={fatiaEmFoco && !emFoco ? 0.55 : 1}
              >
                <title>{fatia.titulo + ": " + formatarMoeda(fatia.valor) + " (" + percentual(totalGeral, fatia.valor) + ")"}</title>
              </path>
              {participacao >= 0.06 && (
                <text x={pontoRotulo.x} y={pontoRotulo.y} textAnchor="middle" dominantBaseline="middle" fill={corTextoDaFatiaPizza(fatia.cor)} className="custos-grafico-pizza-rotulo" pointerEvents="none">
                  {percentual(totalGeral, fatia.valor)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <ul
        className="custos-grafico-pizza-legenda"
        style={{
          gridTemplateColumns: `repeat(${colunasLegenda}, minmax(190px, max-content))`,
          gridTemplateRows: `repeat(${linhasPorColuna}, auto)`,
          gridAutoFlow: "column",
        }}
      >
        {fatiasComAngulo.map((fatia) => (
          <li
            key={fatia.chave}
            className={fatiaEmFoco === fatia.chave ? "em-foco" : ""}
            onMouseEnter={() => setFatiaEmFoco(fatia.chave)}
            onMouseLeave={() => setFatiaEmFoco(null)}
          >
            <span className="custos-grafico-pizza-marcador" style={{ background: fatia.cor }} aria-hidden="true" />
            <span className="custos-grafico-pizza-legenda-titulo">{fatia.titulo}</span>
            <span className="custos-grafico-pizza-legenda-valores">{percentual(totalGeral, fatia.valor)} · {formatarMoeda(fatia.valor)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Converte um arquivo (PDF) em data URL base64, para enviar à Edge Function.
function arquivoParaDataUrl(arquivo) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result || ""));
    leitor.onerror = () => reject(new Error("Não foi possível ler o arquivo selecionado."));
    leitor.readAsDataURL(arquivo);
  });
}

function gerarIdLocal() {
  return globalThis.crypto?.randomUUID?.() || (String(Date.now()) + "-" + Math.random().toString(16).slice(2));
}

// Sugestão de categoria por palavra-chave, usada apenas na importação via
// XML (onde não há IA envolvida — é só um ponto de partida; o usuário ainda
// revisa e pode trocar a categoria de cada item antes de lançar).
const PALAVRAS_POR_CATEGORIA = [
  ["Elétrica", ["elétric", "eletric", " fio ", "fio,", "cabo", "disjuntor", "tomada", "interruptor", "lâmpada", "lampada", "eletroduto", "quadro de distribuição", "luminária", "luminaria", "fita isolante", "conduíte", "conduite"]],
  ["Hidráulica", ["hidráulic", "hidraulic", "cano", "tubo", "pvc", "registro", "torneira", "conexão", "conexao", "joelho", "válvula", "valvula", "caixa d'água", "caixa dagua", "sifão", "sifao"]],
  ["Alvenaria", ["tijolo", "bloco", "cimento", "areia", "brita", "argamassa", "concreto", "laje", "rejunte", "cerâmic", "ceramic", "porcelanato", "assentamento"]],
  ["Pintura", ["tinta", "verniz", "massa corrida", "lixa", "rolo de pintura", "pincel", "selador", "massa acrílica", "massa acrilica"]],
  ["Madeira", ["madeira", "compensado", "mdf", "viga", "sarrafo", "tábua", "tabua", "caibro", "ripão", "ripao"]],
  ["Esquadrias", ["esquadria", "porta", "janela", "batente", "marco", "vidro temperado", "esquadria de aluminio", "esquadria de alumínio", "esquadria de ferro", "portal"]],
  ["Serralheria", ["serralheria", "grade", "portão", "portao", "corrimão", "corrimao", "guarda-corpo", "guarda corpo", "solda", "perfil metálico", "perfil metalico", "estrutura metálica", "estrutura metalica"]],
  ["Móveis", ["móveis", "moveis", "armário", "armario", "bancada", "balcão", "balcao", "gabinete", "mobiliário", "mobiliario"]],
  ["Impermeabilização", ["impermeabiliz", "manta asfáltica", "manta asfaltica", "poliuretano", "pu hidroativado", "hidroativado", "silicone", "vedação", "vedacao", "vedante", "primer", "asfáltic", "asfaltic"]],
  ["Ferramentas", ["ferramenta", "furadeira", "parafusadeira", "serra", "esmerilhadeira", "lixadeira", "martelete", "betoneira", "andaime", "locação de equipamento", "locacao de equipamento", "aluguel de equipamento"]],
  ["Segurança/EPI", ["epi", "capacete", "luva", "óculos de proteção", "oculos de protecao", "protetor auricular", "cinto de segurança", "cinto de seguranca", "colete", "botina"]],
  ["Combustível", ["combustível", "combustivel", "gasolina", "diesel", "etanol", "álcool combustível", "posto de gasolina", "abastecimento"]],
  ["Alimentação", ["alimentação", "alimentacao", "refeição", "refeicao", "almoço", "almoco", "marmita", "lanche", "restaurante", "mercado", "supermercado"]],
  ["Mão de obra", ["mão de obra", "mao de obra", "diária", "diaria", "pedreiro", "servente", "instalação", "instalacao", "serviço de", "servico de"]],
  ["Aluguel", ["aluguel", "locação", "locacao"]],
  ["Impostos", ["imposto", "issqn", "icms", "tributo", "taxa municipal"]],
  ["Terceirizados", ["terceirizado", "subempreit"]],
  ["Serviços Gerais", ["limpeza", "caçamba", "cacamba", "frete", "transporte", "descarte"]],
];

function sugerirCategoriaPorDescricao(descricao) {
  const texto = " " + (descricao || "").toLowerCase() + " ";
  for (const [categoria, palavras] of PALAVRAS_POR_CATEGORIA) {
    if (palavras.some((palavra) => texto.includes(palavra))) return categoria;
  }
  return "Outros";
}

// Lê os itens direto do XML da NF-e (nota fiscal eletrônica) — sem IA e sem
// custo nenhum, além de mais preciso que ler o PDF, já que o XML é a fonte
// estruturada original da nota. Segue o layout padrão da NF-e brasileira
// (infNFe > ide/emit/det), sem depender de namespace.
function interpretarNotaFiscalXml(textoXml) {
  const documento = new DOMParser().parseFromString(textoXml, "application/xml");
  if (documento.querySelector("parsererror")) {
    throw new Error("O arquivo XML não pôde ser lido — confira se é o arquivo correto.");
  }

  const infNFe = documento.querySelector("infNFe");
  if (!infNFe) {
    throw new Error("Este XML não parece ser uma nota fiscal eletrônica (NF-e) válida.");
  }

  const textoDe = (seletor) => infNFe.querySelector(seletor)?.textContent?.trim() || "";
  const numero = textoDe("ide > nNF");
  const dataBruta = textoDe("ide > dhEmi") || textoDe("ide > dEmi");
  const data = dataBruta ? dataBruta.slice(0, 10) : "";
  const fornecedor = textoDe("emit > xNome");

  const itens = Array.from(infNFe.querySelectorAll("det"))
    .map((det) => {
      const prod = det.querySelector("prod");
      if (!prod) return null;
      const descricao = prod.querySelector("xProd")?.textContent?.trim() || "";
      if (!descricao) return null;
      const quantidade = Number(prod.querySelector("qCom")?.textContent?.trim() || "0") || 1;
      const valorTotal = Number(prod.querySelector("vProd")?.textContent?.trim() || "0") || 0;
      let valorUnitario = Number(prod.querySelector("vUnCom")?.textContent?.trim() || "0") || 0;
      if (!valorUnitario && valorTotal && quantidade) valorUnitario = valorTotal / quantidade;
      return {
        descricao,
        unidade: prod.querySelector("uCom")?.textContent?.trim() || "un",
        quantidade,
        valor_unitario: Math.round(valorUnitario * 100) / 100,
        categoria_sugerida: sugerirCategoriaPorDescricao(descricao),
      };
    })
    .filter(Boolean);

  if (!itens.length) {
    throw new Error("Não foram encontrados itens de produto neste XML.");
  }

  return { nota: { numero, data, fornecedor }, itens };
}

// Tabela de lançamentos reaproveitada tanto para um grupo "plano" (visão por
// categoria/mês) quanto para cada subgrupo de categoria dentro de uma medição.
function TabelaLancamentos({ itens, mostrarCategoria, baseParaPercentual, onRemover, desabilitarAcoes }) {
  return (
    <div className="custos-tabela-wrap">
      <table className="custos-tabela">
        <thead>
          <tr>
            {mostrarCategoria && <th scope="col">Categoria</th>}
            <th scope="col">Descrição</th>
            <th scope="col">Unidade</th>
            <th scope="col">Quantidade</th>
            <th scope="col">Valor unitário</th>
            <th scope="col">Valor total</th>
            <th scope="col">Local de compra</th>
            <th scope="col">NF-e</th>
            <th scope="col">Data</th>
            <th scope="col">Participação</th>
            <th scope="col"><span className="sr-only">Ação</span></th>
          </tr>
        </thead>
        <tbody>
          {itens.map((item) => {
            const valorItem = valorLancamento(item);
            return (
              <tr key={item.id}>
                {mostrarCategoria && <td data-label="Categoria">{item.categoria || "Sem categoria"}</td>}
                <td data-label="Descrição">{item.descricao}</td>
                <td data-label="Unidade">{item.unidade || "—"}</td>
                <td data-label="Quantidade" className="custos-valor">{item.quantidade ?? 1}</td>
                <td data-label="Valor unitário" className="custos-valor">{formatarMoeda(item.valor_unitario ?? valorItem)}</td>
                <td data-label="Valor total" className="custos-valor">{formatarMoeda(valorItem)}</td>
                <td data-label="Local de compra">{item.local_compra || "—"}</td>
                <td data-label="NF-e">{item.nfe || "—"}</td>
                <td data-label="Data">{formatarData(item.data)}</td>
                <td data-label="Participação" className="custos-valor">{percentual(baseParaPercentual, valorItem)}</td>
                <td data-label="Ação" className="custos-acao-celula">
                  <button type="button" className="custos-remover" onClick={() => onRemover(item.id)} aria-label={"Remover " + item.descricao + " da planilha"} disabled={desabilitarAcoes}>Remover</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Tela de revisão dos itens extraídos de uma nota fiscal em PDF, exibida antes
// de qualquer lançamento ser gravado na planilha (o usuário pode corrigir
// descrição, categoria, quantidade e valor de cada item, ou remover algum).
function RevisaoNotaFiscal({
  nota,
  itens,
  onAlterarItem,
  onRemoverItem,
  onCancelar,
  onConfirmar,
  salvando,
  progresso,
  erro,
}) {
  const total = itens.reduce((soma, item) => soma + (Number(item.quantidade) || 0) * (Number(item.valor_unitario) || 0), 0);

  return (
    <div className="nota-revisao">
      <p className="nota-revisao-resumo">
        {nota?.fornecedor && <>Fornecedor: <strong>{nota.fornecedor}</strong>. </>}
        {nota?.numero && <>NF-e {nota.numero}. </>}
        Confira e ajuste cada item antes de lançar — cada linha abaixo vira um lançamento separado.
      </p>

      <div className="custos-tabela-wrap">
        <table className="custos-tabela nota-revisao-tabela">
          <thead>
            <tr>
              <th scope="col">Descrição</th>
              <th scope="col">Categoria</th>
              <th scope="col">Unidade</th>
              <th scope="col">Quantidade</th>
              <th scope="col">Valor unitário</th>
              <th scope="col">Valor total</th>
              <th scope="col">Data</th>
              <th scope="col"><span className="sr-only">Ação</span></th>
            </tr>
          </thead>
          <tbody>
            {itens.map((item) => {
              const valorTotalItem = (Number(item.quantidade) || 0) * (Number(item.valor_unitario) || 0);
              return (
                <tr key={item.id}>
                  <td data-label="Descrição">
                    <input type="text" value={item.descricao} onChange={(evento) => onAlterarItem(item.id, { descricao: evento.target.value })} maxLength={160} disabled={salvando} />
                  </td>
                  <td data-label="Categoria">
                    <select value={item.categoria} onChange={(evento) => onAlterarItem(item.id, { categoria: evento.target.value })} disabled={salvando}>
                      {CATEGORIAS_CUSTO.map((opcao) => <option key={opcao} value={opcao}>{opcao}</option>)}
                    </select>
                  </td>
                  <td data-label="Unidade">
                    <input type="text" className="nota-revisao-campo-curto" value={item.unidade} onChange={(evento) => onAlterarItem(item.id, { unidade: evento.target.value })} maxLength={20} disabled={salvando} />
                  </td>
                  <td data-label="Quantidade">
                    <input type="number" className="nota-revisao-campo-curto" value={item.quantidade} onChange={(evento) => onAlterarItem(item.id, { quantidade: evento.target.value })} min="0.001" step="any" disabled={salvando} />
                  </td>
                  <td data-label="Valor unitário">
                    <input type="number" className="nota-revisao-campo-curto" value={item.valor_unitario} onChange={(evento) => onAlterarItem(item.id, { valor_unitario: evento.target.value })} min="0" step="0.01" disabled={salvando} />
                  </td>
                  <td data-label="Valor total" className="custos-valor">{formatarMoeda(valorTotalItem)}</td>
                  <td data-label="Data">
                    <input type="date" value={item.data} onChange={(evento) => onAlterarItem(item.id, { data: evento.target.value })} disabled={salvando} />
                  </td>
                  <td data-label="Ação" className="custos-acao-celula">
                    <button type="button" className="custos-remover" onClick={() => onRemoverItem(item.id)} disabled={salvando} aria-label={"Remover item " + item.descricao + " da importação"}>Remover</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!itens.length && <p className="custos-info">Todos os itens foram removidos da importação.</p>}

      <p className="nota-revisao-total">Total a lançar: <strong>{formatarMoeda(total)}</strong> ({itens.length} {itens.length === 1 ? "item" : "itens"})</p>

      {erro && <p className="custos-erro" role="alert">{erro}</p>}
      {salvando && progresso && <p className="custos-info">{progresso}</p>}

      <div className="nota-revisao-acoes">
        <button type="button" className="custos-voltar" onClick={onCancelar} disabled={salvando}>Cancelar</button>
        <button type="button" className="custos-adicionar" onClick={onConfirmar} disabled={salvando || !itens.length}>
          {salvando ? "Lançando itens..." : "Confirmar e lançar " + itens.length + (itens.length === 1 ? " item" : " itens")}
        </button>
      </div>
    </div>
  );
}

export default function CustosFrente({
  contratoSelecionado,
  frenteSelecionada,
  lancamentos = [],
  atualizarLancamentos,
  voltar,
}) {
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("");
  const [unidade, setUnidade] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [valorUnitario, setValorUnitario] = useState("");
  const [localCompra, setLocalCompra] = useState("");
  const [nfe, setNfe] = useState("");
  const [data, setData] = useState(dataLocalHoje);
  const [erro, setErro] = useState("");
  const [visualizacao, setVisualizacao] = useState("categoria");
  const [medicoes, setMedicoes] = useState([]);
  const [carregandoMedicoes, setCarregandoMedicoes] = useState(false);
  const [erroMedicoes, setErroMedicoes] = useState("");
  const [carregandoCustos, setCarregandoCustos] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [erroSincronizacao, setErroSincronizacao] = useState("");
  const [ultimaSincronizacao, setUltimaSincronizacao] = useState("");
  const [urlExcel, setUrlExcel] = useState("");
  const [mensagemImportacao, setMensagemImportacao] = useState("");
  const [versaoImportador, setVersaoImportador] = useState("");
  const [salvandoCusto, setSalvandoCusto] = useState(false);
  // Por padrão, todo grupo/subgrupo começa minimizado — só abre quando o
  // usuário clica nele (aqui guardamos as chaves dos que foram abertos).
  const [gruposAbertos, setGruposAbertos] = useState(() => new Set());

  // Importação de nota fiscal em PDF.
  const [processandoNota, setProcessandoNota] = useState(false);
  const [erroNota, setErroNota] = useState("");
  const [notaExtraida, setNotaExtraida] = useState(null);
  const [itensRevisao, setItensRevisao] = useState([]);
  const [revisaoAberta, setRevisaoAberta] = useState(false);
  const [salvandoRevisao, setSalvandoRevisao] = useState(false);
  const [progressoRevisao, setProgressoRevisao] = useState("");
  const [erroRevisao, setErroRevisao] = useState("");

  // Cadastro de funcionários/empreiteiros (tela Configurações) — usado para
  // preencher sozinho o lançamento de "Mão de obra" a partir do custo/dia já
  // cadastrado, em vez de digitar tudo na mão.
  const [funcionarios, setFuncionarios] = useState([]);
  const [empreiteiros, setEmpreiteiros] = useState([]);
  // Vários funcionários/empreiteiros podem ser selecionados de uma vez (ex.:
  // "funcionario:12", "empreiteiro:5") para lançar um dia de cada um em
  // sequência, sem precisar repetir o formulário pessoa por pessoa.
  const [pessoasMaoDeObraSelecionadas, setPessoasMaoDeObraSelecionadas] = useState([]);
  const [tipoDiaMaoDeObra, setTipoDiaMaoDeObra] = useState("util"); // "util" | "sabado" | "feriado"
  const [progressoMaoDeObra, setProgressoMaoDeObra] = useState("");

  function alternarAberto(chave) {
    setGruposAbertos((anterior) => {
      const novo = new Set(anterior);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      return novo;
    });
  }

  // Carrega a lista de funcionários/empreiteiros ativos uma única vez (não
  // depende da frente). Se as tabelas ainda não existirem no Supabase, falha
  // em silêncio (console) e o seletor em "Mão de obra" simplesmente não
  // aparece — não quebra o resto da tela.
  useEffect(() => {
    let componenteAtivo = true;
    async function carregarPessoas() {
      try {
        const [respostaFuncionarios, respostaEmpreiteiros] = await Promise.all([
          supabase.from("funcionarios").select("id,nome,funcao,custo_empresa").eq("ativo", true).order("nome", { ascending: true }),
          supabase.from("empreiteiros").select("id,nome,funcao,valor_diarista").eq("ativo", true).order("nome", { ascending: true }),
        ]);
        if (!componenteAtivo) return;
        setFuncionarios(respostaFuncionarios.data || []);
        setEmpreiteiros(respostaEmpreiteiros.data || []);
      } catch (erroConsulta) {
        console.error("Não foi possível carregar funcionários/empreiteiros:", erroConsulta);
      }
    }
    carregarPessoas();
    return () => {
      componenteAtivo = false;
    };
  }, []);

  useEffect(() => {
    let componenteAtivo = true;

    async function carregarMedicoesDaFrente() {
      if (!contratoSelecionado?.id || !frenteSelecionada?.id) {
        setMedicoes([]);
        return;
      }

      setCarregandoMedicoes(true);
      setErroMedicoes("");

      try {
        const { data: vinculos, error: erroVinculos } = await supabase
          .from("medicao_frentes")
          .select("medicao_id")
          .eq("frente_id", Number(frenteSelecionada.id));

        if (erroVinculos) throw erroVinculos;

        const idsMedicoes = [...new Set((vinculos || []).map((item) => Number(item.medicao_id)))];
        if (!idsMedicoes.length) {
          if (componenteAtivo) setMedicoes([]);
          return;
        }

        const { data: dadosMedicoes, error: erroDados } = await supabase
          .from("medicoes")
          .select("id,numero,data_inicio,data_fim")
          .eq("contrato_id", Number(contratoSelecionado.id))
          .in("id", idsMedicoes)
          .order("numero", { ascending: true });

        if (erroDados) throw erroDados;
        if (componenteAtivo) setMedicoes(dadosMedicoes || []);
      } catch (erroConsulta) {
        console.error("Não foi possível carregar as medições da frente:", erroConsulta);
        if (componenteAtivo) {
          setMedicoes([]);
          setErroMedicoes("Não foi possível consultar as datas das medições.");
        }
      } finally {
        if (componenteAtivo) setCarregandoMedicoes(false);
      }
    }

    carregarMedicoesDaFrente();
    return () => {
      componenteAtivo = false;
    };
  }, [contratoSelecionado?.id, frenteSelecionada?.id]);

  async function consultarPlanilha(acao) {
    const token = await obterTokenDrive();
    const parametros = new URLSearchParams({
      acao: acao || "listar_custos",
      drive_pasta_id: String(frenteSelecionada?.drive_pasta_id || ""),
      contrato_numero: String(contratoSelecionado?.numero || ""),
      frente_nome: String(frenteSelecionada?.nome || ""),
      token,
    });
    const respostaHttp = await fetchComRetentativa(GOOGLE_DRIVE_SCRIPT_URL + "?" + parametros.toString());
    const resultado = await respostaHttp.json();
    setVersaoImportador(resultado?.versao_importador || "desatualizado");
    if (!respostaHttp.ok || !resultado?.ok) {
      throw new Error(
        resultado?.erro_auth
          ? "Sua sessão expirou. Faça login novamente para continuar."
          : resultado?.erro || "Não foi possível consultar a planilha no Drive."
      );
    }
    return resultado;
  }

  async function enviarAcaoPlanilha(payload) {
    const token = await obterTokenDrive();
    const respostaHttp = await fetchComRetentativa(GOOGLE_DRIVE_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ ...payload, token }),
    });
    const resultado = await respostaHttp.json();
    if (!respostaHttp.ok || !resultado?.ok) {
      const erroResposta = new Error(
        resultado?.erro_auth
          ? "Sua sessão expirou. Faça login novamente para continuar."
          : resultado?.erro || "O Drive não confirmou a gravação do custo."
      );
      erroResposta.gravadoNaPlanilha = Boolean(resultado?.gravado_na_planilha);
      erroResposta.lancamentos = resultado?.lancamentos;
      throw erroResposta;
    }
    return resultado;
  }

  async function carregarCustosDaPlanilha(acao, mostrarProgresso = true) {
    if (mostrarProgresso) setSincronizando(true);
    setErroSincronizacao("");
    try {
      const resultado = await consultarPlanilha(acao);
      atualizarLancamentos(Array.isArray(resultado.lancamentos) ? resultado.lancamentos : []);
      setUltimaSincronizacao(new Date().toLocaleString("pt-BR"));
      setUrlExcel(resultado.excel_url || "");
      setMensagemImportacao(resultado.importados ? resultado.importados + " lançamentos importados do Excel existente." : "");
      return resultado;
    } catch (erro) {
      console.error("Falha ao sincronizar custos com o Drive:", erro);
      setErroSincronizacao(erro.message || "Não foi possível sincronizar os custos.");
      throw erro;
    } finally {
      if (mostrarProgresso) setSincronizando(false);
      setCarregandoCustos(false);
    }
  }

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      setCarregandoCustos(true);
      setErroSincronizacao("");
      try {
        const resultado = await consultarPlanilha("listar_custos");
        if (!ativo) return;
        atualizarLancamentos(Array.isArray(resultado.lancamentos) ? resultado.lancamentos : []);
        setUltimaSincronizacao(new Date().toLocaleString("pt-BR"));
      setUrlExcel(resultado.excel_url || "");
      setMensagemImportacao(resultado.importados ? resultado.importados + " lançamentos importados do Excel existente." : "");
      } catch (erro) {
        console.error("Falha ao carregar custos do Drive:", erro);
        if (ativo) setErroSincronizacao(erro.message || "Não foi possível carregar os custos do Drive.");
      } finally {
        if (ativo) setCarregandoCustos(false);
      }
    }
    if (frenteSelecionada?.drive_pasta_id) carregar();
    else {
      setErroSincronizacao("Esta frente não tem uma pasta Fotos do Google Drive vinculada.");
      setCarregandoCustos(false);
    }
    return () => { ativo = false; };
  }, [contratoSelecionado?.numero, frenteSelecionada?.id, frenteSelecionada?.drive_pasta_id]);
  const valorCalculado = (Number(quantidade) || 0) * (Number(valorUnitario) || 0);

  const total = useMemo(
    () => lancamentos.reduce((soma, item) => soma + valorLancamento(item), 0),
    [lancamentos]
  );

  const grupos = useMemo(() => {
    const mapa = new Map();
    const criarGrupo = (chave, titulo, detalhe = "") => {
      if (!mapa.has(chave)) mapa.set(chave, { chave, titulo, detalhe, itens: [] });
      return mapa.get(chave);
    };

    if (visualizacao === "categoria") {
      lancamentos.forEach((item) => {
        const nomeCategoria = item.categoria || "Sem categoria";
        criarGrupo("categoria:" + nomeCategoria, nomeCategoria).itens.push(item);
      });
    } else if (visualizacao === "mes") {
      // A data de cada lançamento pode vir em formatos diferentes (ISO de
      // quem lança pelo app, ou "DD/MM/AAAA" — às vezes sem zero à esquerda
      // no dia — de quem veio importado da planilha). Usar interpretarData()
      // para montar a chave do mês evita que a mesma "novembro de 2026", por
      // exemplo, vire grupos separados só por causa do formato do texto.
      lancamentos.forEach((item) => {
        const dataInterpretada = interpretarData(item.data);
        const chaveMes = dataInterpretada
          ? dataInterpretada.getUTCFullYear() + "-" + String(dataInterpretada.getUTCMonth() + 1).padStart(2, "0")
          : "sem-data";
        criarGrupo("mes:" + chaveMes, nomeDoMes(item.data)).itens.push(item);
      });
    } else {
      const hoje = dataLocalHoje();
      medicoes.forEach((medicao) => {
        const numero = String(medicao.numero || "").padStart(2, "0");
        criarGrupo(
          "medicao:" + medicao.id,
          "Medição " + numero,
          formatarPeriodo(medicao)
        );
      });

      lancamentos.forEach((item) => {
        const medicaoImportada = item.medicao_numero
          ? medicoes.find((medicao) => Number(medicao.numero) === Number(item.medicao_numero))
          : null;
        if (medicaoImportada) {
          criarGrupo(
            "medicao:" + medicaoImportada.id,
            "Medição " + String(medicaoImportada.numero || "").padStart(2, "0"),
            formatarPeriodo(medicaoImportada)
          ).itens.push(item);
          return;
        }
        const candidatas = medicoes
          .filter((medicao) => {
            if (!item.data || !medicao.data_inicio || item.data < medicao.data_inicio) return false;
            const dataFim = medicao.data_fim || hoje;
            return item.data <= dataFim;
          })
          .sort((a, b) => String(b.data_inicio).localeCompare(String(a.data_inicio)));

        if (candidatas.length) {
          const medicao = candidatas[0];
          criarGrupo(
            "medicao:" + medicao.id,
            "Medição " + String(medicao.numero || "").padStart(2, "0"),
            formatarPeriodo(medicao)
          ).itens.push(item);
        } else {
          criarGrupo("sem-medicao", "Fora do período de medição", "Despesas sem data dentro de um período cadastrado").itens.push(item);
        }
      });
    }

    let resultado = Array.from(mapa.values()).map((grupo) => ({
      ...grupo,
      subtotal: grupo.itens.reduce((soma, item) => soma + valorLancamento(item), 0),
    }));

    // Nas visões "Por medição" e "Por mês", cada grupo é dividido em
    // subgrupos por categoria, em vez de uma única tabela com a categoria
    // só como coluna.
    if (visualizacao === "medicao" || visualizacao === "mes") {
      resultado = resultado.map((grupo) => {
        const mapaCategorias = new Map();
        grupo.itens.forEach((item) => {
          const nomeCategoria = item.categoria || "Sem categoria";
          if (!mapaCategorias.has(nomeCategoria)) {
            mapaCategorias.set(nomeCategoria, { categoria: nomeCategoria, itens: [] });
          }
          mapaCategorias.get(nomeCategoria).itens.push(item);
        });

        const subgrupos = Array.from(mapaCategorias.values())
          .map((subgrupo) => ({
            ...subgrupo,
            subtotal: subgrupo.itens.reduce((soma, item) => soma + valorLancamento(item), 0),
          }))
          .sort((a, b) => {
            if (a.categoria === "Sem categoria") return 1;
            if (b.categoria === "Sem categoria") return -1;
            return a.categoria.localeCompare(b.categoria, "pt-BR");
          });

        return { ...grupo, subgrupos };
      });
    }

    if (visualizacao === "categoria") {
      resultado.sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR"));
    } else if (visualizacao === "mes") {
      resultado.sort((a, b) => a.chave.localeCompare(b.chave));
    } else {
      resultado.sort((a, b) => {
        if (a.chave === "sem-medicao") return 1;
        if (b.chave === "sem-medicao") return -1;
        const medicaoA = medicoes.find((item) => "medicao:" + item.id === a.chave);
        const medicaoB = medicoes.find((item) => "medicao:" + item.id === b.chave);
        return Number(medicaoA?.numero || 0) - Number(medicaoB?.numero || 0);
      });
    }

    return resultado;
  }, [lancamentos, visualizacao, medicoes]);

  // Fatias do gráfico de pizza — acompanham a visualização ativa (os mesmos
  // grupos já calculados acima para a lista de categoria/medição/mês). Em
  // "Por medição"/"Por mês" a ordem cronológica dos grupos é preservada em
  // vez de reordenar por valor (ver montarFatiasPizza).
  const fatiasPizza = useMemo(
    () => montarFatiasPizza(grupos, total, { preservarOrdem: visualizacao !== "categoria" }),
    [grupos, total, visualizacao]
  );

  // Monta o objeto de lançamento completo (com vínculo de medição pela data)
  // a partir dos campos básicos — usado tanto pelo formulário manual quanto
  // pela importação de nota fiscal.
  function montarLancamento(dadosBase) {
    const hoje = dataLocalHoje();
    const dataLancamento = dadosBase.data || hoje;
    const medicaoAssociada = medicoes
      .filter((item) => item.data_inicio && dataLancamento >= item.data_inicio && dataLancamento <= (item.data_fim || hoje))
      .sort((a, b) => String(b.data_inicio).localeCompare(String(a.data_inicio)))[0];

    return {
      id: gerarIdLocal(),
      descricao: dadosBase.descricao,
      categoria: dadosBase.categoria,
      unidade: dadosBase.unidade,
      quantidade: dadosBase.quantidade,
      valor_unitario: dadosBase.valor_unitario,
      valor: dadosBase.quantidade * dadosBase.valor_unitario,
      local_compra: dadosBase.local_compra || "",
      nfe: dadosBase.nfe || "",
      data: dataLancamento,
      medicao_numero: medicaoAssociada ? Number(medicaoAssociada.numero) : null,
      medicao_inicio: medicaoAssociada?.data_inicio || "",
      medicao_fim: medicaoAssociada?.data_fim || "",
    };
  }

  // Envia um lançamento já montado para a planilha e atualiza os estados de
  // sincronização. Lança o erro adiante para quem chamou decidir o que fazer
  // (o formulário manual e a importação de nota tratam erro parcial de
  // formas diferentes).
  async function salvarLancamentoNaPlanilha(lancamento) {
    const resultado = await enviarAcaoPlanilha({
      acao: "salvar_custo",
      drive_pasta_id: String(frenteSelecionada.drive_pasta_id),
      contrato_numero: String(contratoSelecionado.numero),
      frente_nome: String(frenteSelecionada.nome),
      medicao_numero: lancamento.medicao_numero,
      medicao_inicio: lancamento.medicao_inicio,
      medicao_fim: lancamento.medicao_fim,
      lancamento,
    });
    atualizarLancamentos(Array.isArray(resultado.lancamentos) ? resultado.lancamentos : [...lancamentos, lancamento]);
    setUltimaSincronizacao(new Date().toLocaleString("pt-BR"));
    setUrlExcel(resultado.excel_url || "");
    setMensagemImportacao(resultado.importados ? resultado.importados + " lançamentos importados do Excel existente." : "");
    return resultado;
  }

  // Acha a pessoa (funcionário ou empreiteiro) a partir do valor do seletor
  // ("funcionario:12" ou "empreiteiro:5").
  function encontrarPessoaMaoDeObra(valorSelecionado) {
    if (!valorSelecionado) return null;
    const [tipo, idTexto] = valorSelecionado.split(":");
    const id = Number(idTexto);
    if (tipo === "funcionario") return { tipo, pessoa: funcionarios.find((item) => item.id === id) };
    if (tipo === "empreiteiro") return { tipo, pessoa: empreiteiros.find((item) => item.id === id) };
    return null;
  }

  // Valor normal do dia (custo por dia útil do funcionário, ou a diária
  // cadastrada do empreiteiro) — sem o dobro de sábado/feriado.
  function valorDiaPessoa(tipo, pessoa) {
    if (!pessoa) return null;
    if (tipo === "funcionario") {
      const custoEmpresa = Number(pessoa.custo_empresa);
      return custoEmpresa > 0 ? custoEmpresa / 22 : null;
    }
    const diaria = Number(pessoa.valor_diarista);
    return diaria > 0 ? diaria : null;
  }

  // Sufixo da descrição e multiplicador do valor do dia, de acordo com o tipo
  // de dia escolhido (dia útil = valor normal; sábado/feriado = dobro).
  function sufixoTipoDia(tipo) {
    if (tipo === "sabado") return " (sábado)";
    if (tipo === "feriado") return " (feriado)";
    return "";
  }

  function multiplicadorTipoDia(tipo) {
    return tipo === "sabado" || tipo === "feriado" ? 2 : 1;
  }

  // Valor final do dia de uma pessoa já considerando o tipo de dia escolhido
  // (dia útil, sábado ou feriado).
  function valorComTipoDia(tipo, pessoa, tipoDia) {
    const valorBase = valorDiaPessoa(tipo, pessoa);
    if (valorBase == null) return null;
    return Math.round(valorBase * multiplicadorTipoDia(tipoDia) * 100) / 100;
  }

  // Marca/desmarca uma pessoa na lista de selecionados para "Mão de obra"
  // (permite escolher vários funcionários/empreiteiros de uma vez).
  function alternarPessoaMaoDeObra(chave, marcado) {
    setPessoasMaoDeObraSelecionadas((atuais) =>
      marcado ? [...atuais, chave] : atuais.filter((item) => item !== chave)
    );
  }

  // Lança um dia de cada funcionário/empreiteiro selecionado, um de cada vez
  // (mesma lógica de resiliência usada na importação de nota fiscal): se um
  // lançamento falhar no meio do caminho, os já lançados saem da seleção e os
  // restantes continuam selecionados, para tentar de novo sem repetir tudo.
  async function adicionarLancamentoMaoDeObra() {
    if (!data) {
      setErro("Preencha a data do lançamento.");
      return;
    }

    const itens = [];
    const semCusto = [];
    for (const chave of pessoasMaoDeObraSelecionadas) {
      const encontrada = encontrarPessoaMaoDeObra(chave);
      if (!encontrada?.pessoa) continue;
      const { tipo, pessoa } = encontrada;
      const valorUnitarioPessoa = valorComTipoDia(tipo, pessoa, tipoDiaMaoDeObra);
      if (valorUnitarioPessoa == null) {
        semCusto.push(pessoa.nome);
        continue;
      }
      itens.push({
        chave,
        descricao: pessoa.nome + (pessoa.funcao ? " — " + pessoa.funcao : "") + sufixoTipoDia(tipoDiaMaoDeObra),
        categoria,
        unidade: "dia",
        quantidade: 1,
        valor_unitario: valorUnitarioPessoa,
        local_compra: localCompra.trim(),
        nfe: nfe.trim(),
        data,
      });
    }

    if (itens.length === 0) {
      setErro(
        semCusto.length
          ? "Sem custo/diária cadastrado para: " + semCusto.join(", ") + ". Confira o cadastro em Configurações."
          : "Selecione ao menos um funcionário ou empreiteiro."
      );
      return;
    }

    setErro("");
    setSalvandoCusto(true);
    const restantes = [...itens];
    let lancados = 0;
    try {
      while (restantes.length) {
        const item = restantes[0];
        setProgressoMaoDeObra("Lançando " + (lancados + 1) + " de " + itens.length + ": " + item.descricao);
        const { chave, ...dadosItem } = item;
        const novoLancamento = montarLancamento(dadosItem);
        await salvarLancamentoNaPlanilha(novoLancamento);
        restantes.shift();
        lancados += 1;
        setPessoasMaoDeObraSelecionadas(restantes.map((pendente) => pendente.chave));
      }
      setProgressoMaoDeObra("");
      setLocalCompra("");
      setNfe("");
      setData(dataLocalHoje());
      setErroSincronizacao("");
      setErro(
        semCusto.length
          ? "Lançado(s) " + lancados + " de " + itens.length + ". Sem custo cadastrado, não foi possível lançar: " + semCusto.join(", ") + "."
          : ""
      );
    } catch (erroGravacao) {
      setProgressoMaoDeObra("");
      setPessoasMaoDeObraSelecionadas(restantes.map((pendente) => pendente.chave));
      if (erroGravacao.gravadoNaPlanilha) {
        atualizarLancamentos(Array.isArray(erroGravacao.lancamentos) ? erroGravacao.lancamentos : lancamentos);
        setErroSincronizacao(
          erroGravacao.message + " Clique em ‘Sincronizar com Excel’. " +
          (lancados ? lancados + " de " + itens.length + " já foram lançados; " : "") +
          "o restante continua selecionado — tente lançar de novo."
        );
      } else {
        setErro(
          (lancados ? lancados + " de " + itens.length + " já foram lançados. " : "") +
          "O restante não foi confirmado no Drive: " + (erroGravacao.message || "") + " Continuam selecionados — tente novamente."
        );
      }
    } finally {
      setSalvandoCusto(false);
    }
  }

  async function adicionarLancamento(evento) {
    evento.preventDefault();
    setErro("");

    if (categoria === "Mão de obra" && pessoasMaoDeObraSelecionadas.length > 0) {
      await adicionarLancamentoMaoDeObra();
      return;
    }

    const descricaoLimpa = descricao.trim();
    const unidadeLimpa = unidade.trim();
    const quantidadeNumerica = Number(quantidade);
    const valorUnitarioNumerico = Number(valorUnitario);

    if (!descricaoLimpa || !categoria || !unidadeLimpa || !data || !Number.isFinite(quantidadeNumerica) || quantidadeNumerica <= 0 || !Number.isFinite(valorUnitarioNumerico) || valorUnitarioNumerico <= 0) {
      setErro("Preencha descrição, categoria, unidade, quantidade, valor unitário e data.");
      return;
    }

    const novoLancamento = montarLancamento({
      descricao: descricaoLimpa,
      categoria,
      unidade: unidadeLimpa,
      quantidade: quantidadeNumerica,
      valor_unitario: valorUnitarioNumerico,
      local_compra: localCompra.trim(),
      nfe: nfe.trim(),
      data,
    });

    setSalvandoCusto(true);
    try {
      await salvarLancamentoNaPlanilha(novoLancamento);
      setDescricao("");
      setCategoria("");
      setUnidade("");
      setQuantidade("1");
      setValorUnitario("");
      setLocalCompra("");
      setNfe("");
      setData(dataLocalHoje());
      setErroSincronizacao("");
      setPessoasMaoDeObraSelecionadas([]);
    } catch (erroGravacao) {
      if (erroGravacao.gravadoNaPlanilha) {
        atualizarLancamentos(Array.isArray(erroGravacao.lancamentos) ? erroGravacao.lancamentos : lancamentos);
        setErroSincronizacao(erroGravacao.message + " Clique em ‘Sincronizar com Excel’. O custo já está na planilha-base; não lance novamente.");
        setDescricao("");
        setCategoria("");
        setUnidade("");
        setQuantidade("1");
        setValorUnitario("");
        setLocalCompra("");
        setNfe("");
        setData(dataLocalHoje());
        setPessoasMaoDeObraSelecionadas([]);
      } else {
        setErro("O lançamento não foi confirmado no Drive. Seus dados continuam no formulário. " + (erroGravacao.message || ""));
      }
    } finally {
      setSalvandoCusto(false);
    }
  }

  async function removerLancamento(id) {
    setErro("");
    setSincronizando(true);
    try {
      const resultado = await enviarAcaoPlanilha({
        acao: "excluir_custo",
        drive_pasta_id: String(frenteSelecionada.drive_pasta_id),
        contrato_numero: String(contratoSelecionado.numero),
        frente_nome: String(frenteSelecionada.nome),
        lancamento_id: String(id),
      });
      atualizarLancamentos(Array.isArray(resultado.lancamentos) ? resultado.lancamentos : lancamentos.filter((item) => String(item.id) !== String(id)));
      setUltimaSincronizacao(new Date().toLocaleString("pt-BR"));
      setUrlExcel(resultado.excel_url || "");
      setMensagemImportacao(resultado.importados ? resultado.importados + " lançamentos importados do Excel existente." : "");
    } catch (erroExclusao) {
      if (erroExclusao.gravadoNaPlanilha) {
        atualizarLancamentos(Array.isArray(erroExclusao.lancamentos) ? erroExclusao.lancamentos : lancamentos.filter((item) => String(item.id) !== String(id)));
        setErroSincronizacao(erroExclusao.message + " Clique no botão Sincronizar com Excel para atualizar a cópia.");
      } else {
        setErro("Não foi possível remover o lançamento da planilha: " + (erroExclusao.message || ""));
      }
    } finally {
      setSincronizando(false);
    }
  }

  async function sincronizarAgora() {
    try {
      await carregarCustosDaPlanilha("sincronizar_custos", true);
    } catch {
      // A mensagem já é mostrada no estado da tela.
    }
  }

  async function reimportarCustosAgora() {
    const confirmado = window.confirm(
      "O app vai reler a planilha original desta frente e substituir somente os lançamentos importados do Excel. Os lançamentos feitos pelo app e a planilha original serão preservados. Continuar?",
    );
    if (!confirmado) return;
    try {
      const resultado = await carregarCustosDaPlanilha("reimportar_custos", true);
      setMensagemImportacao(
        (resultado.importados || 0) + " lançamentos importados novamente da planilha original.",
      );
    } catch {
      // A mensagem de erro já aparece na tela.
    }
  }

  // ------------------------------------------------------------------
  // Importação de nota fiscal em PDF.
  // ------------------------------------------------------------------

  // Prepara a tela de revisão a partir de {nota, itens} — mesmo formato quer
  // os dados tenham vindo do XML (lido localmente) quer da Edge Function
  // (PDF lido por IA).
  function prepararRevisaoComItens(nota, itensBrutos, nomeArquivo) {
    const dataPadrao = /^\d{4}-\d{2}-\d{2}$/.test(nota?.data || "") ? nota.data : dataLocalHoje();
    const fornecedor = nota?.fornecedor || "";
    const numeroNota = nota?.numero || "";

    setNotaExtraida({ ...nota, nomeArquivo });
    setItensRevisao(itensBrutos.map((item) => ({
      id: gerarIdLocal(),
      descricao: item.descricao,
      categoria: CATEGORIAS_CUSTO.includes(item.categoria_sugerida) ? item.categoria_sugerida : "Outros",
      unidade: item.unidade || "un",
      quantidade: item.quantidade,
      valor_unitario: item.valor_unitario,
      local_compra: fornecedor,
      nfe: numeroNota,
      data: dataPadrao,
    })));
    setErroRevisao("");
    setRevisaoAberta(true);
  }

  async function selecionarNotaFiscal(evento) {
    const arquivo = evento.target.files?.[0];
    evento.target.value = "";
    if (!arquivo) return;

    setErroNota("");

    const nomeArquivoMinusculo = arquivo.name?.toLowerCase() || "";
    const ehXml = arquivo.type === "application/xml" || arquivo.type === "text/xml" || nomeArquivoMinusculo.endsWith(".xml");
    const ehPdf = !ehXml && (arquivo.type === "application/pdf" || nomeArquivoMinusculo.endsWith(".pdf"));

    if (!ehXml && !ehPdf) {
      setErroNota("Selecione um arquivo PDF ou XML da nota fiscal.");
      return;
    }

    // Caminho XML: lido e interpretado localmente, sem IA e sem custo —
    // preferível sempre que o fornecedor disponibiliza o XML da NF-e.
    if (ehXml) {
      if (arquivo.size > 5 * 1024 * 1024) {
        setErroNota("O XML da nota fiscal deve ter no máximo 5 MB.");
        return;
      }
      setProcessandoNota(true);
      try {
        const textoXml = await arquivo.text();
        const { nota, itens } = interpretarNotaFiscalXml(textoXml);
        prepararRevisaoComItens(nota, itens, arquivo.name);
      } catch (erroProcessamento) {
        console.error("Falha ao ler XML da nota fiscal:", erroProcessamento);
        setErroNota(erroProcessamento.message || "Não foi possível ler este XML.");
      } finally {
        setProcessandoNota(false);
      }
      return;
    }

    // Caminho PDF: enviado à Edge Function, que usa IA (Gemini) para ler os
    // itens — único caso em que não dá pra evitar uma chamada de IA, pois o
    // PDF não é um formato estruturado.
    if (arquivo.size > 18 * 1024 * 1024) {
      setErroNota("O PDF da nota fiscal deve ter no máximo 18 MB.");
      return;
    }

    setProcessandoNota(true);
    try {
      const dataUrl = await arquivoParaDataUrl(arquivo);
      const { data: sessaoAtual } = await supabase.auth.getSession();
      const tokenAcesso = sessaoAtual?.session?.access_token;
      if (!tokenAcesso) throw new Error("Sua sessão expirou. Faça login novamente para continuar.");

      const { data: resposta, error: erroFuncao } = await supabase.functions.invoke("processar-nota-fiscal", {
        body: { arquivo: { nome: arquivo.name, dataUrl } },
        headers: { Authorization: `Bearer ${tokenAcesso}` },
      });

      if (erroFuncao) {
        let mensagem = erroFuncao.message || "Não foi possível processar a nota fiscal.";
        try {
          const corpoErro = await erroFuncao.context?.json?.();
          if (corpoErro?.error) mensagem = corpoErro.error;
        } catch {
          // Mantém a mensagem padrão se o corpo do erro não for JSON.
        }
        throw new Error(mensagem);
      }
      if (resposta?.error) throw new Error(resposta.error);

      const itensExtraidos = Array.isArray(resposta?.itens) ? resposta.itens : [];
      if (!itensExtraidos.length) throw new Error("Não foram encontrados itens nesta nota fiscal.");

      prepararRevisaoComItens(resposta.nota, itensExtraidos, arquivo.name);
    } catch (erroProcessamento) {
      console.error("Falha ao processar nota fiscal:", erroProcessamento);
      setErroNota(erroProcessamento.message || "Não foi possível ler esta nota fiscal.");
    } finally {
      setProcessandoNota(false);
    }
  }

  function alterarItemRevisao(id, alteracoes) {
    setItensRevisao((anterior) => anterior.map((item) => (item.id === id ? { ...item, ...alteracoes } : item)));
  }

  function removerItemRevisao(id) {
    setItensRevisao((anterior) => anterior.filter((item) => item.id !== id));
  }

  function fecharRevisaoNota() {
    if (salvandoRevisao) return;
    setRevisaoAberta(false);
    setItensRevisao([]);
    setNotaExtraida(null);
    setErroRevisao("");
    setProgressoRevisao("");
  }

  // Lança cada item revisado como um custo separado, um de cada vez (reusa a
  // mesma ação "salvar_custo" do lançamento manual). Se algum item falhar no
  // meio do caminho, os itens já lançados saem da lista de revisão e os
  // restantes continuam nela, para o usuário tentar de novo sem reprocessar
  // o PDF.
  async function confirmarImportacaoNota() {
    const itensParaValidar = itensRevisao;
    for (const item of itensParaValidar) {
      const quantidadeNumerica = Number(item.quantidade);
      const valorUnitarioNumerico = Number(item.valor_unitario);
      if (!item.descricao?.trim() || !item.categoria || !item.unidade?.trim() || !item.data || !Number.isFinite(quantidadeNumerica) || quantidadeNumerica <= 0 || !Number.isFinite(valorUnitarioNumerico) || valorUnitarioNumerico <= 0) {
        setErroRevisao("Revise o item \"" + (item.descricao || "sem descrição") + "\": descrição, categoria, unidade, quantidade, valor unitário e data são obrigatórios.");
        return;
      }
    }

    setErroRevisao("");
    setSalvandoRevisao(true);

    const restantes = [...itensRevisao];
    let lancados = 0;
    try {
      while (restantes.length) {
        const item = restantes[0];
        setProgressoRevisao("Lançando item " + (lancados + 1) + " de " + itensRevisao.length + ": " + item.descricao);
        const lancamento = montarLancamento({
          descricao: item.descricao.trim(),
          categoria: item.categoria,
          unidade: item.unidade.trim(),
          quantidade: Number(item.quantidade),
          valor_unitario: Number(item.valor_unitario),
          local_compra: (item.local_compra || "").trim(),
          nfe: (item.nfe || "").trim(),
          data: item.data,
        });
        await salvarLancamentoNaPlanilha(lancamento);
        restantes.shift();
        lancados += 1;
        setItensRevisao([...restantes]);
      }
      setProgressoRevisao("");
      setMensagemImportacao(lancados + (lancados === 1 ? " item lançado" : " itens lançados") + " a partir da nota fiscal.");
      fecharRevisaoNota();
    } catch (erroLancamento) {
      setItensRevisao([...restantes]);
      setProgressoRevisao("");
      const motivo = erroLancamento.message || "Erro ao gravar na planilha.";
      setErroRevisao(
        (lancados ? lancados + " de " + itensRevisao.length + " itens já foram lançados. " : "") +
        "O item \"" + (restantes[0]?.descricao || "") + "\" não foi lançado: " + motivo + " Os itens restantes continuam aqui — corrija e tente novamente."
      );
    } finally {
      setSalvandoRevisao(false);
    }
  }

  return (
    <main className="custos-frente">
      <header className="custos-frente-cabecalho">
        <button type="button" className="custos-voltar" onClick={voltar}>
          ← Voltar para a frente
        </button>
        <div className="custos-identificacao">
          <h1><span aria-hidden="true">💰</span> Custos da frente</h1>
          <p className="custos-nome-frente">{frenteSelecionada.nome}</p>
          <p className="custos-nome-contrato">
            Contrato {contratoSelecionado.numero} — {contratoSelecionado.nome}
          </p>
        </div>
      </header>

      <section className="custos-resumo" aria-label="Resumo dos custos">
        <article className="custos-resumo-card">
          <span className="custos-resumo-icone" aria-hidden="true">∑</span>
          <div><p>Total desta frente</p><strong>{formatarMoeda(total)}</strong></div>
        </article>
        <article className="custos-resumo-card">
          <span className="custos-resumo-icone" aria-hidden="true">≡</span>
          <div><p>Lançamentos</p><strong>{lancamentos.length}</strong></div>
        </article>
      </section>

      <section className="custos-cartao">
        <div className="custos-secao-titulo">
          <h2>Novo lançamento</h2>
          <p>Informe a despesa, a data e o valor.</p>
        </div>
        <form className="custos-formulario" onSubmit={adicionarLancamento}>
          {pessoasMaoDeObraSelecionadas.length === 0 && (
            <label className="custos-campo custos-campo-descricao">
              Descrição
              <input type="text" value={descricao} onChange={(evento) => setDescricao(evento.target.value)} placeholder="Ex.: Compra de materiais" maxLength={160} required />
            </label>
          )}
          <label className="custos-campo">
            Categoria
            <select value={categoria} onChange={(evento) => { setCategoria(evento.target.value); setPessoasMaoDeObraSelecionadas([]); }} required>
              <option value="">Selecione</option>
              {CATEGORIAS_CUSTO.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          {categoria === "Mão de obra" && (funcionarios.length > 0 || empreiteiros.length > 0) && (
            <div className="custos-campo custos-campo-descricao custos-mao-de-obra">
              <span className="custos-mao-de-obra-titulo">Funcionários/empreiteiros (selecione um ou mais, opcional)</span>

              <div className="custos-tipo-dia" role="radiogroup" aria-label="Tipo de dia">
                <label>
                  <input type="radio" name="tipoDiaMaoDeObra" value="util" checked={tipoDiaMaoDeObra === "util"} onChange={() => setTipoDiaMaoDeObra("util")} />
                  Dia útil
                </label>
                <label>
                  <input type="radio" name="tipoDiaMaoDeObra" value="sabado" checked={tipoDiaMaoDeObra === "sabado"} onChange={() => setTipoDiaMaoDeObra("sabado")} />
                  Sábado
                </label>
                <label>
                  <input type="radio" name="tipoDiaMaoDeObra" value="feriado" checked={tipoDiaMaoDeObra === "feriado"} onChange={() => setTipoDiaMaoDeObra("feriado")} />
                  Feriado
                </label>
              </div>

              {funcionarios.length > 0 && (
                <fieldset className="custos-mao-de-obra-grupo">
                  <legend>Funcionários</legend>
                  {funcionarios.map((pessoa) => {
                    const chave = "funcionario:" + pessoa.id;
                    const valorPessoa = valorComTipoDia("funcionario", pessoa, tipoDiaMaoDeObra);
                    return (
                      <label key={chave} className="custos-mao-de-obra-item">
                        <input type="checkbox" checked={pessoasMaoDeObraSelecionadas.includes(chave)} onChange={(evento) => alternarPessoaMaoDeObra(chave, evento.target.checked)} />
                        {pessoa.nome}{pessoa.funcao ? " — " + pessoa.funcao : ""}
                        {valorPessoa != null ? " — " + formatarMoeda(valorPessoa) + "/dia" : " — sem custo cadastrado"}
                      </label>
                    );
                  })}
                </fieldset>
              )}

              {empreiteiros.length > 0 && (
                <fieldset className="custos-mao-de-obra-grupo">
                  <legend>Empreiteiros</legend>
                  {empreiteiros.map((pessoa) => {
                    const chave = "empreiteiro:" + pessoa.id;
                    const valorPessoa = valorComTipoDia("empreiteiro", pessoa, tipoDiaMaoDeObra);
                    return (
                      <label key={chave} className="custos-mao-de-obra-item">
                        <input type="checkbox" checked={pessoasMaoDeObraSelecionadas.includes(chave)} onChange={(evento) => alternarPessoaMaoDeObra(chave, evento.target.checked)} />
                        {pessoa.nome}{pessoa.funcao ? " — " + pessoa.funcao : ""}
                        {valorPessoa != null ? " — " + formatarMoeda(valorPessoa) + "/dia" : " — sem diária cadastrada"}
                      </label>
                    );
                  })}
                </fieldset>
              )}

              {pessoasMaoDeObraSelecionadas.length === 0 ? (
                <p className="custos-mao-de-obra-dica">Nenhum selecionado — preencha a descrição e o valor manualmente abaixo.</p>
              ) : (
                <p className="custos-mao-de-obra-dica">
                  {pessoasMaoDeObraSelecionadas.length} selecionado(s) — total do dia: {formatarMoeda(
                    pessoasMaoDeObraSelecionadas.reduce((soma, chave) => {
                      const encontrada = encontrarPessoaMaoDeObra(chave);
                      if (!encontrada?.pessoa) return soma;
                      return soma + (valorComTipoDia(encontrada.tipo, encontrada.pessoa, tipoDiaMaoDeObra) || 0);
                    }, 0)
                  )}.
                </p>
              )}
            </div>
          )}
          {pessoasMaoDeObraSelecionadas.length === 0 && (
            <>
              <label className="custos-campo">
                Unidade
                <input type="text" value={unidade} onChange={(evento) => setUnidade(evento.target.value)} placeholder="un, m, m²..." required />
              </label>
              <label className="custos-campo">
                Quantidade
                <input type="number" value={quantidade} onChange={(evento) => setQuantidade(evento.target.value)} min="0.001" step="any" required />
              </label>
              <label className="custos-campo">
                Valor unitário
                <div className="custos-valor-campo">
                  <span>R$</span>
                  <input type="number" value={valorUnitario} onChange={(evento) => setValorUnitario(evento.target.value)} placeholder="0,00" min="0.01" step="0.01" required />
                </div>
              </label>
              <label className="custos-campo">
                Valor total
                <div className="custos-total-previa">{formatarMoeda(valorCalculado)}</div>
              </label>
            </>
          )}
          <label className="custos-campo">
            Local de compra
            <input type="text" value={localCompra} onChange={(evento) => setLocalCompra(evento.target.value)} placeholder="Fornecedor ou loja" maxLength={120} />
          </label>
          <label className="custos-campo">
            NF-e
            <input type="text" value={nfe} onChange={(evento) => setNfe(evento.target.value)} placeholder="Número da nota" maxLength={80} />
          </label>
          <label className="custos-campo">
            Data
            <input type="date" value={data} onChange={(evento) => setData(evento.target.value)} required />
          </label>
          <button type="submit" className="custos-adicionar" disabled={salvandoCusto || carregandoCustos || sincronizando}>
            {salvandoCusto
              ? (progressoMaoDeObra || "Salvando e sincronizando...")
              : (pessoasMaoDeObraSelecionadas.length > 0 ? "+ Lançar " + pessoasMaoDeObraSelecionadas.length + " e sincronizar" : "+ Lançar e sincronizar")}
          </button>
        </form>
        {erro && <p className="custos-erro" role="alert">{erro}</p>}

        <div className="custos-importar-nota">
          <label className="custos-sincronizar custos-importar-nota-botao">
            {processandoNota ? "Lendo a nota fiscal..." : "📄 Importar nota fiscal (PDF ou XML)"}
            <input type="file" accept="application/pdf,.pdf,application/xml,text/xml,.xml" onChange={selecionarNotaFiscal} disabled={processandoNota || carregandoCustos || sincronizando} hidden />
          </label>
          <span className="custos-importar-nota-dica">Se tiver o XML da nota, prefira ele: os itens são lidos direto, sem IA. Com só o PDF, a IA lê os itens e você revisa antes de lançar.</span>
        </div>
        {erroNota && <p className="custos-erro" role="alert">{erroNota}</p>}

        {carregandoCustos && <p className="custos-info">Carregando os lançamentos da planilha no Google Drive...</p>}
        {mensagemImportacao && <p className="custos-info">{mensagemImportacao}</p>}
        {!carregandoCustos && versaoImportador && versaoImportador !== VERSAO_CUSTOS_IMPORTADOR_ESPERADA && <p className="custos-erro" role="alert">A conexão ainda está usando uma versão antiga do Apps Script. Atualize a implantação existente antes de reimportar os custos.</p>}
        {!carregandoCustos && !erroSincronizacao && <p className="custos-sincronizacao-status">{ultimaSincronizacao ? "Planilha sincronizada · " + ultimaSincronizacao : "Planilha pronta para sincronizar"}{urlExcel && <> · <a href={urlExcel} target="_blank" rel="noreferrer">Abrir Excel no Drive</a></>}</p>}
        {erroSincronizacao && <p className="custos-erro" role="alert">A planilha não foi sincronizada: {erroSincronizacao}</p>}
      </section>

      <section className="custos-cartao custos-lista-cartao">
        <div className="custos-lista-cabecalho">
          <div className="custos-secao-titulo"><h2>Despesas desta frente</h2></div>
          <div className="custos-lista-acoes">
            <button type="button" className="custos-sincronizar" onClick={sincronizarAgora} disabled={sincronizando || carregandoCustos}>
              {sincronizando ? "Sincronizando..." : "↻ Sincronizar com Excel"}
            </button>
            <button type="button" className="custos-sincronizar" onClick={reimportarCustosAgora} disabled={sincronizando || carregandoCustos}>
              Reimportar da planilha original
            </button>
            <div className="custos-visualizacoes" role="tablist" aria-label="Visualizar despesas">
              <button type="button" role="tab" aria-selected={visualizacao === "categoria"} className={visualizacao === "categoria" ? "ativo" : ""} onClick={() => setVisualizacao("categoria")}>Por categoria</button>
              <button type="button" role="tab" aria-selected={visualizacao === "medicao"} className={visualizacao === "medicao" ? "ativo" : ""} onClick={() => setVisualizacao("medicao")}>Por medição</button>
              <button type="button" role="tab" aria-selected={visualizacao === "mes"} className={visualizacao === "mes" ? "ativo" : ""} onClick={() => setVisualizacao("mes")}>Por mês</button>
            </div>
          </div>
        </div>

        {erroSincronizacao && <p className="custos-erro" role="alert">Sincronização pendente: {erroSincronizacao}</p>}
        {visualizacao === "medicao" && carregandoMedicoes && (
          <p className="custos-info">Carregando períodos das medições...</p>
        )}
        {visualizacao === "medicao" && erroMedicoes && (
          <p className="custos-erro" role="alert">{erroMedicoes}</p>
        )}
        {visualizacao === "medicao" && !carregandoMedicoes && !medicoes.length && (
          <p className="custos-info">
            Esta frente ainda não está vinculada a medições com datas cadastradas.
          </p>
        )}

        {carregandoCustos ? (
          <div className="custos-vazio"><p>Carregando custos do Drive...</p></div>
        ) : lancamentos.length === 0 ? (
          <div className="custos-vazio">
            <span aria-hidden="true">🧾</span>
            <p>Nenhum custo lançado nesta frente.</p>
            <span>Os novos lançamentos serão gravados na planilha do Drive.</span>
          </div>
        ) : (
          <>
          <div className="custos-grafico-cartao">
            <h3 className="custos-grafico-titulo">Distribuição por {RUBRICA_VISUALIZACAO_PIZZA[visualizacao]}</h3>
            <GraficoPizzaCustos fatias={fatiasPizza} totalGeral={total} rotuloVisualizacao={RUBRICA_VISUALIZACAO_PIZZA[visualizacao]} />
          </div>
          <div className="custos-grupos">
            {grupos.map((grupo) => {
              const grupoRecolhido = !gruposAbertos.has(grupo.chave);
              return (
                <section className="custos-grupo" key={grupo.chave}>
                  <header className="custos-grupo-topo">
                    <button
                      type="button"
                      className="custos-grupo-alternar"
                      onClick={() => alternarAberto(grupo.chave)}
                      aria-expanded={!grupoRecolhido}
                    >
                      <span className={"custos-seta" + (grupoRecolhido ? " recolhida" : "")} aria-hidden="true">▾</span>
                      <span className="custos-grupo-titulo">
                        <h3>{grupo.titulo}</h3>
                        {grupo.detalhe && <p>{grupo.detalhe}</p>}
                      </span>
                    </button>
                    <span>Subtotal: {formatarMoeda(grupo.subtotal)}</span>
                  </header>

                  {!grupoRecolhido && (grupo.subgrupos ? (
                    <div className="custos-subgrupos">
                      {grupo.subgrupos.map((subgrupo) => {
                        const chaveSubgrupo = grupo.chave + ":" + subgrupo.categoria;
                        const subgrupoRecolhido = !gruposAbertos.has(chaveSubgrupo);
                        return (
                          <div className="custos-subgrupo" key={chaveSubgrupo}>
                            <div className="custos-subgrupo-topo">
                              <button
                                type="button"
                                className="custos-grupo-alternar"
                                onClick={() => alternarAberto(chaveSubgrupo)}
                                aria-expanded={!subgrupoRecolhido}
                              >
                                <span className={"custos-seta" + (subgrupoRecolhido ? " recolhida" : "")} aria-hidden="true">▾</span>
                                <h4>{subgrupo.categoria}</h4>
                              </button>
                              <span>Subtotal: {formatarMoeda(subgrupo.subtotal)}</span>
                            </div>
                            {!subgrupoRecolhido && (
                              <TabelaLancamentos
                                itens={subgrupo.itens}
                                mostrarCategoria={false}
                                baseParaPercentual={grupo.subtotal}
                                onRemover={removerLancamento}
                                desabilitarAcoes={sincronizando}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <TabelaLancamentos
                      itens={grupo.itens}
                      mostrarCategoria={visualizacao !== "categoria"}
                      baseParaPercentual={visualizacao === "categoria" ? total : grupo.subtotal}
                      onRemover={removerLancamento}
                      desabilitarAcoes={sincronizando}
                    />
                  ))}
                </section>
              );
            })}
          </div>
          </>
        )}
      </section>

      {revisaoAberta && (
        <div className="nota-revisao-overlay" onClick={fecharRevisaoNota}>
          <div className="nota-revisao-painel" onClick={(evento) => evento.stopPropagation()}>
            <div className="nota-revisao-cabecalho">
              <h2>Revisar itens da nota fiscal</h2>
              <button type="button" className="fechar" onClick={fecharRevisaoNota} disabled={salvandoRevisao} aria-label="Fechar">×</button>
            </div>
            <div className="nota-revisao-corpo">
              <RevisaoNotaFiscal
                nota={notaExtraida}
                itens={itensRevisao}
                onAlterarItem={alterarItemRevisao}
                onRemoverItem={removerItemRevisao}
                onCancelar={fecharRevisaoNota}
                onConfirmar={confirmarImportacaoNota}
                salvando={salvandoRevisao}
                progresso={progressoRevisao}
                erro={erroRevisao}
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
