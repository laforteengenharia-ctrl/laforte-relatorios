import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../services/supabase";
import Modal from "../../components/Modal/Modal";
import "./Configuracoes.css";

// Divisores usados para estimar o custo de mão de obra por hora/dia a partir
// do "custo empresa" (salário + encargos) de um funcionário — conferidos
// contra a planilha que o usuário já usava (220h, 22 dias úteis e 30 dias
// corridos por mês batem exatamente com os valores que ela já calculava).
const HORAS_POR_MES = 220;
const DIAS_UTEIS_POR_MES = 22;
const DIAS_CORRIDOS_POR_MES = 30;

function formatarMoeda(valor) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(valor) || 0);
}

function dividirOuNulo(valor, divisor) {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0 ? numero / divisor : null;
}

function custoPorHora(custoEmpresa) {
  return dividirOuNulo(custoEmpresa, HORAS_POR_MES);
}
function custoPorDiaUtil(custoEmpresa) {
  return dividirOuNulo(custoEmpresa, DIAS_UTEIS_POR_MES);
}
function custoPorDiaCorrido(custoEmpresa) {
  return dividirOuNulo(custoEmpresa, DIAS_CORRIDOS_POR_MES);
}

const FUNCIONARIO_VAZIO = { nome: "", cpf: "", funcao: "", salario: "", custo_empresa: "", observacoes: "" };
const EMPREITEIRO_VAZIO = { nome: "", funcao: "", salario: "", valor_diarista: "", valor_quinzena: "", observacoes: "" };

export default function Configuracoes() {
  const [aba, setAba] = useState("funcionarios");
  const [funcionarios, setFuncionarios] = useState([]);
  const [empreiteiros, setEmpreiteiros] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [mostrarInativos, setMostrarInativos] = useState(false);

  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [formulario, setFormulario] = useState(FUNCIONARIO_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erroFormulario, setErroFormulario] = useState("");

  async function carregarDados() {
    setCarregando(true);
    setErro("");
    try {
      const [respostaFuncionarios, respostaEmpreiteiros] = await Promise.all([
        supabase.from("funcionarios").select("*").order("nome", { ascending: true }),
        supabase.from("empreiteiros").select("*").order("nome", { ascending: true }),
      ]);
      if (respostaFuncionarios.error) throw respostaFuncionarios.error;
      if (respostaEmpreiteiros.error) throw respostaEmpreiteiros.error;
      setFuncionarios(respostaFuncionarios.data || []);
      setEmpreiteiros(respostaEmpreiteiros.data || []);
    } catch (erroConsulta) {
      console.error("Não foi possível carregar funcionários/empreiteiros:", erroConsulta);
      setErro(
        "Não foi possível carregar os dados. Se esta é a primeira vez, confirme se as tabelas \"funcionarios\" e \"empreiteiros\" já foram criadas no Supabase."
      );
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarDados();
  }, []);

  const tabela = aba === "funcionarios" ? "funcionarios" : "empreiteiros";
  const lista = aba === "funcionarios" ? funcionarios : empreiteiros;
  const listaVisivel = useMemo(
    () => lista.filter((item) => mostrarInativos || item.ativo !== false),
    [lista, mostrarInativos]
  );

  function abrirNovo() {
    setEditandoId(null);
    setFormulario(aba === "funcionarios" ? FUNCIONARIO_VAZIO : EMPREITEIRO_VAZIO);
    setErroFormulario("");
    setModalAberto(true);
  }

  function abrirEdicao(registro) {
    setEditandoId(registro.id);
    if (aba === "funcionarios") {
      setFormulario({
        nome: registro.nome || "",
        cpf: registro.cpf || "",
        funcao: registro.funcao || "",
        salario: registro.salario ?? "",
        custo_empresa: registro.custo_empresa ?? "",
        observacoes: registro.observacoes || "",
      });
    } else {
      setFormulario({
        nome: registro.nome || "",
        funcao: registro.funcao || "",
        salario: registro.salario ?? "",
        valor_diarista: registro.valor_diarista ?? "",
        valor_quinzena: registro.valor_quinzena ?? "",
        observacoes: registro.observacoes || "",
      });
    }
    setErroFormulario("");
    setModalAberto(true);
  }

  function fecharModal() {
    if (salvando) return;
    setModalAberto(false);
  }

  function atualizarCampo(campo, valor) {
    setFormulario((anterior) => ({ ...anterior, [campo]: valor }));
  }

  async function salvarFormulario(evento) {
    evento.preventDefault();
    const nomeLimpo = (formulario.nome || "").trim();
    if (!nomeLimpo) {
      setErroFormulario("Informe o nome.");
      return;
    }

    const payload =
      aba === "funcionarios"
        ? {
            nome: nomeLimpo,
            cpf: (formulario.cpf || "").trim() || null,
            funcao: (formulario.funcao || "").trim() || null,
            salario: formulario.salario === "" ? null : Number(formulario.salario),
            custo_empresa: formulario.custo_empresa === "" ? null : Number(formulario.custo_empresa),
            observacoes: (formulario.observacoes || "").trim() || null,
          }
        : {
            nome: nomeLimpo,
            funcao: (formulario.funcao || "").trim() || null,
            salario: formulario.salario === "" ? null : Number(formulario.salario),
            valor_diarista: formulario.valor_diarista === "" ? null : Number(formulario.valor_diarista),
            valor_quinzena: formulario.valor_quinzena === "" ? null : Number(formulario.valor_quinzena),
            observacoes: (formulario.observacoes || "").trim() || null,
          };

    setSalvando(true);
    setErroFormulario("");
    try {
      if (editandoId) {
        const { error } = await supabase.from(tabela).update(payload).eq("id", editandoId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from(tabela).insert({ ...payload, ativo: true });
        if (error) throw error;
      }
      setModalAberto(false);
      await carregarDados();
    } catch (erroSalvar) {
      console.error("Não foi possível salvar:", erroSalvar);
      setErroFormulario(erroSalvar.message || "Não foi possível salvar. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivo(registro) {
    try {
      const { error } = await supabase.from(tabela).update({ ativo: !registro.ativo }).eq("id", registro.id);
      if (error) throw error;
      await carregarDados();
    } catch (erroAtualizar) {
      console.error("Não foi possível atualizar o status:", erroAtualizar);
      alert("Não foi possível " + (registro.ativo === false ? "ativar" : "inativar") + " este registro.");
    }
  }

  async function excluirRegistro(registro) {
    const confirmado = window.confirm(
      `Excluir definitivamente "${registro.nome}"? Esta ação não pode ser desfeita. Se preferir manter o histórico, use "Inativar" em vez de excluir.`
    );
    if (!confirmado) return;
    try {
      const { error } = await supabase.from(tabela).delete().eq("id", registro.id);
      if (error) throw error;
      await carregarDados();
    } catch (erroExcluir) {
      console.error("Não foi possível excluir:", erroExcluir);
      alert("Não foi possível excluir este registro.");
    }
  }

  const rotulo = aba === "funcionarios" ? "funcionário" : "empreiteiro";

  return (
    <div className="configuracoes-page">
      <div className="configuracoes-header">
        <div>
          <h1>Configurações</h1>
          <p>Cadastro de funcionários e empreiteiros, usado para agilizar os lançamentos de mão de obra em Custos.</p>
        </div>
      </div>

      <div className="configuracoes-card">
        <div className="configuracoes-card-header">
          <div className="configuracoes-abas" role="tablist" aria-label="Tipo de cadastro">
            <button type="button" role="tab" aria-selected={aba === "funcionarios"} className={aba === "funcionarios" ? "ativo" : ""} onClick={() => setAba("funcionarios")}>
              Funcionários
            </button>
            <button type="button" role="tab" aria-selected={aba === "empreiteiros"} className={aba === "empreiteiros" ? "ativo" : ""} onClick={() => setAba("empreiteiros")}>
              Empreiteiros
            </button>
          </div>

          <div className="configuracoes-acoes">
            <label className="configuracoes-mostrar-inativos">
              <input type="checkbox" checked={mostrarInativos} onChange={(evento) => setMostrarInativos(evento.target.checked)} />
              Mostrar inativos
            </label>
            <button type="button" className="botao-novo-usuario" onClick={abrirNovo}>
              + Novo {rotulo}
            </button>
          </div>
        </div>

        {erro && <p className="configuracoes-erro" role="alert">{erro}</p>}

        {carregando ? (
          <div className="usuarios-vazio">
            <p>Carregando...</p>
          </div>
        ) : listaVisivel.length === 0 ? (
          <div className="usuarios-vazio">
            <div className="usuarios-icone">👤</div>
            <h3>Nenhum {rotulo} cadastrado</h3>
            <p>Clique em "+ Novo {rotulo}" para começar.</p>
          </div>
        ) : (
          <div className="configuracoes-tabela-wrap">
            <table className="configuracoes-tabela">
              <thead>
                {aba === "funcionarios" ? (
                  <tr>
                    <th scope="col">Nome</th>
                    <th scope="col">CPF</th>
                    <th scope="col">Função</th>
                    <th scope="col">Salário</th>
                    <th scope="col">Custo empresa</th>
                    <th scope="col">Custo/hora</th>
                    <th scope="col">Custo/dia útil</th>
                    <th scope="col">Custo/dia (30)</th>
                    <th scope="col">Status</th>
                    <th scope="col"><span className="sr-only">Ações</span></th>
                  </tr>
                ) : (
                  <tr>
                    <th scope="col">Nome</th>
                    <th scope="col">Função</th>
                    <th scope="col">Salário</th>
                    <th scope="col">Diarista</th>
                    <th scope="col">Quinzena</th>
                    <th scope="col">Status</th>
                    <th scope="col"><span className="sr-only">Ações</span></th>
                  </tr>
                )}
              </thead>
              <tbody>
                {listaVisivel.map((registro) => (
                  <tr key={registro.id} className={registro.ativo === false ? "configuracoes-linha-inativa" : ""}>
                    <td data-label="Nome">{registro.nome}</td>
                    {aba === "funcionarios" && <td data-label="CPF">{registro.cpf || "—"}</td>}
                    <td data-label="Função">{registro.funcao || "—"}</td>
                    <td data-label="Salário" className="configuracoes-valor">{registro.salario != null ? formatarMoeda(registro.salario) : "—"}</td>
                    {aba === "funcionarios" ? (
                      <>
                        <td data-label="Custo empresa" className="configuracoes-valor">{registro.custo_empresa != null ? formatarMoeda(registro.custo_empresa) : "—"}</td>
                        <td data-label="Custo/hora" className="configuracoes-valor">{custoPorHora(registro.custo_empresa) != null ? formatarMoeda(custoPorHora(registro.custo_empresa)) : "—"}</td>
                        <td data-label="Custo/dia útil" className="configuracoes-valor">{custoPorDiaUtil(registro.custo_empresa) != null ? formatarMoeda(custoPorDiaUtil(registro.custo_empresa)) : "—"}</td>
                        <td data-label="Custo/dia (30)" className="configuracoes-valor">{custoPorDiaCorrido(registro.custo_empresa) != null ? formatarMoeda(custoPorDiaCorrido(registro.custo_empresa)) : "—"}</td>
                      </>
                    ) : (
                      <>
                        <td data-label="Diarista" className="configuracoes-valor">{registro.valor_diarista != null ? formatarMoeda(registro.valor_diarista) : "—"}</td>
                        <td data-label="Quinzena" className="configuracoes-valor">{registro.valor_quinzena != null ? formatarMoeda(registro.valor_quinzena) : "—"}</td>
                      </>
                    )}
                    <td data-label="Status">
                      <span className={"configuracoes-status" + (registro.ativo === false ? " inativo" : "")}>
                        {registro.ativo === false ? "Inativo" : "Ativo"}
                      </span>
                    </td>
                    <td data-label="Ações" className="configuracoes-acoes-celula">
                      <button type="button" onClick={() => abrirEdicao(registro)}>Editar</button>
                      <button type="button" onClick={() => alternarAtivo(registro)}>{registro.ativo === false ? "Ativar" : "Inativar"}</button>
                      <button type="button" className="configuracoes-excluir" onClick={() => excluirRegistro(registro)}>Excluir</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal aberto={modalAberto} titulo={(editandoId ? "Editar " : "Novo ") + rotulo} onClose={fecharModal}>
        <form className="configuracoes-formulario" onSubmit={salvarFormulario}>
          <label className="campo">
            Nome
            <input type="text" value={formulario.nome} onChange={(evento) => atualizarCampo("nome", evento.target.value)} maxLength={160} required disabled={salvando} />
          </label>

          {aba === "funcionarios" && (
            <label className="campo">
              CPF
              <input type="text" value={formulario.cpf} onChange={(evento) => atualizarCampo("cpf", evento.target.value)} placeholder="000.000.000-00" maxLength={20} disabled={salvando} />
            </label>
          )}

          <label className="campo">
            Função
            <input type="text" value={formulario.funcao} onChange={(evento) => atualizarCampo("funcao", evento.target.value)} placeholder="Ex.: Pedreiro, Servente, Pintor..." maxLength={80} disabled={salvando} />
          </label>

          <label className="campo">
            Salário
            <div className="configuracoes-valor-campo">
              <span>R$</span>
              <input type="number" value={formulario.salario} onChange={(evento) => atualizarCampo("salario", evento.target.value)} min="0" step="0.01" disabled={salvando} />
            </div>
          </label>

          {aba === "funcionarios" ? (
            <label className="campo">
              Custo empresa (salário + encargos)
              <div className="configuracoes-valor-campo">
                <span>R$</span>
                <input type="number" value={formulario.custo_empresa} onChange={(evento) => atualizarCampo("custo_empresa", evento.target.value)} min="0" step="0.01" disabled={salvando} />
              </div>
            </label>
          ) : (
            <>
              <label className="campo">
                Diarista
                <div className="configuracoes-valor-campo">
                  <span>R$</span>
                  <input type="number" value={formulario.valor_diarista} onChange={(evento) => atualizarCampo("valor_diarista", evento.target.value)} min="0" step="0.01" disabled={salvando} />
                </div>
              </label>
              <label className="campo">
                Quinzena
                <div className="configuracoes-valor-campo">
                  <span>R$</span>
                  <input type="number" value={formulario.valor_quinzena} onChange={(evento) => atualizarCampo("valor_quinzena", evento.target.value)} min="0" step="0.01" disabled={salvando} />
                </div>
              </label>
            </>
          )}

          <label className="campo campo-observacoes">
            Observações
            <input type="text" value={formulario.observacoes} onChange={(evento) => atualizarCampo("observacoes", evento.target.value)} placeholder="Ex.: valor por fora, aluguel descontado, etc." maxLength={200} disabled={salvando} />
          </label>

          {aba === "funcionarios" && formulario.custo_empresa !== "" && custoPorDiaUtil(formulario.custo_empresa) != null && (
            <p className="configuracoes-dica-calculo">
              Calculado automaticamente: {formatarMoeda(custoPorHora(formulario.custo_empresa))}/hora · {formatarMoeda(custoPorDiaUtil(formulario.custo_empresa))}/dia útil · {formatarMoeda(custoPorDiaCorrido(formulario.custo_empresa))}/dia (base 30)
            </p>
          )}

          {erroFormulario && <p className="configuracoes-erro" role="alert">{erroFormulario}</p>}

          <div className="acoes-formulario">
            <button type="button" className="botao-cancelar" onClick={fecharModal} disabled={salvando}>Cancelar</button>
            <button type="submit" className="botao-salvar" disabled={salvando}>{salvando ? "Salvando..." : "Salvar"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
