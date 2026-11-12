import { FaHome, FaFileContract, FaDatabase, FaCog, FaUsers, FaSignOutAlt } from "react-icons/fa";
import { supabase } from "../../services/supabase";
import "./Sidebar.css";

export default function Sidebar({ pagina, setPagina }) {
  async function sair() {
    if (!window.confirm("Deseja realmente sair do sistema?")) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      alert("Não foi possível sair do sistema. Tente novamente.");
      console.error("Erro ao sair:", error);
      return;
    }
    window.location.reload();
  }

  return (
    <aside className="sidebar">
      <div className="logo">
        <img src="/logo-la-forte.png" alt="La Forte Engenharia" />
      </div>
      <nav aria-label="Navegação principal">
        <button className={pagina === "dashboard" ? "active" : ""} onClick={() => setPagina("dashboard")}><FaHome /><span>Dashboard</span></button>
        <button className={pagina === "contratos" ? "active" : ""} onClick={() => setPagina("contratos")}><FaFileContract /><span>Contratos</span></button>
        <button className={pagina === "backup" ? "active" : ""} onClick={() => setPagina("backup")}><FaDatabase /><span>Backup</span></button>
        <button className={pagina === "usuarios" ? "active" : ""} onClick={() => setPagina("usuarios")}><FaUsers /><span>Usuários</span></button>
        <button className={pagina === "configuracoes" ? "active" : ""} onClick={() => setPagina("configuracoes")}><FaCog /><span>Configurações</span></button>
        <button type="button" className="sidebar-sair" onClick={sair}><FaSignOutAlt /><span>Sair</span></button>
      </nav>
    </aside>
  );
}
