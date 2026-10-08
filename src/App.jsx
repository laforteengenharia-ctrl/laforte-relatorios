import { useEffect, useState } from "react";

import "./App.css";

import { supabase } from "./services/supabase";

import Sidebar from "./components/Sidebar/Sidebar";

import Dashboard from "./pages/Dashboard/Dashboard";
import Contratos from "./pages/Contratos/Contratos";
import Frentes from "./pages/Frentes/Frentes";
import Medicoes from "./pages/Medicoes/Medicoes";
import Fotos from "./pages/Fotos/Fotos";
import Usuarios from "./pages/Usuarios/Usuarios";
import Login from "./pages/Login/Login";

function App() {
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(true);

  // =====================================================
  // NAVEGAÇÃO PRINCIPAL
  // =====================================================

  const [pagina, setPagina] = useState("dashboard");

  // =====================================================
  // CONTRATO SELECIONADO
  // =====================================================

  const [contratoSelecionado, setContratoSelecionado] =
    useState(null);

  // =====================================================
  // OBRA / FRENTE SELECIONADA
  // =====================================================

  const [frenteSelecionada, setFrenteSelecionada] =
    useState(null);

  // =====================================================
  // SESSÃO
  // =====================================================

  useEffect(() => {
    async function verificarSessao() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setUsuario(session?.user ?? null);
      setCarregando(false);
    }

    verificarSessao();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_evento, session) => {
        setUsuario(session?.user ?? null);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // =====================================================
  // ABRIR CONTRATO
  // =====================================================

  function abrirContrato(contrato) {
    setContratoSelecionado(contrato);
    setFrenteSelecionada(null);
    setPagina("contrato");
  }

  // =====================================================
  // FECHAR CONTRATO
  // =====================================================

  function fecharContrato() {
    setContratoSelecionado(null);
    setFrenteSelecionada(null);
    setPagina("contratos");
  }

  // =====================================================
  // ABRIR OBRA / FRENTE
  // =====================================================

  function abrirFrente(frente) {
    setFrenteSelecionada(frente);
    setPagina("frente");
  }

  // =====================================================
  // FECHAR OBRA / VOLTAR PARA OBRAS
  // =====================================================

  function fecharFrente() {
    setFrenteSelecionada(null);
    setPagina("frentes");
  }

  // =====================================================
  // NAVEGAÇÃO PARA UMA ÁREA DO CONTRATO
  // =====================================================

  function abrirAreaContrato(area) {
    setFrenteSelecionada(null);
    setPagina(area);
  }

  // =====================================================
  // PÁGINA DA OBRA / FRENTE
  // =====================================================

  function renderFrente() {
    if (!contratoSelecionado) {
      return (
        <div style={{ padding: "30px" }}>
          <h1>Nenhum contrato selecionado</h1>

          <button
            type="button"
            onClick={() => setPagina("contratos")}
            style={{
              marginTop: "20px",
              padding: "10px 16px",
              cursor: "pointer",
            }}
          >
            Voltar para Contratos
          </button>
        </div>
      );
    }

    if (!frenteSelecionada) {
      return (
        <div style={{ padding: "30px" }}>
          <h1>Nenhuma obra selecionada</h1>

          <button
            type="button"
            onClick={() => setPagina("frentes")}
            style={{
              marginTop: "20px",
              padding: "10px 16px",
              cursor: "pointer",
            }}
          >
            ← Voltar para obras
          </button>
        </div>
      );
    }

    return (
      <div style={{ padding: "30px" }}>
        {/* =================================================
            CABEÇALHO
        ================================================= */}

        <div
          style={{
            marginBottom: "30px",
          }}
        >
          <button
            type="button"
            onClick={fecharFrente}
            style={{
              padding: "9px 14px",
              marginBottom: "20px",
              cursor: "pointer",
            }}
          >
            ← Voltar para obras
          </button>

          <h1
            style={{
              marginBottom: "8px",
            }}
          >
            {frenteSelecionada.nome}
          </h1>

          <p
            style={{
              margin: 0,
              color: "#64748b",
            }}
          >
            Contrato {contratoSelecionado.numero}
            {" — "}
            {contratoSelecionado.nome}
          </p>
        </div>

        {/* =================================================
            ÁREAS DA OBRA
        ================================================= */}

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "20px",
          }}
        >
          {/* =================================================
              CUSTO
          ================================================= */}

          <button
            type="button"
            onClick={() => {
              alert(
                "A área de Custo será implementada nesta obra."
              );
            }}
            style={{
              padding: "30px",
              textAlign: "left",
              cursor: "pointer",
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              background: "#fff",
            }}
          >
            <strong
              style={{
                display: "block",
                fontSize: "18px",
                marginBottom: "8px",
              }}
            >
              💰 Custo
            </strong>

            <span
              style={{
                color: "#64748b",
              }}
            >
              Controle de custos desta obra.
            </span>
          </button>

          {/* =================================================
              FOTOS
          ================================================= */}

          <button
            type="button"
            onClick={() => setPagina("fotos")}
            style={{
              padding: "30px",
              textAlign: "left",
              cursor: "pointer",
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              background: "#fff",
            }}
          >
            <strong
              style={{
                display: "block",
                fontSize: "18px",
                marginBottom: "8px",
              }}
            >
              📷 Fotos
            </strong>

            <span
              style={{
                color: "#64748b",
              }}
            >
              Fotos recebidas e organizadas por medição.
            </span>
          </button>
        </div>
      </div>
    );
  }

  // =====================================================
  // PÁGINA DE FOTOS DA OBRA
  // =====================================================

  function renderFotos() {
    if (!contratoSelecionado || !frenteSelecionada) {
      return (
        <div style={{ padding: "30px" }}>
          <h1>Nenhuma obra selecionada</h1>

          <button
            type="button"
            onClick={() => setPagina("frentes")}
            style={{
              marginTop: "20px",
              padding: "10px 16px",
              cursor: "pointer",
            }}
          >
            ← Voltar para obras
          </button>
        </div>
      );
    }

    return (
      <Fotos
        contratoSelecionado={contratoSelecionado}
        frenteSelecionada={frenteSelecionada}
        voltarObra={() => setPagina("frente")}
      />
    );
  }

  // =====================================================
  // PÁGINA DO CONTRATO
  // =====================================================

  function renderContrato() {
    if (!contratoSelecionado) {
      return (
        <div style={{ padding: "30px" }}>
          <h1>Nenhum contrato selecionado</h1>

          <button
            type="button"
            onClick={() => setPagina("contratos")}
            style={{
              marginTop: "20px",
              padding: "10px 16px",
              cursor: "pointer",
            }}
          >
            Voltar para Contratos
          </button>
        </div>
      );
    }

    return (
      <div style={{ padding: "30px" }}>
        {/* =================================================
            CABEÇALHO DO CONTRATO
        ================================================= */}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "20px",
            marginBottom: "30px",
          }}
        >
          <div>
            <h1 style={{ marginBottom: "8px" }}>
              Contrato {contratoSelecionado.numero}
            </h1>

            <p style={{ margin: 0 }}>
              {contratoSelecionado.nome}
            </p>

            <p
              style={{
                marginTop: "6px",
                color: "#64748b",
              }}
            >
              Cliente: {contratoSelecionado.cliente}

              {contratoSelecionado.cidade
                ? ` — ${contratoSelecionado.cidade}/${contratoSelecionado.uf || "SC"}`
                : ""}
            </p>
          </div>

          <button
            type="button"
            onClick={fecharContrato}
            style={{
              padding: "10px 16px",
              cursor: "pointer",
            }}
          >
            ← Voltar para contratos
          </button>
        </div>

        {/* =================================================
            ÁREAS DO CONTRATO
        ================================================= */}

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "20px",
          }}
        >
          {/* =================================================
              OBRAS EM ANDAMENTO
          ================================================= */}

          <button
            type="button"
            onClick={() =>
              abrirAreaContrato("frentes")
            }
            style={{
              padding: "30px",
              textAlign: "left",
              cursor: "pointer",
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              background: "#fff",
            }}
          >
            <strong
              style={{
                display: "block",
                fontSize: "18px",
                marginBottom: "8px",
              }}
            >
              🏗️ Obras em andamento
            </strong>

            <span style={{ color: "#64748b" }}>
              Acessar as obras deste contrato.
            </span>
          </button>

          {/* =================================================
              OBRAS FINALIZADAS
          ================================================= */}

          <button
            type="button"
            onClick={() =>
              abrirAreaContrato(
                "frentes_finalizadas"
              )
            }
            style={{
              padding: "30px",
              textAlign: "left",
              cursor: "pointer",
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              background: "#fff",
            }}
          >
            <strong
              style={{
                display: "block",
                fontSize: "18px",
                marginBottom: "8px",
              }}
            >
              ✅ Obras finalizadas
            </strong>

            <span style={{ color: "#64748b" }}>
              Visualizar as obras já concluídas.
            </span>
          </button>

          {/* =================================================
              RELATÓRIOS FOTOGRÁFICOS
          ================================================= */}

          <button
            type="button"
            onClick={() =>
              abrirAreaContrato("relatorios")
            }
            style={{
              padding: "30px",
              textAlign: "left",
              cursor: "pointer",
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              background: "#fff",
            }}
          >
            <strong
              style={{
                display: "block",
                fontSize: "18px",
                marginBottom: "8px",
              }}
            >
              📷 Relatórios fotográficos
            </strong>

            <span style={{ color: "#64748b" }}>
              Acessar as medições e relatórios
              fotográficos deste contrato.
            </span>
          </button>
        </div>
      </div>
    );
  }

  // =====================================================
  // PÁGINA DE RELATÓRIOS FOTOGRÁFICOS
  // =====================================================

  function renderRelatorios() {
    if (!contratoSelecionado) {
      return (
        <div style={{ padding: "30px" }}>
          <h1>Nenhum contrato selecionado</h1>

          <button
            type="button"
            onClick={() => setPagina("contratos")}
            style={{
              marginTop: "20px",
              padding: "10px 16px",
              cursor: "pointer",
            }}
          >
            Voltar para Contratos
          </button>
        </div>
      );
    }

    return (
      <div>
        {/* =================================================
            CABEÇALHO
        ================================================= */}

        <div
          style={{
            padding: "30px 30px 0 30px",
          }}
        >
          <button
            type="button"
            onClick={() => setPagina("contrato")}
            style={{
              padding: "9px 14px",
              marginBottom: "20px",
              cursor: "pointer",
            }}
          >
            ← Voltar para o contrato
          </button>

          <h1
            style={{
              marginBottom: "8px",
            }}
          >
            Relatórios fotográficos
          </h1>

          <p
            style={{
              margin: 0,
              color: "#64748b",
            }}
          >
            Contrato {contratoSelecionado.numero}
            {" — "}
            {contratoSelecionado.nome}
          </p>
        </div>

        {/* =================================================
            MEDIÇÕES / RELATÓRIOS
        ================================================= */}

        <Medicoes
          contratoSelecionado={contratoSelecionado}
          voltarContrato={() =>
            setPagina("contrato")
          }
        />
      </div>
    );
  }

  // =====================================================
  // RENDERIZAÇÃO
  // =====================================================

  const renderPagina = () => {
    switch (pagina) {
      case "dashboard":
        return <Dashboard />;

      case "contratos":
        return (
          <Contratos
            abrirContrato={abrirContrato}
          />
        );

      case "contrato":
        return renderContrato();

      case "frentes":
        return (
          <Frentes
            contratoSelecionado={
              contratoSelecionado
            }
            abrirFrente={abrirFrente}
            voltarContrato={() =>
              setPagina("contrato")
            }
          />
        );

      case "frentes_finalizadas":
        return (
          <Frentes
            contratoSelecionado={
              contratoSelecionado
            }
            somenteFinalizadas={true}
            abrirFrente={abrirFrente}
            voltarContrato={() =>
              setPagina("contrato")
            }
          />
        );

      case "frente":
        return renderFrente();

      case "fotos":
        return renderFotos();

      case "relatorios":
        return renderRelatorios();

      case "usuarios":
        return <Usuarios />;

      case "backup":
        return (
          <div style={{ padding: "30px" }}>
            <h1>Backup</h1>
          </div>
        );

      case "configuracoes":
        return (
          <div style={{ padding: "30px" }}>
            <h1>Configurações</h1>
          </div>
        );

      default:
        return <Dashboard />;
    }
  };

  // =====================================================
  // CARREGANDO
  // =====================================================

  if (carregando) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        Carregando...
      </div>
    );
  }

  // =====================================================
  // LOGIN
  // =====================================================

  if (!usuario) {
    return <Login />;
  }

  // =====================================================
  // APP
  // =====================================================

  return (
    <div className="app">
      <Sidebar
        pagina={pagina}
        setPagina={setPagina}
        contratoSelecionado={
          contratoSelecionado
        }
        fecharContrato={fecharContrato}
      />

      <main className="content">
        {renderPagina()}
      </main>
    </div>
  );
}

export default App;