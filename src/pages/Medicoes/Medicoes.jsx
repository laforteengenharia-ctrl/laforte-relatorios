import { useEffect, useMemo, useState } from "react";

import "./Medicoes.css";

import Modal from "../../components/Modal/Modal";

import { supabase } from "../../services/supabase";


// =====================================================
// GOOGLE DRIVE / APPS SCRIPT
// =====================================================

const GOOGLE_DRIVE_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbykcDwsViBK50fZmdSBW1_f9_K7Blz5TPuZICdvLO-LUFsMxG6-5A94A4f1yqe1QufB5Q/exec";


// =====================================================
// COMPONENTE
// =====================================================

export default function Medicoes() {
  const [medicoes, setMedicoes] = useState([]);
  const [contratos, setContratos] = useState([]);

  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const [modalAberto, setModalAberto] = useState(false);

  const [medicao, setMedicao] = useState({
    id: null,
    contrato_id: "",
    numero: "",
    data_inicio: "",
    data_fim: "",
    status: "em_andamento",
    observacao: "",
  });

  // ===================================================
  // FRENTES DA MEDIÇÃO
  // ===================================================

  const [frentes, setFrentes] = useState([]);
  const [frentesSelecionadas, setFrentesSelecionadas] = useState([]);

  const [carregandoFrentes, setCarregandoFrentes] = useState(false);

  // ===================================================
  // FOTOS
  // ===================================================

  const [modalFotosAberto, setModalFotosAberto] = useState(false);

  const [medicaoFotosAtual, setMedicaoFotosAtual] = useState(null);

  const [fotosPorFrente, setFotosPorFrente] = useState({});

  const [carregandoFotos, setCarregandoFotos] = useState(false);

  const [erroFotos, setErroFotos] = useState("");

  const [fotoAmpliada, setFotoAmpliada] = useState(null);


  // =====================================================
  // CARREGAR CONTRATOS
  // =====================================================

  async function carregarContratos() {
    const { data, error } = await supabase
      .from("contratos")
      .select("id, numero, nome, status")
      .order("id", { ascending: false });

    if (error) {
      console.error("Erro ao carregar contratos:", error);

      alert(
        `Não foi possível carregar os contratos.\n\n${error.message}`
      );

      return;
    }

    setContratos(data || []);
  }


  // =====================================================
  // CARREGAR MEDIÇÕES
  // =====================================================

  async function carregarMedicoes() {
    setCarregando(true);

    const { data, error } = await supabase
      .from("medicoes")
      .select(`
        *,
        contratos (
          id,
          numero,
          nome
        )
      `)
      .order("id", { ascending: false });

    if (error) {
      console.error("Erro ao carregar medições:", error);

      alert(
        `Não foi possível carregar as medições.\n\n${error.message}`
      );

      setCarregando(false);

      return;
    }

    setMedicoes(data || []);

    setCarregando(false);
  }


  // =====================================================
  // INICIALIZAÇÃO
  // =====================================================

  useEffect(() => {
    carregarContratos();
    carregarMedicoes();
  }, []);


  // =====================================================
  // CARREGAR FRENTES DO CONTRATO
  // =====================================================

  async function carregarFrentesDoContrato(
    contratoId,
    medicaoId = null
  ) {
    if (!contratoId) {
      setFrentes([]);
      setFrentesSelecionadas([]);
      return;
    }

    setCarregandoFrentes(true);

    try {
      const { data: frentesData, error: erroFrentes } =
        await supabase
          .from("frentes")
          .select("*")
          .eq("contrato_id", Number(contratoId))
          .order("ordem", { ascending: true });

      if (erroFrentes) {
        console.error(
          "Erro ao carregar frentes:",
          erroFrentes
        );

        alert(
          `Não foi possível carregar as frentes.\n\n${erroFrentes.message}`
        );

        setFrentes([]);
        setFrentesSelecionadas([]);

        return;
      }

      const listaFrentes = frentesData || [];

      setFrentes(listaFrentes);

      // -----------------------------------------------
      // NOVA MEDIÇÃO
      // -----------------------------------------------

      if (!medicaoId) {
        setFrentesSelecionadas([]);
        return;
      }

      // -----------------------------------------------
      // EDITANDO MEDIÇÃO
      // -----------------------------------------------

      const {
        data: links,
        error: erroLinks,
      } = await supabase
        .from("medicao_frentes")
        .select("frente_id")
        .eq("medicao_id", Number(medicaoId));

      if (erroLinks) {
        console.error(
          "Erro ao carregar frentes da medição:",
          erroLinks
        );

        alert(
          `Não foi possível carregar as frentes da medição.\n\n${erroLinks.message}`
        );

        setFrentesSelecionadas([]);

        return;
      }

      const ids = (links || []).map(
        (item) => Number(item.frente_id)
      );

      setFrentesSelecionadas(ids);
    } finally {
      setCarregandoFrentes(false);
    }
  }


  // =====================================================
  // ALTERAR CONTRATO
  // =====================================================

  async function alterarContrato(contratoId) {
    setMedicao((anterior) => ({
      ...anterior,
      contrato_id: contratoId,
    }));

    setFrentesSelecionadas([]);

    if (contratoId) {
      await carregarFrentesDoContrato(contratoId);
    } else {
      setFrentes([]);
    }
  }


  // =====================================================
  // NOVA MEDIÇÃO
  // =====================================================

  async function novaMedicao() {
    setMedicao({
      id: null,
      contrato_id: "",
      numero: "",
      data_inicio: "",
      data_fim: "",
      status: "em_andamento",
      observacao: "",
    });

    setFrentes([]);
    setFrentesSelecionadas([]);

    setModalAberto(true);
  }


  // =====================================================
  // EDITAR MEDIÇÃO
  // =====================================================

  async function editarMedicao(item) {
    setMedicao({
      id: item.id,
      contrato_id: item.contrato_id || "",
      numero: item.numero || "",
      data_inicio: item.data_inicio || "",
      data_fim: item.data_fim || "",
      status: item.status || "em_andamento",
      observacao: item.observacao || "",
    });

    setModalAberto(true);

    await carregarFrentesDoContrato(
      item.contrato_id,
      item.id
    );
  }


  // =====================================================
  // SELECIONAR / DESMARCAR FRENTE
  // =====================================================

  function alternarFrente(frenteId) {
    const id = Number(frenteId);

    setFrentesSelecionadas((anterior) => {
      if (anterior.includes(id)) {
        return anterior.filter(
          (item) => item !== id
        );
      }

      return [...anterior, id];
    });
  }


  // =====================================================
  // SELECIONAR TODAS
  // =====================================================

  function selecionarTodasFrentes() {
    const ids = frentes
      .filter(
        (frente) =>
          (frente.status || "ativo") === "ativo"
      )
      .map((frente) => Number(frente.id));

    setFrentesSelecionadas(ids);
  }


  // =====================================================
  // DESMARCAR TODAS
  // =====================================================

  function desmarcarTodasFrentes() {
    setFrentesSelecionadas([]);
  }


  // =====================================================
  // SALVAR MEDIÇÃO
  // =====================================================

  async function salvarMedicao(evento) {
    evento.preventDefault();

    if (!medicao.contrato_id) {
      alert("Selecione o contrato.");
      return;
    }

    if (!medicao.numero) {
      alert("Informe o número da medição.");
      return;
    }

    if (frentesSelecionadas.length === 0) {
      alert(
        "Selecione pelo menos uma frente para esta medição."
      );

      return;
    }

    setSalvando(true);

    const dados = {
      contrato_id: Number(medicao.contrato_id),
      numero: Number(medicao.numero),
      data_inicio: medicao.data_inicio || null,
      data_fim: medicao.data_fim || null,
      status:
        medicao.status === "fechada"
          ? "fechada"
          : "em_andamento",
      observacao:
        medicao.observacao?.trim() || "",
    };

    try {
      let medicaoId = medicao.id;

      // =================================================
      // EDITAR
      // =================================================

      if (medicao.id) {
        const { error } = await supabase
          .from("medicoes")
          .update(dados)
          .eq("id", medicao.id);

        if (error) {
          console.error(
            "Erro ao atualizar medição:",
            error
          );

          alert(
            `Não foi possível atualizar a medição.\n\n${error.message}`
          );

          return;
        }
      }

      // =================================================
      // NOVA
      // =================================================

      else {
        const {
          data,
          error,
        } = await supabase
          .from("medicoes")
          .insert([dados])
          .select("id")
          .single();

        if (error) {
          console.error(
            "Erro ao criar medição:",
            error
          );

          alert(
            `Não foi possível criar a medição.\n\n${error.message}`
          );

          return;
        }

        medicaoId = data.id;
      }

      // =================================================
      // ATUALIZAR VÍNCULOS DAS FRENTES
      // =================================================

      const {
        error: erroExcluirLinks,
      } = await supabase
        .from("medicao_frentes")
        .delete()
        .eq("medicao_id", Number(medicaoId));

      if (erroExcluirLinks) {
        console.error(
          "Erro ao limpar frentes da medição:",
          erroExcluirLinks
        );

        alert(
          `A medição foi salva, mas não foi possível atualizar as frentes.\n\n${erroExcluirLinks.message}`
        );

        return;
      }

      const registrosFrentes =
        frentesSelecionadas.map((frenteId) => ({
          medicao_id: Number(medicaoId),
          frente_id: Number(frenteId),
        }));

      const {
        error: erroInserirLinks,
      } = await supabase
        .from("medicao_frentes")
        .insert(registrosFrentes);

      if (erroInserirLinks) {
        console.error(
          "Erro ao vincular frentes:",
          erroInserirLinks
        );

        alert(
          `A medição foi salva, mas não foi possível vincular as frentes.\n\n${erroInserirLinks.message}`
        );

        return;
      }

      await carregarMedicoes();

      setModalAberto(false);

      setMedicao({
        id: null,
        contrato_id: "",
        numero: "",
        data_inicio: "",
        data_fim: "",
        status: "em_andamento",
        observacao: "",
      });

      setFrentes([]);
      setFrentesSelecionadas([]);
    } finally {
      setSalvando(false);
    }
  }


  // =====================================================
  // EXCLUIR MEDIÇÃO
  // =====================================================

  async function excluirMedicao(id) {
    const confirmar = window.confirm(
      "Deseja realmente excluir esta medição?\n\n" +
        "Esta ação não poderá ser desfeita."
    );

    if (!confirmar) {
      return;
    }

    const { error } = await supabase
      .from("medicoes")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(
        "Erro ao excluir medição:",
        error
      );

      alert(
        `Não foi possível excluir a medição.\n\n${error.message}`
      );

      return;
    }

    await carregarMedicoes();
  }


  // =====================================================
  // STATUS
  // =====================================================

  function mostrarStatus(status) {
    if (status === "fechada") {
      return "Fechada";
    }

    return "Em andamento";
  }


  // =====================================================
  // FORMATAÇÃO DE DATA
  // =====================================================

  function formatarData(data) {
    if (!data) {
      return "-";
    }

    const partes = data.split("-");

    if (partes.length !== 3) {
      return data;
    }

    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }


  // =====================================================
  // FRENTES VISÍVEIS NO FORMULÁRIO
  // =====================================================

  const frentesOrdenadas = useMemo(() => {
    return [...frentes].sort(
      (a, b) =>
        Number(a.ordem || 0) -
        Number(b.ordem || 0)
    );
  }, [frentes]);


  // =====================================================
  // BUSCAR FOTOS DA FRENTE
  // =====================================================

  async function buscarFotosDaFrente(
    frente,
    numeroMedicao
  ) {
    const drivePastaId = frente.drive_pasta_id;

    if (!drivePastaId) {
      return {
        frente,
        ok: false,
        erro:
          "Esta frente não possui uma pasta do Google Drive cadastrada.",
        fotos: [],
        videos: [],
        outros: [],
        quantidade: {
          fotos: 0,
          videos: 0,
          outros: 0,
          total: 0,
        },
      };
    }

    try {
      // =================================================
      // IMPORTANTE:
      // O Apps Script espera "drive_pasta_id"
      // =================================================

      const url =
        `${GOOGLE_DRIVE_SCRIPT_URL}` +
        `?drive_pasta_id=${encodeURIComponent(
          drivePastaId
        )}` +
        `&medicao=${encodeURIComponent(
          numeroMedicao
        )}`;

      const resposta = await fetch(url);

      if (!resposta.ok) {
        throw new Error(
          `Erro HTTP ${resposta.status}`
        );
      }

      const resultado = await resposta.json();

      if (!resultado.ok) {
        return {
          frente,
          ok: false,
          erro:
            resultado.mensagem ||
            resultado.erro ||
            "O Google Apps Script retornou um erro.",
          fotos: resultado.fotos || [],
          videos: resultado.videos || [],
          outros: resultado.outros || [],
          quantidade:
            resultado.quantidade || {
              fotos: 0,
              videos: 0,
              outros: 0,
              total: 0,
            },
          pastaFotos:
            resultado.pastaFotos || null,
          pastaMedicao:
            resultado.pastaMedicao || null,
        };
      }

      return {
        frente,
        ok: true,
        erro: "",
        encontrada:
          resultado.encontrada !== false,
        pastaFotos:
          resultado.pastaFotos || null,
        pastaMedicao:
          resultado.pastaMedicao || null,
        quantidade:
          resultado.quantidade || {
            fotos: 0,
            videos: 0,
            outros: 0,
            total: 0,
          },
        fotos: resultado.fotos || [],
        videos: resultado.videos || [],
        outros: resultado.outros || [],
      };
    } catch (error) {
      console.error(
        "Erro ao buscar fotos da frente:",
        frente.nome,
        error
      );

      return {
        frente,
        ok: false,
        erro:
          error?.message ||
          "Não foi possível consultar o Google Drive.",
        fotos: [],
        videos: [],
        outros: [],
        quantidade: {
          fotos: 0,
          videos: 0,
          outros: 0,
          total: 0,
        },
      };
    }
  }


  // =====================================================
  // ABRIR FOTOS DA MEDIÇÃO
  // =====================================================

  async function abrirFotosMedicao(item) {
    setMedicaoFotosAtual(item);

    setFotosPorFrente({});

    setErroFotos("");

    setModalFotosAberto(true);

    setCarregandoFotos(true);

    try {
      // -----------------------------------------------
      // BUSCAR FRENTES VINCULADAS À MEDIÇÃO
      // -----------------------------------------------

      const {
        data: links,
        error: erroLinks,
      } = await supabase
        .from("medicao_frentes")
        .select("frente_id")
        .eq("medicao_id", Number(item.id));

      if (erroLinks) {
        console.error(
          "Erro ao carregar frentes da medição:",
          erroLinks
        );

        setErroFotos(
          `Não foi possível carregar as frentes da medição.\n\n${erroLinks.message}`
        );

        return;
      }

      const idsFrentes = (links || []).map(
        (link) => Number(link.frente_id)
      );

      if (idsFrentes.length === 0) {
        setErroFotos(
          "Esta medição não possui frentes vinculadas."
        );

        return;
      }

      // -----------------------------------------------
      // BUSCAR DADOS DAS FRENTES
      // -----------------------------------------------

      const {
        data: frentesDaMedicao,
        error: erroFrentes,
      } = await supabase
        .from("frentes")
        .select("*")
        .in("id", idsFrentes);

      if (erroFrentes) {
        console.error(
          "Erro ao carregar dados das frentes:",
          erroFrentes
        );

        setErroFotos(
          `Não foi possível carregar os dados das frentes.\n\n${erroFrentes.message}`
        );

        return;
      }

      const mapaFrentes = new Map(
        (frentesDaMedicao || []).map(
          (frente) => [
            Number(frente.id),
            frente,
          ]
        )
      );

      const listaFrentes =
        idsFrentes
          .map((id) => mapaFrentes.get(id))
          .filter(Boolean);

      // -----------------------------------------------
      // CONSULTAR DRIVE DE CADA FRENTE
      // -----------------------------------------------

      const resultados = await Promise.all(
        listaFrentes.map((frente) =>
          buscarFotosDaFrente(
            frente,
            item.numero
          )
        )
      );

      const novoMapa = {};

      resultados.forEach((resultado) => {
        novoMapa[
          resultado.frente.id
        ] = resultado;
      });

      setFotosPorFrente(novoMapa);
    } finally {
      setCarregandoFotos(false);
    }
  }


  // =====================================================
  // URL DA IMAGEM
  // =====================================================

  function obterUrlImagem(arquivo) {
    if (!arquivo?.id) {
      return "";
    }

    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(
      arquivo.id
    )}&sz=w600`;
  }


  // =====================================================
  // URL DO ARQUIVO
  // =====================================================

  function obterUrlArquivo(arquivo) {
    if (!arquivo?.id) {
      return "";
    }

    return `https://drive.google.com/file/d/${encodeURIComponent(
      arquivo.id
    )}/view`;
  }


  // =====================================================
  // FECHAR MODAL DE FOTOS
  // =====================================================

  function fecharModalFotos() {
    setModalFotosAberto(false);
    setMedicaoFotosAtual(null);
    setFotosPorFrente({});
    setErroFotos("");
    setFotoAmpliada(null);
  }


  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className="medicoes-page">

      {/* =================================================
          CABEÇALHO
      ================================================= */}

      <div className="medicoes-topo">

        <div>
          <h1>Medições</h1>

          <p>
            Gerencie as medições dos contratos.
          </p>
        </div>

        <button
          className="nova-medicao-btn"
          onClick={novaMedicao}
        >
          + Nova Medição
        </button>

      </div>


      {/* =================================================
          TABELA
      ================================================= */}

      <div className="medicoes-tabela-container">

        <table className="medicoes-tabela">

          <thead>
            <tr>
              <th>Medição</th>
              <th>Contrato</th>
              <th>Obra</th>
              <th>Período</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>

          <tbody>

            {carregando ? (

              <tr>
                <td
                  colSpan="6"
                  className="medicoes-vazio"
                >
                  Carregando medições...
                </td>
              </tr>

            ) : medicoes.length === 0 ? (

              <tr>
                <td
                  colSpan="6"
                  className="medicoes-vazio"
                >
                  Nenhuma medição cadastrada.
                </td>
              </tr>

            ) : (

              medicoes.map((item) => (

                <tr key={item.id}>

                  <td>
                    Nº {item.numero}
                  </td>

                  <td>
                    {item.contratos?.numero || "-"}
                  </td>

                  <td>
                    {item.contratos?.nome || "-"}
                  </td>

                  <td>
                    {formatarData(
                      item.data_inicio
                    )}

                    {" até "}

                    {formatarData(
                      item.data_fim
                    )}
                  </td>

                  <td>
                    {mostrarStatus(item.status)}
                  </td>

                  <td>

                    <div className="medicoes-acoes">

                      <button
                        type="button"
                        onClick={() =>
                          abrirFotosMedicao(item)
                        }
                      >
                        📷 Ver fotos
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          editarMedicao(item)
                        }
                      >
                        Editar
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          excluirMedicao(item.id)
                        }
                      >
                        Excluir
                      </button>

                    </div>

                  </td>

                </tr>

              ))

            )}

          </tbody>

        </table>

      </div>


      {/* =================================================
          MODAL NOVA / EDITAR MEDIÇÃO
      ================================================= */}

      <Modal
        aberto={modalAberto}
        titulo={
          medicao.id
            ? "Editar Medição"
            : "Nova Medição"
        }
        onClose={() => {
          if (!salvando) {
            setModalAberto(false);
          }
        }}
      >

        <form
          className="form-medicao"
          onSubmit={salvarMedicao}
        >

          {/* ---------------------------------------------
              CONTRATO
          --------------------------------------------- */}

          <div className="campo-medicao">

            <label>
              Contrato
            </label>

            <select
              value={medicao.contrato_id}
              onChange={(e) =>
                alterarContrato(
                  e.target.value
                )
              }
              disabled={salvando}
            >

              <option value="">
                Selecione o contrato
              </option>

              {contratos.map((item) => (

                <option
                  key={item.id}
                  value={item.id}
                >
                  {item.numero} - {item.nome}
                </option>

              ))}

            </select>

          </div>


          {/* ---------------------------------------------
              NÚMERO + STATUS
          --------------------------------------------- */}

          <div className="linha-medicao">

            <div className="campo-medicao">

              <label>
                Nº da Medição
              </label>

              <input
                type="number"
                min="1"
                value={medicao.numero}
                onChange={(e) =>
                  setMedicao({
                    ...medicao,
                    numero: e.target.value,
                  })
                }
                disabled={salvando}
              />

            </div>


            <div className="campo-medicao">

              <label>
                Status
              </label>

              <select
                value={medicao.status}
                onChange={(e) =>
                  setMedicao({
                    ...medicao,
                    status:
                      e.target.value,
                  })
                }
                disabled={salvando}
              >

                <option value="em_andamento">
                  Em andamento
                </option>

                <option value="fechada">
                  Fechada
                </option>

              </select>

            </div>

          </div>


          {/* ---------------------------------------------
              DATAS
          --------------------------------------------- */}

          <div className="linha-medicao">

            <div className="campo-medicao">

              <label>
                Data inicial
              </label>

              <input
                type="date"
                value={
                  medicao.data_inicio
                }
                onChange={(e) =>
                  setMedicao({
                    ...medicao,
                    data_inicio:
                      e.target.value,
                  })
                }
                disabled={salvando}
              />

            </div>


            <div className="campo-medicao">

              <label>
                Data final
              </label>

              <input
                type="date"
                value={
                  medicao.data_fim
                }
                onChange={(e) =>
                  setMedicao({
                    ...medicao,
                    data_fim:
                      e.target.value,
                  })
                }
                disabled={salvando}
              />

            </div>

          </div>


          {/* ---------------------------------------------
              FRENTES
          --------------------------------------------- */}

          <div className="campo-medicao">

            <label>
              Frentes desta medição
            </label>

            {carregandoFrentes ? (

              <div
                style={{
                  padding: "14px",
                  textAlign: "center",
                }}
              >
                Carregando frentes...
              </div>

            ) : !medicao.contrato_id ? (

              <div
                style={{
                  padding: "14px",
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  color: "#64748b",
                }}
              >
                Selecione um contrato para
                visualizar as frentes.
              </div>

            ) : frentesOrdenadas.length === 0 ? (

              <div
                style={{
                  padding: "14px",
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  color: "#64748b",
                }}
              >
                Este contrato não possui
                frentes cadastradas.
              </div>

            ) : (

              <div
                style={{
                  border: "1px solid #d7dce5",
                  borderRadius: "8px",
                  overflow: "hidden",
                }}
              >

                <div
                  style={{
                    display: "flex",
                    justifyContent:
                      "space-between",
                    alignItems: "center",
                    padding: "10px 12px",
                    background: "#f8fafc",
                    borderBottom:
                      "1px solid #e2e8f0",
                    gap: "10px",
                    flexWrap: "wrap",
                  }}
                >

                  <strong>
                    {frentesSelecionadas.length}{" "}
                    de {frentesOrdenadas.length}{" "}
                    selecionada(s)
                  </strong>

                  <div
                    style={{
                      display: "flex",
                      gap: "6px",
                    }}
                  >

                    <button
                      type="button"
                      onClick={
                        selecionarTodasFrentes
                      }
                      disabled={salvando}
                      style={{
                        padding:
                          "6px 10px",
                        border:
                          "1px solid #cbd5e1",
                        borderRadius:
                          "6px",
                        background:
                          "#fff",
                        cursor:
                          "pointer",
                      }}
                    >
                      Selecionar todas
                    </button>

                    <button
                      type="button"
                      onClick={
                        desmarcarTodasFrentes
                      }
                      disabled={salvando}
                      style={{
                        padding:
                          "6px 10px",
                        border:
                          "1px solid #cbd5e1",
                        borderRadius:
                          "6px",
                        background:
                          "#fff",
                        cursor:
                          "pointer",
                      }}
                    >
                      Desmarcar todas
                    </button>

                  </div>

                </div>


                <div
                  style={{
                    padding: "8px",
                    display: "flex",
                    flexDirection:
                      "column",
                    gap: "6px",
                  }}
                >

                  {frentesOrdenadas.map(
                    (frente) => {

                      const selecionada =
                        frentesSelecionadas.includes(
                          Number(frente.id)
                        );

                      const arquivada =
                        (frente.status ||
                          "ativo") ===
                        "arquivado";

                      return (

                        <label
                          key={frente.id}
                          style={{
                            display: "flex",
                            alignItems:
                              "center",
                            gap: "10px",
                            padding:
                              "10px 12px",
                            border:
                              selecionada
                                ? "1px solid #2563eb"
                                : "1px solid #e2e8f0",
                            borderRadius:
                              "7px",
                            background:
                              selecionada
                                ? "#eff6ff"
                                : "#fff",
                            cursor:
                              salvando
                                ? "default"
                                : "pointer",
                            opacity:
                              arquivada
                                ? 0.7
                                : 1,
                          }}
                        >

                          <input
                            type="checkbox"
                            checked={
                              selecionada
                            }
                            onChange={() =>
                              alternarFrente(
                                frente.id
                              )
                            }
                            disabled={
                              salvando
                            }
                          />

                          <span
                            style={{
                              flex: 1,
                              fontWeight:
                                selecionada
                                  ? 600
                                  : 500,
                            }}
                          >
                            {frente.nome}
                          </span>

                          {arquivada && (
                            <span
                              style={{
                                fontSize:
                                  "12px",
                                color:
                                  "#b45309",
                              }}
                            >
                              Arquivada
                            </span>
                          )}

                        </label>

                      );
                    }
                  )}

                </div>

              </div>

            )}

          </div>


          {/* ---------------------------------------------
              OBSERVAÇÃO
          --------------------------------------------- */}

          <div className="campo-medicao">

            <label>
              Observação
            </label>

            <textarea
              value={
                medicao.observacao
              }
              onChange={(e) =>
                setMedicao({
                  ...medicao,
                  observacao:
                    e.target.value,
                })
              }
              placeholder="Observações da medição..."
              rows="4"
              disabled={salvando}
            />

          </div>


          {/* ---------------------------------------------
              BOTÕES
          --------------------------------------------- */}

          <div
            style={{
              display: "flex",
              justifyContent:
                "flex-end",
              gap: "10px",
              marginTop: "10px",
            }}
          >

            <button
              type="button"
              onClick={() =>
                setModalAberto(false)
              }
              disabled={salvando}
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={salvando}
            >
              {salvando
                ? "Salvando..."
                : "Salvar"}
            </button>

          </div>

        </form>

      </Modal>


      {/* =================================================
          MODAL DE FOTOS
      ================================================= */}

      {modalFotosAberto && (

        <div
          style={{
            position: "fixed",
            inset: 0,
            background:
              "rgba(0,0,0,0.65)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >

          <div
            style={{
              width: "min(1100px, 96vw)",
              maxHeight: "92vh",
              background: "#fff",
              borderRadius: "12px",
              overflow: "hidden",
              display: "flex",
              flexDirection:
                "column",
              boxShadow:
                "0 20px 60px rgba(0,0,0,0.3)",
            }}
          >

            {/* -------------------------------------------
                CABEÇALHO
            ------------------------------------------- */}

            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems: "center",
                padding:
                  "18px 22px",
                borderBottom:
                  "1px solid #e5e7eb",
              }}
            >

              <div>

                <h2
                  style={{
                    margin: 0,
                    fontSize:
                      "22px",
                  }}
                >
                  Fotos — Medição{" "}
                  {medicaoFotosAtual?.numero}
                </h2>

              </div>

              <button
                type="button"
                onClick={
                  fecharModalFotos
                }
                style={{
                  border: "none",
                  background:
                    "transparent",
                  fontSize:
                    "26px",
                  cursor:
                    "pointer",
                  lineHeight: 1,
                }}
              >
                ×
              </button>

            </div>


            {/* -------------------------------------------
                CONTEÚDO
            ------------------------------------------- */}

            <div
              style={{
                overflowY:
                  "auto",
                padding:
                  "22px",
              }}
            >

              {/* -----------------------------------------
                  INFORMAÇÕES
              ----------------------------------------- */}

              <div
                style={{
                  background:
                    "#f1f5f9",
                  borderRadius:
                    "8px",
                  padding:
                    "16px",
                  marginBottom:
                    "20px",
                  textAlign:
                    "center",
                }}
              >

                <div
                  style={{
                    fontWeight:
                      700,
                    color:
                      "#475569",
                  }}
                >
                  Contrato:{" "}
                  {
                    medicaoFotosAtual
                      ?.contratos
                      ?.numero
                  }
                </div>

                <div
                  style={{
                    marginTop:
                      "4px",
                    color:
                      "#64748b",
                  }}
                >
                  {
                    medicaoFotosAtual
                      ?.contratos
                      ?.nome
                  }
                </div>

                <div
                  style={{
                    marginTop:
                      "8px",
                    color:
                      "#64748b",
                  }}
                >
                  Medição Nº{" "}
                  {
                    medicaoFotosAtual
                      ?.numero
                  }
                </div>

              </div>


              {/* -----------------------------------------
                  CARREGANDO
              ----------------------------------------- */}

              {carregandoFotos && (

                <div
                  style={{
                    padding:
                      "40px",
                    textAlign:
                      "center",
                    color:
                      "#64748b",
                  }}
                >
                  <div
                    style={{
                      fontSize:
                        "18px",
                      fontWeight:
                        600,
                    }}
                  >
                    Consultando Google Drive...
                  </div>

                  <div
                    style={{
                      marginTop:
                        "8px",
                      fontSize:
                        "14px",
                    }}
                  >
                    Procurando as fotos
                    da Medição{" "}
                    {
                      medicaoFotosAtual
                        ?.numero
                    }
                    .
                  </div>

                </div>

              )}


              {/* -----------------------------------------
                  ERRO GERAL
              ----------------------------------------- */}

              {!carregandoFotos &&
                erroFotos && (

                  <div
                    style={{
                      padding:
                        "14px",
                      border:
                        "1px solid #fdba74",
                      background:
                        "#fff7ed",
                      color:
                        "#c2410c",
                      borderRadius:
                        "8px",
                      marginBottom:
                        "16px",
                      whiteSpace:
                        "pre-line",
                    }}
                  >
                    {erroFotos}
                  </div>

                )}


              {/* -----------------------------------------
                  RESULTADOS POR FRENTE
              ----------------------------------------- */}

              {!carregandoFotos &&
                Object.keys(
                  fotosPorFrente
                ).length > 0 && (

                  <div
                    style={{
                      display:
                        "flex",
                      flexDirection:
                        "column",
                      gap:
                        "28px",
                    }}
                  >

                    {Object.values(
                      fotosPorFrente
                    ).map(
                      (resultado) => {

                        const fotos =
                          resultado.fotos ||
                          [];

                        const videos =
                          resultado.videos ||
                          [];

                        const quantidade =
                          resultado.quantidade ||
                          {};

                        return (

                          <section
                            key={
                              resultado
                                .frente
                                .id
                            }
                            style={{
                              border:
                                "1px solid #e2e8f0",
                              borderRadius:
                                "10px",
                              padding:
                                "16px",
                            }}
                          >

                            {/* -------------------------
                                CABEÇALHO FRENTE
                            ------------------------- */}

                            <div
                              style={{
                                display:
                                  "flex",
                                justifyContent:
                                  "space-between",
                                alignItems:
                                  "center",
                                gap:
                                  "12px",
                                flexWrap:
                                  "wrap",
                                marginBottom:
                                  "14px",
                              }}
                            >

                              <div>

                                <h3
                                  style={{
                                    margin:
                                      0,
                                    fontSize:
                                      "19px",
                                    color:
                                      "#475569",
                                  }}
                                >
                                  {
                                    resultado
                                      .frente
                                      .nome
                                  }
                                </h3>

                                {resultado.pastaMedicao && (

                                  <div
                                    style={{
                                      marginTop:
                                        "5px",
                                      fontSize:
                                        "13px",
                                      color:
                                        "#64748b",
                                    }}
                                  >
                                    Pasta:{" "}
                                    {
                                      resultado
                                        .pastaMedicao
                                        .nome
                                    }
                                  </div>

                                )}

                              </div>


                              <div
                                style={{
                                  fontSize:
                                    "13px",
                                  color:
                                    "#64748b",
                                }}
                              >
                                {quantidade.fotos ||
                                  fotos.length ||
                                  0}{" "}
                                fotos •{" "}
                                {quantidade.videos ||
                                  videos.length ||
                                  0}{" "}
                                vídeos
                              </div>

                            </div>


                            {/* -------------------------
                                ERRO DA FRENTE
                            ------------------------- */}

                            {!resultado.ok && (

                              <div
                                style={{
                                  padding:
                                    "12px",
                                  background:
                                    "#fff7ed",
                                  border:
                                    "1px solid #fdba74",
                                  color:
                                    "#c2410c",
                                  borderRadius:
                                    "8px",
                                  marginBottom:
                                    "10px",
                                }}
                              >
                                {
                                  resultado.erro
                                }
                              </div>

                            )}


                            {/* -------------------------
                                PASTA NÃO ENCONTRADA
                            ------------------------- */}

                            {resultado.ok &&
                              resultado.encontrada ===
                                false && (

                                <div
                                  style={{
                                    padding:
                                      "12px",
                                    background:
                                      "#f8fafc",
                                    border:
                                      "1px solid #cbd5e1",
                                    color:
                                      "#475569",
                                    borderRadius:
                                      "8px",
                                  }}
                                >
                                  A pasta da
                                  Medição{" "}
                                  {
                                    medicaoFotosAtual
                                      ?.numero
                                  }{" "}
                                  não foi
                                  encontrada
                                  dentro da
                                  pasta de
                                  fotos desta
                                  frente.
                                </div>

                              )}


                            {/* -------------------------
                                FOTOS
                            ------------------------- */}

                            {resultado.ok &&
                              fotos.length >
                                0 && (

                                <div>

                                  <h4
                                    style={{
                                      margin:
                                        "14px 0 10px",
                                      color:
                                        "#475569",
                                    }}
                                  >
                                    Fotos
                                  </h4>

                                  <div
                                    style={{
                                      display:
                                        "grid",
                                      gridTemplateColumns:
                                        "repeat(auto-fill, minmax(150px, 1fr))",
                                      gap:
                                        "10px",
                                    }}
                                  >

                                    {fotos.map(
                                      (
                                        arquivo
                                      ) => {

                                        const url =
                                          obterUrlImagem(
                                            arquivo
                                          );

                                        return (

                                          <button
                                            type="button"
                                            key={
                                              arquivo.id
                                            }
                                            onClick={() =>
                                              setFotoAmpliada(
                                                {
                                                  ...arquivo,
                                                  url,
                                                }
                                              )
                                            }
                                            style={{
                                              padding:
                                                0,
                                              border:
                                                "1px solid #e2e8f0",
                                              borderRadius:
                                                "8px",
                                              overflow:
                                                "hidden",
                                              background:
                                                "#f8fafc",
                                              cursor:
                                                "pointer",
                                              aspectRatio:
                                                "1 / 1",
                                            }}
                                          >

                                            <img
                                              src={
                                                url
                                              }
                                              alt={
                                                arquivo.nome ||
                                                "Foto"
                                              }
                                              loading="lazy"
                                              style={{
                                                width:
                                                  "100%",
                                                height:
                                                  "100%",
                                                objectFit:
                                                  "cover",
                                                display:
                                                  "block",
                                              }}
                                            />

                                          </button>

                                        );
                                      }
                                    )}

                                  </div>

                                </div>

                              )}


                            {/* -------------------------
                                VÍDEOS
                            ------------------------- */}

                            {resultado.ok &&
                              videos.length >
                                0 && (

                                <div
                                  style={{
                                    marginTop:
                                      "18px",
                                  }}
                                >

                                  <h4
                                    style={{
                                      margin:
                                        "0 0 10px",
                                      color:
                                        "#475569",
                                    }}
                                  >
                                    Vídeos
                                  </h4>

                                  <div
                                    style={{
                                      display:
                                        "flex",
                                      flexDirection:
                                        "column",
                                      gap:
                                        "8px",
                                    }}
                                  >

                                    {videos.map(
                                      (
                                        video
                                      ) => (

                                        <a
                                          key={
                                            video.id
                                          }
                                          href={obterUrlArquivo(
                                            video
                                          )}
                                          target="_blank"
                                          rel="noreferrer"
                                          style={{
                                            padding:
                                              "10px 12px",
                                            border:
                                              "1px solid #e2e8f0",
                                            borderRadius:
                                              "7px",
                                            color:
                                              "#2563eb",
                                            textDecoration:
                                              "none",
                                          }}
                                        >
                                          ▶{" "}
                                          {
                                            video.nome
                                          }
                                        </a>

                                      )
                                    )}

                                  </div>

                                </div>

                              )}


                            {/* -------------------------
                                SEM ARQUIVOS
                            ------------------------- */}

                            {resultado.ok &&
                              resultado.encontrada !==
                                false &&
                              fotos.length ===
                                0 &&
                              videos.length ===
                                0 && (

                                <div
                                  style={{
                                    padding:
                                      "14px",
                                    color:
                                      "#64748b",
                                    background:
                                      "#f8fafc",
                                    borderRadius:
                                      "8px",
                                  }}
                                >
                                  Nenhum arquivo
                                  encontrado
                                  nesta pasta
                                  da medição.
                                </div>

                              )}

                          </section>

                        );
                      }
                    )}

                  </div>

                )}

            </div>

          </div>

        </div>

      )}


      {/* =================================================
          FOTO AMPLIADA
      ================================================= */}

      {fotoAmpliada && (

        <div
          onClick={() =>
            setFotoAmpliada(null)
          }
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10000,
            background:
              "rgba(0,0,0,0.9)",
            display: "flex",
            alignItems:
              "center",
            justifyContent:
              "center",
            padding: "20px",
            cursor:
              "zoom-out",
          }}
        >

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setFotoAmpliada(null);
            }}
            style={{
              position:
                "absolute",
              top: "18px",
              right: "22px",
              border: "none",
              background:
                "rgba(255,255,255,0.15)",
              color: "#fff",
              fontSize:
                "30px",
              width: "44px",
              height: "44px",
              borderRadius:
                "50%",
              cursor:
                "pointer",
            }}
          >
            ×
          </button>


          <div
            onClick={(e) =>
              e.stopPropagation()
            }
            style={{
              maxWidth:
                "95vw",
              maxHeight:
                "92vh",
              display:
                "flex",
              flexDirection:
                "column",
              alignItems:
                "center",
              gap: "10px",
            }}
          >

            <img
              src={
                fotoAmpliada.url
              }
              alt={
                fotoAmpliada.nome ||
                "Foto ampliada"
              }
              style={{
                maxWidth:
                  "95vw",
                maxHeight:
                  "82vh",
                objectFit:
                  "contain",
                borderRadius:
                  "6px",
              }}
            />

            <div
              style={{
                color: "#fff",
                fontSize:
                  "13px",
                textAlign:
                  "center",
                maxWidth:
                  "90vw",
                wordBreak:
                  "break-word",
              }}
            >
              {
                fotoAmpliada.nome
              }
            </div>

          </div>

        </div>

      )}

    </div>
  );
}