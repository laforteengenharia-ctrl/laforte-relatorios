import { useEffect, useState } from "react";

import "./Medicoes.css";

import Modal from "../../components/Modal/Modal";

import { supabase } from "../../services/supabase";

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
      alert("Não foi possível carregar os contratos.");
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
      alert("Não foi possível carregar as medições.");
      setCarregando(false);
      return;
    }

    setMedicoes(data || []);
    setCarregando(false);
  }

  useEffect(() => {
    carregarContratos();
    carregarMedicoes();
  }, []);

  // =====================================================
  // NOVA MEDIÇÃO
  // =====================================================

  function novaMedicao() {
    setMedicao({
      id: null,
      contrato_id: "",
      numero: "",
      data_inicio: "",
      data_fim: "",
      status: "em_andamento",
      observacao: "",
    });

    setModalAberto(true);
  }

  // =====================================================
  // EDITAR MEDIÇÃO
  // =====================================================

  function editarMedicao(item) {
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
  }

  // =====================================================
  // SALVAR
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

    setSalvando(true);

    const dados = {
      contrato_id: Number(medicao.contrato_id),
      numero: Number(medicao.numero),
      data_inicio: medicao.data_inicio || null,
      data_fim: medicao.data_fim || null,
      status: medicao.status,
      observacao: medicao.observacao?.trim() || "",
    };

    try {
      let error;

      if (medicao.id) {
        const resposta = await supabase
          .from("medicoes")
          .update(dados)
          .eq("id", medicao.id);

        error = resposta.error;
      } else {
        const resposta = await supabase
          .from("medicoes")
          .insert([dados]);

        error = resposta.error;
      }

      if (error) {
        console.error("Erro ao salvar medição:", error);

        alert(
          `Não foi possível salvar a medição.\n\n${error.message}`
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
    } finally {
      setSalvando(false);
    }
  }

  // =====================================================
  // EXCLUIR
  // =====================================================

  async function excluirMedicao(id) {
    const confirmar = window.confirm(
      "Deseja realmente excluir esta medição?\n\nEsta ação não poderá ser desfeita."
    );

    if (!confirmar) {
      return;
    }

    const { error } = await supabase
      .from("medicoes")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Erro ao excluir medição:", error);

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
  // TELA
  // =====================================================

  return (
    <div className="medicoes-page">

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
                <td colSpan="6" className="medicoes-vazio">
                  Carregando medições...
                </td>
              </tr>

            ) : medicoes.length === 0 ? (

              <tr>
                <td colSpan="6" className="medicoes-vazio">
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
                    {formatarData(item.data_inicio)}
                    {" até "}
                    {formatarData(item.data_fim)}
                  </td>

                  <td>
                    {mostrarStatus(item.status)}
                  </td>

                  <td>

                    <div className="medicoes-acoes">

                      <button
                        type="button"
                        onClick={() => editarMedicao(item)}
                      >
                        Editar
                      </button>

                      <button
                        type="button"
                        onClick={() => excluirMedicao(item.id)}
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

          <div className="campo-medicao">

            <label>
              Contrato
            </label>

            <select
              value={medicao.contrato_id}
              onChange={(e) =>
                setMedicao({
                  ...medicao,
                  contrato_id: e.target.value,
                })
              }
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
                    status: e.target.value,
                  })
                }
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

          <div className="linha-medicao">

            <div className="campo-medicao">

              <label>
                Data inicial
              </label>

              <input
                type="date"
                value={medicao.data_inicio}
                onChange={(e) =>
                  setMedicao({
                    ...medicao,
                    data_inicio: e.target.value,
                  })
                }
              />

            </div>

            <div className="campo-medicao">

              <label>
                Data final
              </label>

              <input
                type="date"
                value={medicao.data_fim}
                onChange={(e) =>
                  setMedicao({
                    ...medicao,
                    data_fim: e.target.value,
                  })
                }
              />

            </div>

          </div>

          <div className="campo-medicao">

            <label>
              Observação
            </label>

            <textarea
              value={medicao.observacao}
              onChange={(e) =>
                setMedicao({
                  ...medicao,
                  observacao: e.target.value,
                })
              }
              rows="4"
              placeholder="Observações da medição..."
            />

          </div>

          <div className="botoes-medicao">

            <button
              type="button"
              className="cancelar-medicao"
              onClick={() => {
                if (!salvando) {
                  setModalAberto(false);
                }
              }}
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="salvar-medicao"
              disabled={salvando}
            >
              {salvando ? "Salvando..." : "Salvar"}
            </button>

          </div>

        </form>

      </Modal>

    </div>
  );
}