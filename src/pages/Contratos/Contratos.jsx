import { useEffect, useState } from "react";

import "./Contratos.css";

import Modal from "../../components/Modal/Modal";
import ContratoForm from "../../components/ContratoForm/ContratoForm";

import { supabase } from "../../services/supabase";

export default function Contratos() {
  const [modalAberto, setModalAberto] = useState(false);

  const [contratos, setContratos] = useState([]);
  const [contratosFiltrados, setContratosFiltrados] = useState([]);

  const [pesquisa, setPesquisa] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("ativo");

  const [editando, setEditando] = useState(false);

  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const [contrato, setContrato] = useState({
    id: null,
    numero: "",
    nome: "",
    cliente: "",
    cidade: "",
    uf: "SC",
    status: "Ativo",
  });

  // =====================================================
  // NORMALIZAR STATUS
  // =====================================================

  function normalizarStatus(status) {
    const valor = String(status || "")
      .trim()
      .toLowerCase();

    if (valor === "ativo") {
      return "ativo";
    }

    if (valor === "encerrado") {
      return "encerrado";
    }

    if (valor === "suspenso") {
      return "suspenso";
    }

    return "ativo";
  }

  function mostrarStatus(status) {
    const valor = normalizarStatus(status);

    if (valor === "ativo") {
      return "Ativo";
    }

    if (valor === "encerrado") {
      return "Encerrado";
    }

    if (valor === "suspenso") {
      return "Suspenso";
    }

    return "Ativo";
  }

  // =====================================================
  // CARREGAR CONTRATOS
  // =====================================================

  async function carregarContratos() {
    setCarregando(true);

    const { data, error } = await supabase
      .from("contratos")
      .select("*")
      .order("id", { ascending: false });

    if (error) {
      console.error("Erro ao carregar contratos:", error);
      alert("Não foi possível carregar os contratos.");
      setCarregando(false);
      return;
    }

    setContratos(data || []);
    setContratosFiltrados(data || []);

    setCarregando(false);
  }

  useEffect(() => {
    carregarContratos();
  }, []);

  // =====================================================
  // PESQUISA + FILTRO DE STATUS
  // =====================================================

  useEffect(() => {
    const texto = pesquisa.toLowerCase().trim();

    const filtrados = contratos.filter((item) => {
      const correspondePesquisa =
        (item.numero || "").toLowerCase().includes(texto) ||
        (item.nome || "").toLowerCase().includes(texto) ||
        (item.cliente || "").toLowerCase().includes(texto) ||
        (item.cidade || "").toLowerCase().includes(texto);

      const status = normalizarStatus(item.status);

      const correspondeStatus =
        filtroStatus === "todos" || status === filtroStatus;

      return correspondePesquisa && correspondeStatus;
    });

    setContratosFiltrados(filtrados);
  }, [pesquisa, filtroStatus, contratos]);

  // =====================================================
  // ATUALIZAR CAMPO
  // =====================================================

  function atualizarCampo(campo, valor) {
    setContrato((anterior) => ({
      ...anterior,
      [campo]: valor,
    }));
  }

  // =====================================================
  // NOVO CONTRATO
  // =====================================================

  function novoContrato() {
    setContrato({
      id: null,
      numero: "",
      nome: "",
      cliente: "",
      cidade: "",
      uf: "SC",
      status: "Ativo",
    });

    setEditando(false);
    setModalAberto(true);
  }

  // =====================================================
  // EDITAR CONTRATO
  // =====================================================

  function editarContrato(item) {
    setContrato({
      id: item.id,
      numero: item.numero || "",
      nome: item.nome || "",
      cliente: item.cliente || "",
      cidade: item.cidade || "",
      uf: item.uf || "SC",
      status: mostrarStatus(item.status),
    });

    setEditando(true);
    setModalAberto(true);
  }

  // =====================================================
  // SALVAR CONTRATO
  // =====================================================

  async function salvarContrato(evento) {
    evento.preventDefault();

    if (!contrato.numero.trim()) {
      alert("Preencha o Número do Contrato.");
      return;
    }

    if (!contrato.nome.trim()) {
      alert("Preencha o Nome da Obra.");
      return;
    }

    if (!contrato.cliente.trim()) {
      alert("Preencha o Cliente.");
      return;
    }

    setSalvando(true);

    const dados = {
      numero: contrato.numero.trim(),
      nome: contrato.nome.trim(),
      cliente: contrato.cliente.trim(),
      cidade: contrato.cidade?.trim() || "",
      uf: contrato.uf || "SC",

      // O banco exige os valores em minúsculo
      status: normalizarStatus(contrato.status),
    };

    try {
      // ===================================================
      // EDITAR
      // ===================================================

      if (editando) {
        const { error } = await supabase
          .from("contratos")
          .update(dados)
          .eq("id", contrato.id);

        if (error) {
          console.error("Erro ao editar contrato:", error);

          alert(
            `Não foi possível atualizar o contrato.\n\n${error.message}`
          );

          return;
        }
      }

      // ===================================================
      // NOVO
      // ===================================================

      else {
        const { error } = await supabase
          .from("contratos")
          .insert([dados]);

        if (error) {
          console.error("Erro ao criar contrato:", error);

          alert(
            `Não foi possível criar o contrato.\n\n${error.message}`
          );

          return;
        }
      }

      await carregarContratos();

      setModalAberto(false);

      setContrato({
        id: null,
        numero: "",
        nome: "",
        cliente: "",
        cidade: "",
        uf: "SC",
        status: "Ativo",
      });

      setEditando(false);
    } finally {
      setSalvando(false);
    }
  }

  // =====================================================
  // INATIVAR / REATIVAR CONTRATO
  // =====================================================

  async function alterarStatusContrato(item) {
    const statusAtual = normalizarStatus(item.status);

    const novoStatus =
      statusAtual === "ativo" ? "encerrado" : "ativo";

    const acao =
      novoStatus === "encerrado" ? "inativar" : "reativar";

    const confirmar = window.confirm(
      novoStatus === "encerrado"
        ? `Deseja inativar o contrato "${item.numero} - ${item.nome}"?\n\nO contrato não será excluído. Ele permanecerá no sistema para preservar o histórico.`
        : `Deseja reativar o contrato "${item.numero} - ${item.nome}"?`
    );

    if (!confirmar) {
      return;
    }

    const { error } = await supabase
      .from("contratos")
      .update({
        status: novoStatus,
      })
      .eq("id", item.id);

    if (error) {
      console.error(`Erro ao ${acao} contrato:`, error);

      alert(
        `Não foi possível ${acao} o contrato.\n\n${error.message}`
      );

      return;
    }

    await carregarContratos();
  }

  // =====================================================
  // EXCLUIR CONTRATO
  // =====================================================

  async function excluirContrato(id) {
    const confirmar = window.confirm(
      "Deseja realmente excluir este contrato?\n\nEsta ação não poderá ser desfeita."
    );

    if (!confirmar) {
      return;
    }

    const { error } = await supabase
      .from("contratos")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Erro ao excluir contrato:", error);

      alert(
        `Não foi possível excluir o contrato.\n\n${error.message}`
      );

      return;
    }

    await carregarContratos();
  }

  // =====================================================
  // TELA
  // =====================================================

  return (
    <div className="contratos-page">

      <div className="topo">

        <div>
          <h1>Contratos</h1>

          <p>
            Gerencie todos os contratos cadastrados.
          </p>
        </div>

        <button
          className="novo-btn"
          onClick={novoContrato}
        >
          + Novo Contrato
        </button>

      </div>

      <div className="filtros-contratos">

        <input
          type="text"
          placeholder="Pesquisar contrato..."
          value={pesquisa}
          onChange={(e) => setPesquisa(e.target.value)}
        />

        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
        >
          <option value="ativo">Ativos</option>
          <option value="encerrado">Encerrados</option>
          <option value="suspenso">Suspensos</option>
          <option value="todos">Todos</option>
        </select>

      </div>

      <div className="tabela-container">

        <table className="tabela">

          <thead>

            <tr>
              <th>Nº Contrato</th>
              <th>Nome da Obra</th>
              <th>Cliente</th>
              <th>Cidade</th>
              <th>UF</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>

          </thead>

          <tbody>

            {carregando ? (

              <tr>
                <td colSpan="7" className="vazio">
                  Carregando contratos...
                </td>
              </tr>

            ) : contratosFiltrados.length === 0 ? (

              <tr>
                <td colSpan="7" className="vazio">
                  Nenhum contrato encontrado.
                </td>
              </tr>

            ) : (

              contratosFiltrados.map((item) => {

                const status = normalizarStatus(item.status);

                return (
                  <tr key={item.id}>

                    <td>
                      {item.numero}
                    </td>

                    <td>
                      {item.nome}
                    </td>

                    <td>
                      {item.cliente}
                    </td>

                    <td>
                      {item.cidade || "-"}
                    </td>

                    <td>
                      {item.uf || "-"}
                    </td>

                    <td>
                      {mostrarStatus(item.status)}
                    </td>

                    <td>

                      <div className="acoes-contrato">

                        <button
                          type="button"
                          onClick={() => editarContrato(item)}
                        >
                          Editar
                        </button>

                        {status === "ativo" ? (

                          <button
                            type="button"
                            onClick={() => alterarStatusContrato(item)}
                          >
                            Inativar
                          </button>

                        ) : status === "encerrado" ? (

                          <button
                            type="button"
                            onClick={() => alterarStatusContrato(item)}
                          >
                            Reativar
                          </button>

                        ) : (

                          <button
                            type="button"
                            onClick={() => alterarStatusContrato(item)}
                          >
                            Ativar
                          </button>

                        )}

                        <button
                          type="button"
                          onClick={() => excluirContrato(item.id)}
                        >
                          Excluir
                        </button>

                      </div>

                    </td>

                  </tr>
                );
              })

            )}

          </tbody>

        </table>

      </div>

      <Modal
        aberto={modalAberto}
        titulo={
          editando
            ? "Editar Contrato"
            : "Novo Contrato"
        }
        onClose={() => {
          if (!salvando) {
            setModalAberto(false);
          }
        }}
      >

        <ContratoForm
          contrato={contrato}
          atualizarCampo={atualizarCampo}
          onCancelar={() => {
            if (!salvando) {
              setModalAberto(false);
            }
          }}
          onSalvar={salvarContrato}
          salvando={salvando}
        />

      </Modal>

    </div>
  );
}