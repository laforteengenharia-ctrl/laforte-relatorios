import { lazy, Suspense, useEffect, useState } from "react";

import "./App.css";

import { supabase } from "./services/supabase";

import Sidebar from "./components/Sidebar/Sidebar";

const Dashboard = lazy(() => import("./pages/Dashboard/Dashboard"));
const Contratos = lazy(() => import("./pages/Contratos/Contratos"));
const Frentes = lazy(() => import("./pages/Frentes/Frentes"));
const Medicoes = lazy(() => import("./pages/Medicoes/Medicoes"));
const Fotos = lazy(() => import("./pages/Fotos/Fotos"));
const Usuarios = lazy(() => import("./pages/Usuarios/Usuarios"));
const Login = lazy(() => import("./pages/Login/Login"));
const Backup = lazy(() => import("./pages/Backup/Backup"));

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
      <div className="contrato-detalhe">
        <header className="contrato-cabecalho">
          <div className="contrato-identificacao">
            <h1>Contrato {contratoSelecionado.numero}</h1>
            <p className="contrato-obra">{contratoSelecionado.nome}</p>
            <p className="contrato-cliente">
              Cliente: {contratoSelecionado.cliente}
              {contratoSelecionado.cidade
                ? ` — ${contratoSelecionado.cidade}/${contratoSelecionado.uf || "SC"}`
                : ""}
            </p>
          </div>

          <button type="button" className="contrato-voltar" onClick={fecharContrato}>
            ← Voltar para contratos
          </button>
        </header>

        <nav className="areas-contrato" aria-label="Áreas do contrato">
          <button type="button" className="area-contrato" onClick={() => abrirAreaContrato("frentes")}>
            <span className="area-contrato-icone" aria-hidden="true">🏗️</span>
            <strong>Obras em andamento</strong>
          </button>
          <button type="button" className="area-contrato" onClick={() => abrirAreaContrato("frentes_finalizadas")}>
            <span className="area-contrato-icone" aria-hidden="true">✅</span>
            <strong>Obras finalizadas</strong>
          </button>
          <button type="button" className="area-contrato" onClick={() => abrirAreaContrato("relatorios")}>
            <span className="area-contrato-icone" aria-hidden="true">📷</span>
            <strong>Relatórios fotográficos</strong>
          </button>
        </nav>
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
      <div className="relatorios-pagina">
        <header className="relatorios-cabecalho">
          <button
            type="button"
            className="relatorios-voltar"
            onClick={() => setPagina("contrato")}
          >
            ← Voltar para o contrato
          </button>
          <h1>Relatórios fotográficos</h1>
          <p>
            Contrato {contratoSelecionado.numero}
            {" — "}
            {contratoSelecionado.nome}
          </p>
        </header>

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
        return <Backup />;

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
    return (<Suspense fallback={<div className="carregando-pagina">Carregando...</div>}><Login /></Suspense>);
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
        <Suspense fallback={<div className="carregando-pagina">Carregando...</div>}>{renderPagina()}</Suspense>
      </main>
    </div>
  );
}

export default App;