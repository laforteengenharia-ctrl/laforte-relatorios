import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../services/supabase";
import { obterTokenDrive } from "../../services/driveAuth";
import { fetchComRetentativa } from "../../utils/fetchComRetentativa";
import { GOOGLE_DRIVE_SCRIPT_URL } from "../../config/googleDriveScript";
import "./CustosContrato.css";

// Precisa ficar em sincronia com a mesma lista em CustosFrente.jsx,
// GoogleAppsScript_Code.gs e processar-nota-fiscal/index.ts.
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

function formatarMoeda(valor) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(valor) || 0);
}

function percentual(valorGrupo, itemValor) {
  if (!valorGrupo) return "0,00%";
  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(itemValor / valorGrupo);
}

function valorLancamento(item) {
  if (item.valor != null) return Number(item.valor) || 0;
  return (Number(item.quantidade) || 1) * (Number(item.valor_unitario) || 0);
}

function dataLocalHoje() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");
  return ano + "-" + mes + "-" + dia;
}

// Formatação de data/período — duplicado de CustosFrente.jsx (mesma
// interpretação de data, incluindo o formato ISO que vem do Supabase).
function interpretarData(data) {
  if (!data) return null;
  if (data instanceof Date) return Number.isNaN(data.getTime()) ? null : data;

  const texto = String(data).trim();
  if (!texto) return null;

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

function formatarPeriodo(medicao) {
  if (!medicao.data_inicio && !medicao.data_fim) return "Período não informado";
  const inicio = medicao.data_inicio ? formatarData(medicao.data_inicio) : "início não informado";
  const fim = medicao.data_fim ? formatarData(medicao.data_fim) : "em andamento";
  return inicio + " a " + fim;
}

// ------------------------------------------------------------------
// Gráfico de pizza — mesma lógica/paleta do CustosFrente.jsx (duplicado
// de propósito aqui, como já é feito com CATEGORIAS_CUSTO em outros
// arquivos deste projeto, para não depender de exportar peças internas
// de um componente já grande). Qualquer ajuste de paleta/regra deve ser
// replicado nos dois lugares.
// ------------------------------------------------------------------

const CORES_GRAFICO_PIZZA = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];
const COR_OUTROS_GRAFICO_PIZZA = "#898781";
const MAX_FATIAS_GRAFICO_PIZZA = 8;

function corTextoDaFatiaPizza(cor) {
  return cor === "#eda100" ? "#17140a" : "#fff";
}

// Por padrão a lista final (fatias + legenda) fica ordenada da maior para a
// menor — faz sentido em "Por categoria"/"Por frente", onde não existe uma
// ordem natural. Já em "Por medição" a ordem natural é cronológica (o
// `grupos` recebido já vem nessa ordem), então passar `preservarOrdem: true`
// mantém essa ordem em vez de reordenar por valor.
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

function GraficoPizzaContrato({ fatias, totalGeral, rotuloVisualizacao }) {
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
    return <p className="custos-contrato-info">Nenhum valor para exibir no gráfico ainda.</p>;
  }

  // Com muitos itens (até 8, já que montarFatiasPizza limita as fatias),
  // a legenda fica mais fácil de ler dividida em colunas em vez de uma
  // lista única bem comprida.
  const colunasLegenda = fatiasComAngulo.length >= 6 ? 2 : 1;
  const linhasPorColuna = Math.ceil(fatiasComAngulo.length / colunasLegenda);

  return (
    <div className="custos-contrato-pizza">
      <svg viewBox="0 0 220 220" role="img" aria-label={"Gráfico de pizza: distribuição dos custos por " + rotuloVisualizacao} className="custos-contrato-pizza-svg">
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
                <text x={pontoRotulo.x} y={pontoRotulo.y} textAnchor="middle" dominantBaseline="middle" fill={corTextoDaFatiaPizza(fatia.cor)} className="custos-contrato-pizza-rotulo" pointerEvents="none">
                  {percentual(totalGeral, fatia.valor)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <ul
        className="custos-contrato-pizza-legenda"
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
            <span className="custos-contrato-pizza-marcador" style={{ background: fatia.cor }} aria-hidden="true" />
            <span className="custos-contrato-pizza-legenda-titulo">{fatia.titulo}</span>
            <span className="custos-contrato-pizza-legenda-valores">{percentual(totalGeral, fatia.valor)} · {formatarMoeda(fatia.valor)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ------------------------------------------------------------------
// Busca os lançamentos de custo de UMA frente na mesma API (Apps Script)
// já usada por CustosFrente.jsx — não existe fonte única no Supabase
// para esses valores, eles vivem nas planilhas do Drive de cada frente.
// ------------------------------------------------------------------
async function buscarCustosDaFrente(frente, contratoSelecionado, token) {
  const parametros = new URLSearchParams({
    acao: "listar_custos",
    drive_pasta_id: String(frente?.drive_pasta_id || ""),
    contrato_numero: String(contratoSelecionado?.numero || ""),
    frente_nome: String(frente?.nome || ""),
    token,
  });
  const respostaHttp = await fetchComRetentativa(GOOGLE_DRIVE_SCRIPT_URL + "?" + parametros.toString());
  const resultado = await respostaHttp.json();
  if (!respostaHttp.ok || !resultado?.ok) {
    throw new Error(
      resultado?.erro_auth
        ? "Sessão expirada. Saia e entre novamente para atualizar."
        : resultado?.erro || "Não foi possível consultar a planilha desta frente no Drive."
    );
  }
  return resultado.lancamentos || [];
}

function situacaoDaFrente(frente) {
  if ((frente.status || "ativo") === "arquivado") return { rotulo: "Arquivada", classe: "arquivada" };
  if (frente.situacao === "finalizada") return { rotulo: "Finalizada", classe: "finalizada" };
  return { rotulo: "Em andamento", classe: "andamento" };
}

export default function CustosContrato({ contratoSelecionado, voltar, abrirCustosDaFrente }) {
  const [frentes, setFrentes] = useState([]);
  const [carregandoFrentes, setCarregandoFrentes] = useState(true);
  const [erroFrentes, setErroFrentes] = useState("");
  // id da frente -> { carregando, erro, lancamentos }
  const [dadosPorFrente, setDadosPorFrente] = useState({});
  const [visualizacao, setVisualizacao] = useState("frente");
  const [pedidoRecarregar, setPedidoRecarregar] = useState(0);
  // Medições são do contrato (não por frente) — uma medição pode reunir
  // lançamentos de várias frentes, por isso é consultada uma vez só aqui.
  const [medicoesContrato, setMedicoesContrato] = useState([]);

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      if (!contratoSelecionado?.id) {
        setFrentes([]);
        setCarregandoFrentes(false);
        return;
      }

      setCarregandoFrentes(true);
      setErroFrentes("");

      const { data, error } = await supabase
        .from("frentes")
        .select("*")
        .eq("contrato_id", Number(contratoSelecionado.id))
        .order("ordem", { ascending: true });

      if (!ativo) return;

      if (error) {
        console.error("Não foi possível carregar as frentes do contrato:", error);
        setErroFrentes("Não foi possível carregar as frentes deste contrato.");
        setFrentes([]);
        setCarregandoFrentes(false);
        return;
      }

      const lista = data || [];
      setFrentes(lista);
      setCarregandoFrentes(false);

      if (!lista.length) {
        setDadosPorFrente({});
        return;
      }

      const inicial = {};
      lista.forEach((frente) => {
        inicial[frente.id] = { carregando: true, erro: "", lancamentos: [] };
      });
      setDadosPorFrente(inicial);

      let token = "";
      try {
        token = await obterTokenDrive();
      } catch (erroToken) {
        console.error("Não foi possível obter o token do Drive:", erroToken);
        if (!ativo) return;
        const comErro = {};
        lista.forEach((frente) => {
          comErro[frente.id] = { carregando: false, erro: "Sessão expirada. Saia e entre novamente.", lancamentos: [] };
        });
        setDadosPorFrente(comErro);
        return;
      }

      lista.forEach((frente) => {
        if (!frente.drive_pasta_id) {
          if (ativo) {
            setDadosPorFrente((atual) => ({
              ...atual,
              [frente.id]: { carregando: false, erro: "Sem pasta do Drive configurada nesta frente.", lancamentos: [] },
            }));
          }
          return;
        }

        buscarCustosDaFrente(frente, contratoSelecionado, token)
          .then((lancamentos) => {
            if (!ativo) return;
            setDadosPorFrente((atual) => ({
              ...atual,
              [frente.id]: { carregando: false, erro: "", lancamentos },
            }));
          })
          .catch((erroBusca) => {
            console.error("Não foi possível consultar os custos da frente " + frente.nome + ":", erroBusca);
            if (!ativo) return;
            setDadosPorFrente((atual) => ({
              ...atual,
              [frente.id]: { carregando: false, erro: erroBusca.message || "Falha ao consultar a planilha.", lancamentos: [] },
            }));
          });
      });
    }

    carregar();
    return () => {
      ativo = false;
    };
  }, [contratoSelecionado?.id, pedidoRecarregar]);

  useEffect(() => {
    let ativo = true;
    async function carregarMedicoesDoContrato() {
      if (!contratoSelecionado?.id) {
        setMedicoesContrato([]);
        return;
      }
      const { data, error } = await supabase
        .from("medicoes")
        .select("id,numero,data_inicio,data_fim")
        .eq("contrato_id", Number(contratoSelecionado.id))
        .order("numero", { ascending: true });
      if (!ativo) return;
      if (error) {
        console.error("Não foi possível carregar as medições do contrato:", error);
        setMedicoesContrato([]);
        return;
      }
      setMedicoesContrato(data || []);
    }
    carregarMedicoesDoContrato();
    return () => {
      ativo = false;
    };
  }, [contratoSelecionado?.id]);

  const frentesComDados = useMemo(
    () =>
      frentes.map((frente) => {
        const info = dadosPorFrente[frente.id] || { carregando: true, erro: "", lancamentos: [] };
        const total = info.lancamentos.reduce((soma, item) => soma + valorLancamento(item), 0);
        return { frente, ...info, total };
      }),
    [frentes, dadosPorFrente]
  );

  const algumaCarregando = carregandoFrentes || frentesComDados.some((item) => item.carregando);
  const frentesComErro = frentesComDados.filter((item) => item.erro);
  const totalGeral = frentesComDados.reduce((soma, item) => soma + (item.erro ? 0 : item.total), 0);

  const resumoSituacoes = useMemo(() => {
    let emAndamento = 0;
    let finalizadas = 0;
    let arquivadas = 0;
    frentes.forEach((frente) => {
      const situacao = situacaoDaFrente(frente).classe;
      if (situacao === "arquivada") arquivadas += 1;
      else if (situacao === "finalizada") finalizadas += 1;
      else emAndamento += 1;
    });
    return { emAndamento, finalizadas, arquivadas };
  }, [frentes]);

  const gruposPorFrente = useMemo(
    () =>
      frentesComDados
        .filter((item) => !item.erro)
        .map((item) => ({
          chave: "frente-" + item.frente.id,
          titulo: item.frente.nome,
          subtotal: item.total,
        })),
    [frentesComDados]
  );

  const gruposPorCategoria = useMemo(() => {
    const mapa = new Map(CATEGORIAS_CUSTO.map((categoria) => [categoria, 0]));
    frentesComDados.forEach((item) => {
      if (item.erro) return;
      item.lancamentos.forEach((lancamento) => {
        const categoria = CATEGORIAS_CUSTO.includes(lancamento.categoria) ? lancamento.categoria : "Outros";
        mapa.set(categoria, (mapa.get(categoria) || 0) + valorLancamento(lancamento));
      });
    });
    return CATEGORIAS_CUSTO.map((categoria) => ({
      chave: "categoria-" + categoria,
      titulo: categoria,
      subtotal: mapa.get(categoria) || 0,
    }));
  }, [frentesComDados]);

  // Agrupa os lançamentos de TODAS as frentes por medição do contrato —
  // mesma lógica usada em CustosFrente.jsx (medição pelo medicao_numero
  // importado ou, na falta dele, pela data do lançamento dentro do período
  // da medição), só que somando entre frentes em vez de uma frente só.
  const gruposPorMedicao = useMemo(() => {
    const hoje = dataLocalHoje();
    const mapa = new Map();
    const obterGrupo = (chave, titulo, ordem, detalhe = "") => {
      if (!mapa.has(chave)) mapa.set(chave, { chave, titulo, ordem, detalhe, subtotal: 0 });
      return mapa.get(chave);
    };

    medicoesContrato.forEach((medicao) => {
      obterGrupo(
        "medicao-" + medicao.id,
        "Medição " + String(medicao.numero || "").padStart(2, "0"),
        Number(medicao.numero) || 0,
        formatarPeriodo(medicao)
      );
    });

    frentesComDados.forEach((item) => {
      if (item.erro) return;
      item.lancamentos.forEach((lancamento) => {
        const medicaoImportada = lancamento.medicao_numero
          ? medicoesContrato.find((medicao) => Number(medicao.numero) === Number(lancamento.medicao_numero))
          : null;

        let medicaoAlvo = medicaoImportada;
        if (!medicaoAlvo) {
          const candidatas = medicoesContrato
            .filter((medicao) => {
              if (!lancamento.data || !medicao.data_inicio || lancamento.data < medicao.data_inicio) return false;
              const dataFim = medicao.data_fim || hoje;
              return lancamento.data <= dataFim;
            })
            .sort((a, b) => String(b.data_inicio).localeCompare(String(a.data_inicio)));
          medicaoAlvo = candidatas[0] || null;
        }

        const grupo = medicaoAlvo
          ? obterGrupo(
              "medicao-" + medicaoAlvo.id,
              "Medição " + String(medicaoAlvo.numero || "").padStart(2, "0"),
              Number(medicaoAlvo.numero) || 0,
              formatarPeriodo(medicaoAlvo)
            )
          : obterGrupo("sem-medicao", "Fora do período de medição", 9999, "Despesas sem data dentro de um período cadastrado");
        grupo.subtotal += valorLancamento(lancamento);
      });
    });

    return Array.from(mapa.values()).sort((a, b) => a.ordem - b.ordem);
  }, [frentesComDados, medicoesContrato]);

  const gruposAtivos =
    visualizacao === "frente" ? gruposPorFrente : visualizacao === "categoria" ? gruposPorCategoria : gruposPorMedicao;
  // Em "Por medição" a ordem cronológica já vem pronta em gruposPorMedicao —
  // preservá-la em vez de reordenar por valor (ver montarFatiasPizza).
  const fatiasPizza = useMemo(
    () => montarFatiasPizza(gruposAtivos, totalGeral, { preservarOrdem: visualizacao === "medicao" }),
    [gruposAtivos, totalGeral, visualizacao]
  );

  const linhasFrenteOrdenadas = useMemo(
    () => [...frentesComDados].sort((a, b) => b.total - a.total),
    [frentesComDados]
  );

  const linhasCategoriaOrdenadas = useMemo(
    () => [...gruposPorCategoria].filter((grupo) => grupo.subtotal > 0).sort((a, b) => b.subtotal - a.subtotal),
    [gruposPorCategoria]
  );

  const linhasMedicaoOrdenadas = useMemo(
    () => gruposPorMedicao.filter((grupo) => grupo.subtotal > 0),
    [gruposPorMedicao]
  );

  return (
    <div className="custos-contrato">
      <header className="custos-contrato-cabecalho">
        <button type="button" className="custos-contrato-voltar" onClick={voltar}>
          ← Voltar para o contrato
        </button>

        <div className="custos-contrato-identificacao">
          <h1>Custos do contrato</h1>
          <p>
            Contrato {contratoSelecionado?.numero}
            {" — "}
            {contratoSelecionado?.nome}
          </p>
        </div>

        <button
          type="button"
          className="custos-contrato-atualizar"
          onClick={() => setPedidoRecarregar((atual) => atual + 1)}
          disabled={algumaCarregando}
        >
          {algumaCarregando ? "Atualizando..." : "↻ Atualizar"}
        </button>
      </header>

      <p className="custos-contrato-aviso-tempo">
        Os valores são consultados em tempo real nas planilhas de cada frente no Drive — contratos com várias frentes podem levar alguns segundos para carregar tudo.
      </p>

      {erroFrentes ? (
        <div className="custos-contrato-erro-geral">{erroFrentes}</div>
      ) : (
        <>
          <div className="custos-contrato-resumo">
            <div className="custos-contrato-resumo-card">
              <span className="custos-contrato-resumo-rotulo">Custo real do contrato</span>
              <strong>{formatarMoeda(totalGeral)}</strong>
              <span className="custos-contrato-resumo-detalhe">
                Soma de todas as frentes (em andamento, finalizadas e arquivadas)
              </span>
            </div>
            <div className="custos-contrato-resumo-card">
              <span className="custos-contrato-resumo-rotulo">Frentes do contrato</span>
              <strong>{frentes.length}</strong>
              <span className="custos-contrato-resumo-detalhe">
                Em andamento: {resumoSituacoes.emAndamento} · Finalizadas: {resumoSituacoes.finalizadas} · Arquivadas: {resumoSituacoes.arquivadas}
              </span>
            </div>
          </div>

          {frentesComErro.length > 0 && (
            <div className="custos-contrato-aviso-erro">
              Não foi possível consultar {frentesComErro.length === 1 ? "a planilha de 1 frente" : `as planilhas de ${frentesComErro.length} frentes`} — o total acima não inclui {frentesComErro.length === 1 ? "essa frente" : "essas frentes"}. Veja os detalhes na lista "Por frente" abaixo.
            </div>
          )}

          {carregandoFrentes ? (
            <div className="custos-contrato-vazio">Carregando frentes do contrato...</div>
          ) : frentes.length === 0 ? (
            <div className="custos-contrato-vazio">Nenhuma frente cadastrada para este contrato.</div>
          ) : (
            <div className="custos-contrato-cartao">
              <div className="custos-contrato-visualizacoes">
                <button type="button" className={visualizacao === "frente" ? "ativo" : ""} onClick={() => setVisualizacao("frente")}>
                  Por frente
                </button>
                <button type="button" className={visualizacao === "categoria" ? "ativo" : ""} onClick={() => setVisualizacao("categoria")}>
                  Por categoria
                </button>
                <button type="button" className={visualizacao === "medicao" ? "ativo" : ""} onClick={() => setVisualizacao("medicao")}>
                  Por medição
                </button>
              </div>

              <h3 className="custos-contrato-grafico-titulo">
                Distribuição por {visualizacao === "frente" ? "frente" : visualizacao === "categoria" ? "categoria" : "medição"}
              </h3>
              <GraficoPizzaContrato
                fatias={fatiasPizza}
                totalGeral={totalGeral}
                rotuloVisualizacao={visualizacao === "frente" ? "frente" : visualizacao === "categoria" ? "categoria" : "medição"}
              />

              {visualizacao === "frente" ? (
                <ul className="custos-contrato-lista">
                  {linhasFrenteOrdenadas.map((item) => {
                    const situacao = situacaoDaFrente(item.frente);
                    return (
                      <li key={item.frente.id} className="custos-contrato-linha">
                        <div className="custos-contrato-linha-info">
                          <span className={"custos-contrato-badge custos-contrato-badge-" + situacao.classe}>{situacao.rotulo}</span>
                          <span className="custos-contrato-linha-nome">{item.frente.nome}</span>
                        </div>

                        <div className="custos-contrato-linha-valor">
                          {item.carregando ? (
                            <span className="custos-contrato-linha-status">Consultando...</span>
                          ) : item.erro ? (
                            <span className="custos-contrato-linha-erro" title={item.erro}>⚠ {item.erro}</span>
                          ) : (
                            <strong>{formatarMoeda(item.total)}</strong>
                          )}
                        </div>

                        <button
                          type="button"
                          className="custos-contrato-linha-acao"
                          onClick={() => abrirCustosDaFrente(item.frente)}
                        >
                          Ver custos da frente →
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : visualizacao === "categoria" ? (
                <ul className="custos-contrato-lista">
                  {linhasCategoriaOrdenadas.length === 0 ? (
                    <li className="custos-contrato-vazio-linha">Nenhum custo lançado em nenhuma frente ainda.</li>
                  ) : (
                    linhasCategoriaOrdenadas.map((grupo) => (
                      <li key={grupo.chave} className="custos-contrato-linha">
                        <div className="custos-contrato-linha-info">
                          <span className="custos-contrato-linha-nome">{grupo.titulo}</span>
                        </div>
                        <div className="custos-contrato-linha-valor">
                          <strong>{formatarMoeda(grupo.subtotal)}</strong>
                          <span className="custos-contrato-linha-percentual">{percentual(totalGeral, grupo.subtotal)}</span>
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              ) : (
                <ul className="custos-contrato-lista">
                  {linhasMedicaoOrdenadas.length === 0 ? (
                    <li className="custos-contrato-vazio-linha">Nenhum custo lançado em nenhuma frente ainda.</li>
                  ) : (
                    linhasMedicaoOrdenadas.map((grupo) => (
                      <li key={grupo.chave} className="custos-contrato-linha">
                        <div className="custos-contrato-linha-info">
                          <div className="custos-contrato-linha-titulo-bloco">
                            <span className="custos-contrato-linha-nome">{grupo.titulo}</span>
                            {grupo.detalhe && <span className="custos-contrato-linha-periodo">{grupo.detalhe}</span>}
                          </div>
                        </div>
                        <div className="custos-contrato-linha-valor">
                          <strong>{formatarMoeda(grupo.subtotal)}</strong>
                          <span className="custos-contrato-linha-percentual">{percentual(totalGeral, grupo.subtotal)}</span>
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
