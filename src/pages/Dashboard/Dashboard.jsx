import "./Dashboard.css";

export default function Dashboard() {
  return (
    <div className="dashboard">

      <div className="topo">
        <h1>Dashboard</h1>

        <button className="novoContrato">
          + Novo Contrato
        </button>
      </div>

      <div className="cards">

        <div className="card">
          <h3>Contratos</h3>
          <span>0</span>
        </div>

        <div className="card">
          <h3>Medições</h3>
          <span>0</span>
        </div>

        <div className="card">
          <h3>Fotos</h3>
          <span>0</span>
        </div>

        <div className="card">
          <h3>Relatórios</h3>
          <span>0</span>
        </div>

      </div>

      <div className="ultimos">

        <h2>Últimos Contratos</h2>

        <p>Ainda não existem contratos cadastrados.</p>

      </div>

    </div>
  );
}