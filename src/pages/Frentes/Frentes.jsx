import { useEffect, useMemo, useState } from "react";
import "./Frentes.css";
import { supabase } from "../../services/supabase";

export default function Frentes() {
  const [contratos, setContratos] = useState([]);
  const [contratoSelecionado, setContratoSelecionado] = useState("");

  const [frentes, setFrentes] = useState([]);
  const [filtroStatus, setFiltroStatus] = useState("ativo");

  const [nome, setNome] = useState("");
  const [editandoId, setEditandoId] = useState(null);

  const [transferindoId, setTransferindoId] = useState(null);
  const [novoContratoId, setNovoContratoId] = useState("");

  const [carregandoContratos, setCarregandoContratos] = useState(true);
  const [carregandoFrentes, setCarregandoFrentes] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [transferindo, setTransferindo] = useState(false);
  const [alterandoStatus, setAlterandoStatus] = useState(false);

  async function carregarContratos() {
    setCarregandoContratos(true);

    const { data, error } = await supabase
      .from("contratos")
      .select("id, numero, nome")
      .order("id", { ascending: false });

    if (error) {
      console.error("Erro ao carregar contratos:", error);
      alert(`Não foi possível carregar os contratos.\n\n${error.message}`);
      setCarregandoContratos(false);
      return;
    }

    const lista = data || [];
    setContratos(lista);

    if (lista.length > 0 && !contratoSelecionado) {
      setContratoSelecionado(String(lista[0].id));
    }

    setCarregandoContratos(false);
  }

  async function carregarFrentes(contratoId) {
    if (!contratoId) {
      setFrentes([]);
      return;
    }

    setCarregandoFrentes(true);

    const { data, error } = await supabase
      .from("frentes")
      .select("*")
      .eq("contrato_id", Number(contratoId))
      .order("ordem", { ascending: true });

    if (error) {
      console.error("Erro ao carregar frentes:", error);
      alert(`Não foi possível carregar as frentes.\n\n${error.message}`);
      setFrentes([]);
      setCarregandoFrentes(false);
      return;
    }

    setFrentes(data || []);
    setCarregandoFrentes(false);
  }

  useEffect(() => {
    carregarContratos();
  }, []);

  useEffect(() => {
    carregarFrentes(contratoSelecionado);
    setEditandoId(null);
    setNome("");
    setTransferindoId(null);
    setNovoContratoId("");
  }, [contratoSelecionado]);

  const frentesAtivas = useMemo(
    () => frentes.filter((frente) => (frente.status || "ativo") === "ativo"),
    [frentes]
  );

  const frentesArquivadas = useMemo(
    () => frentes.filter((frente) => frente.status === "arquivado"),
    [frentes]
  );

  const frentesVisiveis = useMemo(() => {
    if (filtroStatus === "arquivado") {
      return frentesArquivadas;
    }

    if (filtroStatus === "todos") {
      return frentes;
    }

    return frentesAtivas;
  }, [filtroStatus, frentes, frentesAtivas, frentesArquivadas]);

  async function adicionarOuSalvarFrente(evento) {
    evento.preventDefault();

    if (!contratoSelecionado) {
      alert("Selecione um contrato.");
      return;
    }

    if (!nome.trim()) {
      alert("Informe o nome da frente/obra.");
      return;
    }

    setSalvando(true);

    try {
      if (editandoId) {
        const { error } = await supabase
          .from("frentes")
          .update({
            nome: nome.trim(),
          })
          .eq("id", editandoId);

        if (error) {
          console.error("Erro ao editar frente:", error);
          alert(`Não foi possível atualizar a frente.\n\n${error.message}`);
          return;
        }
      } else {
        const novaOrdem =
          frentesAtivas.length > 0
            ? Math.max(...frentesAtivas.map((item) => Number(item.ordem))) + 1
            : 1;

        const { error } = await supabase.from("frentes").insert([
          {
            contrato_id: Number(contratoSelecionado),
            nome: nome.trim(),
            ordem: novaOrdem,
            status: "ativo",
          },
        ]);

        if (error) {
          console.error("Erro ao criar frente:", error);
          alert(`Não foi possível criar a frente.\n\n${error.message}`);
          return;
        }
      }

      setNome("");
      setEditandoId(null);
      await carregarFrentes(contratoSelecionado);
    } finally {
      setSalvando(false);
    }
  }

  function iniciarEdicao(frente) {
    if ((frente.status || "ativo") === "arquivado") {
      alert("Reative a frente antes de editá-la.");
      return;
    }

    setEditandoId(frente.id);
    setNome(frente.nome || "");
    setTransferindoId(null);
    setNovoContratoId("");
  }

  function cancelarEdicao() {
    setEditandoId(null);
    setNome("");
  }

  function iniciarTransferencia(frente) {
    setEditandoId(null);
    setNome("");
    setTransferindoId(frente.id);
    setNovoContratoId("");
  }

  function cancelarTransferencia() {
    setTransferindoId(null);
    setNovoContratoId("");
  }

  async function transferirFrente(frente) {
    if (!novoContratoId) {
      alert("Selecione o novo contrato.");
      return;
    }

    if (Number(novoContratoId) === Number(contratoSelecionado)) {
      alert("A frente já pertence a este contrato.");
      return;
    }

    const contratoDestino = contratos.find(
      (contrato) => Number(contrato.id) === Number(novoContratoId)
    );

    if (!contratoDestino) {
      alert("Contrato de destino não encontrado.");
      return;
    }

    const confirmar = window.confirm(
      `Deseja transferir a frente "${frente.nome}" para:\n\n` +
        `${contratoDestino.numero} - ${contratoDestino.nome}?\n\n` +
        "A frente continuará com os mesmos dados e status."
    );

    if (!confirmar) {
      return;
    }

    setTransferindo(true);

    try {
      const { data: frenteExistente, error: erroBusca } = await supabase
        .from("frentes")
        .select("id, nome")
        .eq("contrato_id", Number(novoContratoId))
        .eq("nome", frente.nome.trim())
        .maybeSingle();

      if (erroBusca) {
        console.error("Erro ao verificar frente no destino:", erroBusca);
        alert(
          `Não foi possível verificar o contrato de destino.\n\n${erroBusca.message}`
        );
        return;
      }

      if (frenteExistente) {
        alert(
          `O contrato de destino já possui uma frente chamada "${frente.nome}".\n\n` +
            "Renomeie uma das frentes antes de fazer a transferência."
        );
        return;
      }

      const { data: frentesDestino, error: erroDestino } = await supabase
        .from("frentes")
        .select("id, ordem, status")
        .eq("contrato_id", Number(novoContratoId))
        .eq("status", "ativo")
        .order("ordem", { ascending: true });

      if (erroDestino) {
        console.error("Erro ao carregar frentes do destino:", erroDestino);
        alert(
          `Não foi possível carregar as frentes do contrato de destino.\n\n${erroDestino.message}`
        );
        return;
      }

      const novaOrdem =
        frentesDestino && frentesDestino.length > 0
          ? Math.max(
              ...frentesDestino.map((item) => Number(item.ordem))
            ) + 1
          : 1;

      const ordemTemporaria =
        Math.max(
          0,
          ...frentesAtivas.map((item) => Number(item.ordem))
        ) + 1000;

      const { error: erroTemporario } = await supabase
        .from("frentes")
        .update({ ordem: ordemTemporaria })
        .eq("id", frente.id);

      if (erroTemporario) {
        console.error("Erro ao preparar transferência:", erroTemporario);
        alert(
          `Não foi possível preparar a transferência.\n\n${erroTemporario.message}`
        );
        return;
      }

      const { data: frentesAntigas, error: erroAntigas } = await supabase
        .from("frentes")
        .select("id, ordem")
        .eq("contrato_id", Number(contratoSelecionado))
        .eq("status", "ativo")
        .neq("id", frente.id)
        .order("ordem", { ascending: true });

      if (erroAntigas) {
        console.error("Erro ao reorganizar contrato antigo:", erroAntigas);
        alert(
          `Não foi possível reorganizar o contrato antigo.\n\n${erroAntigas.message}`
        );
        await carregarFrentes(contratoSelecionado);
        return;
      }

      for (let i = 0; i < (frentesAntigas || []).length; i++) {
        const { error: erroOrdem } = await supabase
          .from("frentes")
          .update({ ordem: i + 1 })
          .eq("id", frentesAntigas[i].id);

        if (erroOrdem) {
          console.error("Erro ao reorganizar frente:", erroOrdem);
          alert(
            `Não foi possível reorganizar as frentes.\n\n${erroOrdem.message}`
          );
          await carregarFrentes(contratoSelecionado);
          return;
        }
      }

      const { error: erroTransferencia } = await supabase
        .from("frentes")
        .update({
          contrato_id: Number(novoContratoId),
          ordem: novaOrdem,
        })
        .eq("id", frente.id);

      if (erroTransferencia) {
        console.error("Erro ao transferir frente:", erroTransferencia);
        alert(
          `Não foi possível transferir a frente.\n\n${erroTransferencia.message}`
        );
        await carregarFrentes(contratoSelecionado);
        return;
      }

      setTransferindoId(null);
      setNovoContratoId("");

      await carregarFrentes(contratoSelecionado);

      alert(`Frente "${frente.nome}" transferida com sucesso.`);
    } finally {
      setTransferindo(false);
    }
  }

  async function alterarStatusFrente(frente) {
    const statusAtual = frente.status || "ativo";
    const novoStatus = statusAtual === "arquivado" ? "ativo" : "arquivado";

    const acao = novoStatus === "arquivado" ? "arquivar" : "reativar";

    const confirmar = window.confirm(
      novoStatus === "arquivado"
        ? `Deseja arquivar a frente "${frente.nome}"?\n\n` +
            "Ela continuará registrada no sistema e no histórico, mas deixará de aparecer entre as frentes ativas."
        : `Deseja reativar a frente "${frente.nome}"?`
    );

    if (!confirmar) {
      return;
    }

    setAlterandoStatus(true);

    try {
      const { error } = await supabase
        .from("frentes")
        .update({
          status: novoStatus,
        })
        .eq("id", frente.id);

      if (error) {
        console.error(`Erro ao ${acao} frente:`, error);
        alert(
          `Não foi possível ${acao} a frente.\n\n${error.message}`
        );
        return;
      }

      if (novoStatus === "arquivado" && editandoId === frente.id) {
        cancelarEdicao();
      }

      if (transferindoId === frente.id) {
        cancelarTransferencia();
      }

      await reorganizarOrdemAtivas(false);

      alert(
        novoStatus === "arquivado"
          ? `Frente "${frente.nome}" arquivada com sucesso.`
          : `Frente "${frente.nome}" reativada com sucesso.`
      );
    } finally {
      setAlterandoStatus(false);
    }
  }

  async function excluirFrente(id) {
    const confirmar = window.confirm(
      "Deseja realmente excluir esta frente/obra?\n\n" +
        "Para preservar o histórico, prefira arquivar quando a frente já tiver sido utilizada."
    );

    if (!confirmar) {
      return;
    }

    const { error } = await supabase
      .from("frentes")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Erro ao excluir frente:", error);
      alert(`Não foi possível excluir a frente.\n\n${error.message}`);
      return;
    }

    await reorganizarOrdemAtivas();
  }

  async function reorganizarOrdemAtivas(recarregar = true) {
    if (!contratoSelecionado) {
      return;
    }

    const { data: lista, error } = await supabase
      .from("frentes")
      .select("id, ordem")
      .eq("contrato_id", Number(contratoSelecionado))
      .eq("status", "ativo")
      .order("ordem", { ascending: true });

    if (error) {
      console.error("Erro ao carregar ordem das frentes:", error);
      alert(
        `Não foi possível reorganizar as frentes.\n\n${error.message}`
      );
      return;
    }

    for (let i = 0; i < (lista || []).length; i++) {
      const { error: erroAtualizacao } = await supabase
        .from("frentes")
        .update({ ordem: i + 1 })
        .eq("id", lista[i].id);

      if (erroAtualizacao) {
        console.error("Erro ao reorganizar ordem:", erroAtualizacao);
        alert(
          `Não foi possível reorganizar a ordem.\n\n${erroAtualizacao.message}`
        );
        return;
      }
    }

    if (recarregar) {
      await carregarFrentes(contratoSelecionado);
    }
  }

  async function moverFrente(id, direcao) {
    const listaAtivas = frentesAtivas;

    const indice = listaAtivas.findIndex(
      (frente) => frente.id === id
    );

    if (indice === -1) {
      return;
    }

    const novoIndice = indice + direcao;

    if (
      novoIndice < 0 ||
      novoIndice >= listaAtivas.length
    ) {
      return;
    }

    const frenteAtual = listaAtivas[indice];
    const frenteDestino = listaAtivas[novoIndice];

    const ordemAtual = frenteAtual.ordem;
    const ordemDestino = frenteDestino.ordem;

    const ordemTemporaria =
      Math.max(
        0,
        ...listaAtivas.map((frente) => Number(frente.ordem))
      ) + 1000;

    const { error: erroTemporario } = await supabase
      .from("frentes")
      .update({ ordem: ordemTemporaria })
      .eq("id", frenteAtual.id);

    if (erroTemporario) {
      console.error("Erro ao preparar movimentação:", erroTemporario);
      alert(
        `Não foi possível mover a frente.\n\n${erroTemporario.message}`
      );
      return;
    }

    const { error: erroDestino } = await supabase
      .from("frentes")
      .update({ ordem: ordemAtual })
      .eq("id", frenteDestino.id);

    if (erroDestino) {
      console.error(
        "Erro ao mover frente de destino:",
        erroDestino
      );
      alert(
        `Não foi possível mover a frente.\n\n${erroDestino.message}`
      );
      await carregarFrentes(contratoSelecionado);
      return;
    }

    const { error: erroAtual } = await supabase
      .from("frentes")
      .update({ ordem: ordemDestino })
      .eq("id", frenteAtual.id);

    if (erroAtual) {
      console.error("Erro ao finalizar movimentação:", erroAtual);
      alert(
        `Não foi possível finalizar a movimentação.\n\n${erroAtual.message}`
      );
      await carregarFrentes(contratoSelecionado);
      return;
    }

    await carregarFrentes(contratoSelecionado);
  }

  return (
    <div className="frentes-page">
      <div className="frentes-topo">
        <div>
          <h1>Frentes / Obras</h1>
          <p>
            Cadastre e organize as frentes ou obras vinculadas a cada contrato.
          </p>
        </div>
      </div>

      <div className="frentes-cadastro">
        <h2>Contrato</h2>

        {carregandoContratos ? (
          <div className="frentes-vazio">
            <p>Carregando contratos...</p>
          </div>
        ) : contratos.length === 0 ? (
          <div className="frentes-vazio">
            <p>Nenhum contrato cadastrado.</p>
            <p>
              Cadastre um contrato antes de criar uma frente/obra.
            </p>
          </div>
        ) : (
          <select
            value={contratoSelecionado}
            onChange={(e) => setContratoSelecionado(e.target.value)}
          >
            {contratos.map((contrato) => (
              <option
                key={contrato.id}
                value={contrato.id}
              >
                {contrato.numero} - {contrato.nome}
              </option>
            ))}
          </select>
        )}
      </div>

      {contratos.length > 0 && (
        <div className="frentes-cadastro">
          <h2>
            {editandoId
              ? "Editar Frente / Obra"
              : "Nova Frente / Obra"}
          </h2>

          <form onSubmit={adicionarOuSalvarFrente}>
            <input
              type="text"
              placeholder="Ex.: ETA - Ingleses"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              disabled={salvando}
            />

            <button
              type="submit"
              disabled={salvando}
            >
              {salvando
                ? "Salvando..."
                : editandoId
                  ? "Salvar Alteração"
                  : "+ Adicionar Frente / Obra"}
            </button>

            {editandoId && (
              <button
                type="button"
                onClick={cancelarEdicao}
                disabled={salvando}
              >
                Cancelar
              </button>
            )}
          </form>
        </div>
      )}

      <div className="lista-frentes">
        <div className="frentes-lista-topo">
          <div>
            <h2>Frentes / Obras cadastradas</h2>
            <p>
              Ativas: {frentesAtivas.length} · Arquivadas:{" "}
              {frentesArquivadas.length}
            </p>
          </div>

          <div className="frentes-filtro">
            <label htmlFor="filtro-status-frentes">
              Exibir:
            </label>

            <select
              id="filtro-status-frentes"
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
            >
              <option value="ativo">Ativas</option>
              <option value="arquivado">Arquivadas</option>
              <option value="todos">Todas</option>
            </select>
          </div>
        </div>

        {carregandoFrentes ? (
          <div className="frentes-vazio">
            <p>Carregando frentes...</p>
          </div>
        ) : frentesVisiveis.length === 0 ? (
          <div className="frentes-vazio">
            <p>
              {filtroStatus === "arquivado"
                ? "Nenhuma frente arquivada para este contrato."
                : filtroStatus === "todos"
                  ? "Nenhuma frente/obra cadastrada para este contrato."
                  : "Nenhuma frente ativa para este contrato."}
            </p>
          </div>
        ) : (
          <div className="frentes-grid">
            {frentesVisiveis.map((frente) => {
              const arquivada = frente.status === "arquivado";
              const indiceAtiva = frentesAtivas.findIndex(
                (item) => item.id === frente.id
              );

              return (
                <div
                  className={`frente-card ${
                    arquivada ? "frente-card-arquivada" : ""
                  }`}
                  key={frente.id}
                >
                  <div className="frente-info">
                    <span>
                      {arquivada
                        ? "Frente / Obra arquivada"
                        : `Frente / Obra ${frente.ordem}`}
                    </span>

                    <h3>{frente.nome}</h3>
                  </div>

                  <div className="frente-acoes">
                    {!arquivada && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            moverFrente(frente.id, -1)
                          }
                          disabled={
                            indiceAtiva === 0 ||
                            salvando ||
                            transferindo ||
                            alterandoStatus
                          }
                          title="Subir"
                        >
                          ↑
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            moverFrente(frente.id, 1)
                          }
                          disabled={
                            indiceAtiva ===
                              frentesAtivas.length - 1 ||
                            salvando ||
                            transferindo ||
                            alterandoStatus
                          }
                          title="Descer"
                        >
                          ↓
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            iniciarEdicao(frente)
                          }
                          disabled={
                            salvando ||
                            transferindo ||
                            alterandoStatus
                          }
                        >
                          Editar
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      className={
                        arquivada
                          ? "frente-reativar"
                          : "frente-arquivar"
                      }
                      onClick={() =>
                        alterarStatusFrente(frente)
                      }
                      disabled={
                        salvando ||
                        transferindo ||
                        alterandoStatus
                      }
                    >
                      {arquivada ? "Reativar" : "Arquivar"}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        excluirFrente(frente.id)
                      }
                      disabled={
                        salvando ||
                        transferindo ||
                        alterandoStatus
                      }
                    >
                      Excluir
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        iniciarTransferencia(frente)
                      }
                      disabled={
                        salvando ||
                        transferindo ||
                        alterandoStatus
                      }
                    >
                      Mudar contrato
                    </button>
                  </div>

                  {transferindoId === frente.id && (
                    <div className="frente-transferencia">
                      <div className="frente-transferencia-linha">
                        <select
                          value={novoContratoId}
                          onChange={(e) =>
                            setNovoContratoId(e.target.value)
                          }
                          disabled={transferindo}
                        >
                          <option value="">
                            Selecione o novo contrato...
                          </option>

                          {contratos
                            .filter(
                              (contrato) =>
                                Number(contrato.id) !==
                                Number(contratoSelecionado)
                            )
                            .map((contrato) => (
                              <option
                                key={contrato.id}
                                value={contrato.id}
                              >
                                {contrato.numero} -{" "}
                                {contrato.nome}
                              </option>
                            ))}
                        </select>

                        <button
                          type="button"
                          onClick={() =>
                            transferirFrente(frente)
                          }
                          disabled={transferindo}
                        >
                          {transferindo
                            ? "Transferindo..."
                            : "Transferir"}
                        </button>

                        <button
                          type="button"
                          onClick={cancelarTransferencia}
                          disabled={transferindo}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
