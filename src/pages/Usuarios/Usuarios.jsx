import { useEffect, useState } from "react";
import {
  FaEdit,
  FaTrash,
  FaPlus,
  FaTimes,
} from "react-icons/fa";

import { supabase } from "../../services/supabase";

import "./Usuarios.css";

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");

  const [mostrarFormulario, setMostrarFormulario] =
    useState(false);

  const [editando, setEditando] = useState(null);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [perfil, setPerfil] = useState("usuario");

  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    carregarUsuarios();
  }, []);

  // =====================================================
  // CARREGAR USUÁRIOS
  // =====================================================

  async function carregarUsuarios() {
    setCarregando(true);
    setErro("");

    try {
      // Verifica a sessão atual
      const {
        data: { session },
        error: sessaoError,
      } = await supabase.auth.getSession();

      if (sessaoError) {
        console.error(
          "Erro ao obter sessão:",
          sessaoError
        );

        setErro(
          "Não foi possível verificar sua sessão."
        );

        setCarregando(false);
        return;
      }

      if (!session?.access_token) {
        setErro(
          "Sua sessão expirou. Faça login novamente."
        );

        setCarregando(false);
        return;
      }

      console.log(
        "Usuário autenticado:",
        session.user?.email
      );

      console.log(
        "Perfil:",
        session.user?.user_metadata?.perfil
      );

      // Chama a Edge Function
      const { data, error } =
        await supabase.functions.invoke(
          "gerenciar-usuarios",
          {
            body: {
              acao: "listar",
            },

            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }
        );

      console.log(
        "Resposta gerenciar-usuarios:",
        data
      );

      if (error) {
        console.error(
          "Erro na Edge Function:",
          error
        );

        let mensagemErro =
          "Não foi possível carregar os usuários.";

        // Tenta obter a mensagem real retornada pela função
        try {
          if (error.context) {
            const resposta =
              await error.context.json();

            if (resposta?.error) {
              mensagemErro = resposta.error;
            }
          }
        } catch {
          // Mantém a mensagem padrão
        }

        setErro(mensagemErro);
        setCarregando(false);
        return;
      }

      if (data?.error) {
        setErro(data.error);
        setCarregando(false);
        return;
      }

      setUsuarios(
        Array.isArray(data?.usuarios)
          ? data.usuarios
          : []
      );

    } catch (error) {
      console.error(
        "Erro inesperado ao carregar usuários:",
        error
      );

      setErro(
        "Ocorreu um erro ao carregar os usuários."
      );
    }

    setCarregando(false);
  }

  // =====================================================
  // FORMULÁRIO
  // =====================================================

  function limparFormulario() {
    setNome("");
    setEmail("");
    setSenha("");
    setPerfil("usuario");
    setEditando(null);
  }

  function abrirNovoUsuario() {
    limparFormulario();

    setErro("");
    setMensagem("");

    setMostrarFormulario(true);
  }

  function abrirEdicao(usuario) {
    setEditando(usuario);

    setNome(usuario.nome || "");
    setEmail(usuario.email || "");
    setSenha("");
    setPerfil(usuario.perfil || "usuario");

    setErro("");
    setMensagem("");

    setMostrarFormulario(true);
  }

  function fecharFormulario() {
    if (salvando) {
      return;
    }

    limparFormulario();

    setMostrarFormulario(false);

    setErro("");
    setMensagem("");
  }

  // =====================================================
  // SALVAR USUÁRIO
  // =====================================================

  async function salvarUsuario(evento) {
    evento.preventDefault();

    setErro("");
    setMensagem("");

    if (!nome.trim()) {
      setErro("Informe o nome do usuário.");
      return;
    }

    if (!email.trim()) {
      setErro("Informe o e-mail do usuário.");
      return;
    }

    if (!editando && !senha) {
      setErro("Informe uma senha.");
      return;
    }

    if (senha && senha.length < 6) {
      setErro(
        "A senha deve possuir pelo menos 6 caracteres."
      );
      return;
    }

    setSalvando(true);

    try {
      // Obtém sessão
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setErro(
          "Sua sessão expirou. Faça login novamente."
        );

        setSalvando(false);
        return;
      }

      // =================================================
      // EDITAR
      // =================================================

      if (editando) {
        const { data, error } =
          await supabase.functions.invoke(
            "gerenciar-usuarios",
            {
              body: {
                acao: "editar",
                id: editando.id,
                nome: nome.trim(),
                email: email.trim(),
                perfil,
                senha: senha.trim(),
              },

              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
            }
          );

        console.log(
          "Resposta edição:",
          data
        );

        if (error) {
          console.error(
            "Erro ao editar usuário:",
            error
          );

          let mensagemErro =
            "Não foi possível atualizar o usuário.";

          try {
            if (error.context) {
              const resposta =
                await error.context.json();

              if (resposta?.error) {
                mensagemErro = resposta.error;
              }
            }
          } catch {}

          setErro(mensagemErro);
          setSalvando(false);
          return;
        }

        if (data?.error) {
          setErro(data.error);
          setSalvando(false);
          return;
        }

        setMensagem(
          "Usuário atualizado com sucesso."
        );

      } else {

        // ===============================================
        // CRIAR
        // ===============================================

        const { data, error } =
          await supabase.functions.invoke(
            "criar-usuario",
            {
              body: {
                nome: nome.trim(),
                email: email.trim(),
                senha,
                perfil,
              },

              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
            }
          );

        console.log(
          "Resposta criação:",
          data
        );

        if (error) {
          console.error(
            "Erro ao criar usuário:",
            error
          );

          let mensagemErro =
            "Não foi possível criar o usuário.";

          try {
            if (error.context) {
              const resposta =
                await error.context.json();

              if (resposta?.error) {
                mensagemErro = resposta.error;
              }
            }
          } catch {}

          setErro(mensagemErro);
          setSalvando(false);
          return;
        }

        if (data?.error) {
          setErro(data.error);
          setSalvando(false);
          return;
        }

        setMensagem(
          "Usuário criado com sucesso."
        );
      }

      // Atualiza lista
      await carregarUsuarios();

      setSenha("");

      // Fecha somente depois de editar
      if (editando) {
        setMostrarFormulario(false);
        limparFormulario();
      }

    } catch (error) {
      console.error(
        "Erro inesperado:",
        error
      );

      setErro(
        "Ocorreu um erro inesperado. Tente novamente."
      );
    }

    setSalvando(false);
  }

  // =====================================================
  // EXCLUIR USUÁRIO
  // =====================================================

  async function excluirUsuario(usuario) {
    const confirmar = window.confirm(
      `Deseja realmente excluir o usuário "${usuario.nome || usuario.email}"?\n\nEsta ação não poderá ser desfeita.`
    );

    if (!confirmar) {
      return;
    }

    setErro("");
    setMensagem("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setErro(
          "Sua sessão expirou. Faça login novamente."
        );

        return;
      }

      const { data, error } =
        await supabase.functions.invoke(
          "gerenciar-usuarios",
          {
            body: {
              acao: "excluir",
              id: usuario.id,
            },

            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }
        );

      console.log(
        "Resposta exclusão:",
        data
      );

      if (error) {
        console.error(
          "Erro ao excluir usuário:",
          error
        );

        let mensagemErro =
          "Não foi possível excluir o usuário.";

        try {
          if (error.context) {
            const resposta =
              await error.context.json();

            if (resposta?.error) {
              mensagemErro = resposta.error;
            }
          }
        } catch {}

        setErro(mensagemErro);
        return;
      }

      if (data?.error) {
        setErro(data.error);
        return;
      }

      setMensagem(
        "Usuário excluído com sucesso."
      );

      await carregarUsuarios();

    } catch (error) {
      console.error(
        "Erro inesperado ao excluir:",
        error
      );

      setErro(
        "Ocorreu um erro ao excluir o usuário."
      );
    }
  }

  // =====================================================
  // DATA
  // =====================================================

  function formatarData(data) {
    if (!data) {
      return "-";
    }

    const dataObj = new Date(data);

    if (Number.isNaN(dataObj.getTime())) {
      return "-";
    }

    return dataObj.toLocaleDateString(
      "pt-BR"
    );
  }

  // =====================================================
  // INTERFACE
  // =====================================================

  return (
    <div className="usuarios-page">

      <div className="usuarios-header">

        <div>
          <h1>Usuários</h1>

          <p>
            Gerencie os usuários e acessos ao sistema.
          </p>
        </div>

        <button
          type="button"
          className="usuarios-botao-novo"
          onClick={abrirNovoUsuario}
        >
          <FaPlus />

          Novo usuário
        </button>

      </div>

      {erro && (
        <div className="usuarios-alerta erro">
          {erro}
        </div>
      )}

      {mensagem && (
        <div className="usuarios-alerta sucesso">
          {mensagem}
        </div>
      )}

      {mostrarFormulario && (
        <div className="usuarios-form-card">

          <div className="usuarios-form-header">

            <div>
              <h2>
                {editando
                  ? "Editar usuário"
                  : "Novo usuário"}
              </h2>

              <p>
                {editando
                  ? "Altere os dados do usuário."
                  : "Preencha os dados para criar um novo acesso."}
              </p>
            </div>

            <button
              type="button"
              className="usuarios-fechar"
              onClick={fecharFormulario}
              disabled={salvando}
            >
              <FaTimes />
            </button>

          </div>

          <form
            className="usuarios-form"
            onSubmit={salvarUsuario}
          >

            <div className="usuarios-campo">

              <label>
                Nome
              </label>

              <input
                type="text"
                value={nome}
                onChange={(e) =>
                  setNome(e.target.value)
                }
                placeholder="Nome completo"
                disabled={salvando}
                required
              />

            </div>

            <div className="usuarios-campo">

              <label>
                E-mail
              </label>

              <input
                type="email"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
                placeholder="usuario@laforteengenharia.com.br"
                disabled={salvando}
                required
              />

            </div>

            <div className="usuarios-campo">

              <label>
                {editando
                  ? "Nova senha"
                  : "Senha"}
              </label>

              <input
                type="password"
                value={senha}
                onChange={(e) =>
                  setSenha(e.target.value)
                }
                placeholder={
                  editando
                    ? "Deixe em branco para manter a senha atual"
                    : "Mínimo de 6 caracteres"
                }
                disabled={salvando}
                minLength={6}
              />

            </div>

            <div className="usuarios-campo">

              <label>
                Perfil
              </label>

              <select
                value={perfil}
                onChange={(e) =>
                  setPerfil(e.target.value)
                }
                disabled={salvando}
              >
                <option value="usuario">
                  Usuário
                </option>

                <option value="admin">
                  Administrador
                </option>
              </select>

            </div>

            <div className="usuarios-form-acoes">

              <button
                type="button"
                className="usuarios-botao-cancelar"
                onClick={fecharFormulario}
                disabled={salvando}
              >
                Cancelar
              </button>

              <button
                type="submit"
                className="usuarios-botao-salvar"
                disabled={salvando}
              >
                {salvando
                  ? "Salvando..."
                  : editando
                    ? "Salvar alterações"
                    : "Criar usuário"}
              </button>

            </div>

          </form>

        </div>
      )}

      <div className="usuarios-card">

        <div className="usuarios-card-titulo">

          <h2>
            Usuários cadastrados
          </h2>

          <span>
            {usuarios.length}{" "}
            {usuarios.length === 1
              ? "usuário"
              : "usuários"}
          </span>

        </div>

        {carregando ? (

          <div className="usuarios-carregando">
            Carregando usuários...
          </div>

        ) : usuarios.length === 0 ? (

          <div className="usuarios-vazio">

            <h3>
              Nenhum usuário encontrado
            </h3>

            <p>
              Clique em "Novo usuário" para
              cadastrar o primeiro acesso.
            </p>

          </div>

        ) : (

          <div className="usuarios-tabela-container">

            <table className="usuarios-tabela">

              <thead>

                <tr>

                  <th>
                    Nome
                  </th>

                  <th>
                    E-mail
                  </th>

                  <th>
                    Perfil
                  </th>

                  <th>
                    Criado em
                  </th>

                  <th>
                    Último acesso
                  </th>

                  <th>
                    Ações
                  </th>

                </tr>

              </thead>

              <tbody>

                {usuarios.map((usuario) => (

                  <tr key={usuario.id}>

                    <td>
                      <strong>
                        {usuario.nome ||
                          "Sem nome"}
                      </strong>
                    </td>

                    <td>
                      {usuario.email}
                    </td>

                    <td>

                      <span
                        className={
                          usuario.perfil === "admin"
                            ? "usuarios-perfil admin"
                            : "usuarios-perfil"
                        }
                      >
                        {usuario.perfil === "admin"
                          ? "Administrador"
                          : "Usuário"}
                      </span>

                    </td>

                    <td>
                      {formatarData(
                        usuario.criado_em
                      )}
                    </td>

                    <td>
                      {formatarData(
                        usuario.ultimo_login
                      )}
                    </td>

                    <td>

                      <div className="usuarios-acoes">

                        <button
                          type="button"
                          className="usuarios-acao editar"
                          onClick={() =>
                            abrirEdicao(usuario)
                          }
                          title="Editar usuário"
                        >
                          <FaEdit />
                        </button>

                        <button
                          type="button"
                          className="usuarios-acao excluir"
                          onClick={() =>
                            excluirUsuario(usuario)
                          }
                          title="Excluir usuário"
                        >
                          <FaTrash />
                        </button>

                      </div>

                    </td>

                  </tr>

                ))}

              </tbody>

            </table>

          </div>

        )}

      </div>

    </div>
  );
}