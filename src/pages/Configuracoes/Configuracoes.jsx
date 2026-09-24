import { useState } from "react";
import "./Configuracoes.css";

export default function Configuracoes() {
  const [mostrarNovoUsuario, setMostrarNovoUsuario] = useState(false);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [perfil, setPerfil] = useState("Usuário");

  function criarUsuario(evento) {
    evento.preventDefault();

    console.log({
      nome,
      email,
      perfil,
    });

    alert(
      "A estrutura do cadastro está pronta. A integração com o Supabase será feita na próxima etapa."
    );

    setNome("");
    setEmail("");
    setPerfil("Usuário");
    setMostrarNovoUsuario(false);
  }

  return (
    <div className="configuracoes-page">

      <div className="configuracoes-header">

        <div>
          <h1>Configurações</h1>

          <p>
            Gerencie usuários e configurações do sistema.
          </p>
        </div>

      </div>

      <div className="configuracoes-card">

        <div className="configuracoes-card-header">

          <div>
            <h2>Usuários</h2>

            <p>
              Cadastre e gerencie os usuários que terão acesso
              ao sistema La Forte.
            </p>
          </div>

          <button
            className="botao-novo-usuario"
            onClick={() =>
              setMostrarNovoUsuario(!mostrarNovoUsuario)
            }
          >
            + Novo usuário
          </button>

        </div>

        {mostrarNovoUsuario && (
          <div className="novo-usuario">

            <h3>Novo usuário</h3>

            <form onSubmit={criarUsuario}>

              <div className="campo">

                <label>Nome</label>

                <input
                  type="text"
                  value={nome}
                  onChange={(e) =>
                    setNome(e.target.value)
                  }
                  placeholder="Nome completo"
                  required
                />

              </div>

              <div className="campo">

                <label>E-mail</label>

                <input
                  type="email"
                  value={email}
                  onChange={(e) =>
                    setEmail(e.target.value)
                  }
                  placeholder="usuario@laforte.com.br"
                  required
                />

              </div>

              <div className="campo">

                <label>Perfil</label>

                <select
                  value={perfil}
                  onChange={(e) =>
                    setPerfil(e.target.value)
                  }
                >
                  <option value="Administrador">
                    Administrador
                  </option>

                  <option value="Usuário">
                    Usuário
                  </option>

                  <option value="Visualização">
                    Visualização
                  </option>
                </select>

              </div>

              <div className="acoes-formulario">

                <button
                  type="button"
                  className="botao-cancelar"
                  onClick={() =>
                    setMostrarNovoUsuario(false)
                  }
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="botao-salvar"
                >
                  Criar usuário
                </button>

              </div>

            </form>

          </div>
        )}

        <div className="usuarios-vazio">

          <div className="usuarios-icone">
            👤
          </div>

          <h3>Nenhum usuário cadastrado</h3>

          <p>
            Os usuários cadastrados aparecerão aqui.
          </p>

        </div>

      </div>

    </div>
  );
}