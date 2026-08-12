import {
  FaHome,
  FaFileContract,
  FaHardHat,
  FaCalendarAlt,
  FaCamera,
  FaDatabase,
  FaCog,
} from "react-icons/fa";

import "./Sidebar.css";


export default function Sidebar({ pagina, setPagina }) {

  return (

    <aside className="sidebar">


      <div className="logo">

        <h2>La Forte</h2>

        <span>
          Relatórios Fotográficos
        </span>

      </div>



      <nav>


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




        <button
          className={
            pagina === "frentes"
              ? "active"
              : ""
          }
          onClick={() =>
            setPagina("frentes")
          }
        >

          <FaHardHat />

          Frentes de Obra

        </button>




        <button
          className={
            pagina === "medicoes"
              ? "active"
              : ""
          }
          onClick={() =>
            setPagina("medicoes")
          }
        >

          <FaCalendarAlt />

          Medições

        </button>




        <button
          className={
            pagina === "relatorios"
              ? "active"
              : ""
          }
          onClick={() =>
            setPagina("relatorios")
          }
        >

          <FaCamera />

          Relatórios

        </button>




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


      </nav>


    </aside>

  );

}