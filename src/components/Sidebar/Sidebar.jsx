import {
  FaHome,
  FaFileContract,
  FaCalendarAlt,
  FaCamera,
  FaDatabase,
  FaCog,
} from "react-icons/fa";

import "./Sidebar.css";

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="logo">
        <h2>La Forte</h2>
        <span>Relatórios Fotográficos</span>
      </div>

      <nav>
        <button><FaHome /> Dashboard</button>
        <button><FaFileContract /> Contratos</button>
        <button><FaCalendarAlt /> Medições</button>
        <button><FaCamera /> Relatórios</button>
        <button><FaDatabase /> Backup</button>
        <button><FaCog /> Configurações</button>
      </nav>
    </aside>
  );
}