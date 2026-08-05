import "./App.css";

import Sidebar from "./components/Sidebar/Sidebar";
import Dashboard from "./pages/Dashboard/Dashboard";

function App() {
  return (
    <div className="app">

      <Sidebar />

      <main className="content">
        <Dashboard />
      </main>

    </div>
  );
}

export default App;