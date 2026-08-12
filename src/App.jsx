import { useState } from "react";

import "./App.css";

import Sidebar from "./components/Sidebar/Sidebar";

import Dashboard from "./pages/Dashboard/Dashboard";
import Contratos from "./pages/Contratos/Contratos";
import Frentes from "./pages/Frentes/Frentes";


function App() {

  const [pagina, setPagina] = useState("dashboard");



  const renderPagina = () => {


    switch (pagina) {


      case "dashboard":

        return <Dashboard />;



      case "contratos":

        return <Contratos />;



      case "medicoes":

        return (

          <div style={{ padding: "30px" }}>

            <h1>Medições</h1>

          </div>

        );



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



      case "frentes":

        return <Frentes />;



      default:

        return <Dashboard />;

    }

  };




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