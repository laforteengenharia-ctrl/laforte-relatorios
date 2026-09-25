import {
  FaHome,
  FaFileContract,
  FaDatabase,
  FaCog,
  FaUsers,
  FaSignOutAlt,
} from "react-icons/fa";

import { supabase } from "../../services/supabase";

import "./Sidebar.css";

export default function Sidebar({ pagina, setPagina }) {
  async function sair() {
    const confirmar = window.confirm(
      "Deseja realmente sair do sistema?"
    );

    if (!confirmar) {
      return;
    }

    const { error } = await supabase.auth.signOut();

    if (error) {
      alert(
        "Não foi possível sair do sistema. Tente novamente."
      );

      console.error("Erro ao sair:", error);

      return;
    }

    window.location.reload();
  }

  return (
    <aside className="sidebar">

      <div className="logo">
        <h2>La Forte</h2>

        <span>
          Relatórios Fotográficos
        </span>
      </div>

      <nav>

        {/* DASHBOARD */}
        <button
          className={
            pagina === "dashboard"
              ? "active"
              : ""
          }
          onClick={() =>
            setPagina("dashboard")
          }
        >
          <FaHome />

          Dashboard
        </button>

        {/* CONTRATOS */}
        <button
          className={
            pagina === "contratos"
              ? "active"
              : ""
          }
          onClick={() =>
            setPagina("contratos")
          }
        >
          <FaFileContract />

          Contratos
        </button>

        {/* BACKUP */}
        <button
          className={
            pagina === "backup"
              ? "active"
              : ""
          }
          onClick={() =>
            setPagina("backup")
          }
        >
          <FaDatabase />

          Backup
        </button>

        {/* USUÁRIOS */}
        <button
          className={
            pagina === "usuarios"
              ? "active"
              : ""
          }
          onClick={() =>
            setPagina("usuarios")
          }
        >
          <FaUsers />

          Usuários
        </button>

        {/* CONFIGURAÇÕES */}
        <button
          className={
            pagina === "configuracoes"
              ? "active"
              : ""
          }
          onClick={() =>
            setPagina("configuracoes")
          }
        >
          <FaCog />

          Configurações
        </button>

        {/* SAIR */}
        <button
          type="button"
          className="sidebar-sair"
          onClick={sair}
        >
          <FaSignOutAlt />

          Sair
        </button>

      </nav>

    </aside>
  );
}