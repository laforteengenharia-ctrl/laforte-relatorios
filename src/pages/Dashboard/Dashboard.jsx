import { useEffect, useState } from "react";
import { supabase } from "../../services/supabase";
import "./Dashboard.css";

export default function Dashboard() {
  const [contratosAtivos, setContratosAtivos] = useState(null);

  useEffect(() => {
    let ativo = true;

    async function carregarContratosAtivos() {
      const { count, error } = await supabase
        .from("contratos")
        .select("id", { count: "exact", head: true })
        .eq("status", "ativo");

      if (error) {
        console.error("Erro ao contar contratos ativos:", error);
        if (ativo) setContratosAtivos("—");
        return;
      }

      if (ativo) setContratosAtivos(count ?? 0);
    }

    carregarContratosAtivos();
    return () => { ativo = false; };
  }, []);

  return (
    <main className="dashboard" aria-label="Resumo do sistema">
      <section className="cards" aria-label="Contratos ativos">
        <article className="card">
          <h1>Contratos ativos</h1>
          <p aria-live="polite">{contratosAtivos ?? "…"}</p>
        </article>
      </section>
    </main>
  );
}
