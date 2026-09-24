import { useEffect, useState } from "react";

import "./App.css";

import { supabase } from "./services/supabase";

import Sidebar from "./components/Sidebar/Sidebar";

import Dashboard from "./pages/Dashboard/Dashboard";
import Contratos from "./pages/Contratos/Contratos";
import Frentes from "./pages/Frentes/Frentes";
import Medicoes from "./pages/Medicoes/Medicoes";
import Usuarios from "./pages/Usuarios/Usuarios";
import Login from "./pages/Login/Login";

function App() {
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(true);

  const [pagina, setPagina] = useState("dashboard");

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

  const renderPagina = () => {
    switch (pagina) {
      case "dashboard":
        return <Dashboard />;

      case "contratos":
        return <Contratos />;

      case "frentes":
        return <Frentes />;

      case "medicoes":
        return <Medicoes />;

      case "usuarios":
        return <Usuarios />;

      case "relatorios":
        return (
          <div style={{ padding: "30px" }}>
            <h1>Relatórios</h1>
          </div>
        );

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

  if (!usuario) {
    return <Login />;
  }

  return (
    <div className="app">
      <Sidebar
        pagina={pagina}
        setPagina={setPagina}
      />

      <main className="content">
        {renderPagina()}
      </main>
    </div>
  );
}

export default App;