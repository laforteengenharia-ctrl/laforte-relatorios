import { useState } from "react";
import { FaDatabase, FaDownload } from "react-icons/fa";
import { supabase } from "../../services/supabase";
import "./Backup.css";

const tabelasBackup = [
  { nome: "contratos", titulo: "Contratos", ordem: ["id"] },
  { nome: "frentes", titulo: "Frentes e obras", ordem: ["id"] },
  { nome: "medicoes", titulo: "Medições", ordem: ["id"] },
  { nome: "medicao_frentes", titulo: "Vínculos das medições", ordem: ["medicao_id", "frente_id"] },
  { nome: "relatorio_fotos", titulo: "Fotos selecionadas e legendas", ordem: ["medicao_id", "ordem"] },
];
const TAMANHO_PAGINA = 1000;

async function buscarTabelaCompleta(configuracao) {
  const registros = [];
  let inicio = 0;

  while (true) {
    let consulta = supabase.from(configuracao.nome).select("*");
    for (const coluna of configuracao.ordem) {
      consulta = consulta.order(coluna, { ascending: true });
    }
    const { data, error } = await consulta.range(inicio, inicio + TAMANHO_PAGINA - 1);
    if (error) throw new Error(`Não foi possível incluir ${configuracao.titulo}: ${error.message}`);
    registros.push(...(data || []));
    if (!data || data.length < TAMANHO_PAGINA) break;
    inicio += TAMANHO_PAGINA;
  }

  return registros;
}

function formatarData(data) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(data);
}

export default function Backup() {
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState("");
  const [resultado, setResultado] = useState(null);

  async function baixarBackup() {
    setGerando(true);
    setErro("");
    setResultado(null);

    try {
      const tabelas = await Promise.all(
        tabelasBackup.map(async (configuracao) => ({
          nome: configuracao.nome,
          titulo: configuracao.titulo,
          registros: await buscarTabelaCompleta(configuracao),
        }))
      );
      const geradoEm = new Date();
      const backup = {
        aplicativo: "La Forte Relatórios Fotográficos",
        versaoFormato: 1,
        geradoEm: geradoEm.toISOString(),
        observacao: "Este arquivo contém dados e referências das fotos. Os arquivos de imagem e documentos permanecem no Google Drive.",
        tabelas: Object.fromEntries(tabelas.map(({ nome, registros }) => [nome, registros])),
      };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const carimbo = geradoEm.toISOString().replace(/[:.]/g, "-");
      link.href = url;
      link.download = `backup-la-forte-${carimbo}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setResultado({ geradoEm, tabelas });
    } catch (error) {
      console.error("Erro ao gerar backup:", error);
      setErro(error.message || "Não foi possível gerar o backup. Tente novamente.");
    } finally {
      setGerando(false);
    }
  }

  return (
    <main className="backup-page">
      <header className="backup-topo">
        <div>
          <h1>Backup</h1>
          <p>Baixe uma cópia dos dados cadastrados no sistema.</p>
        </div>
      </header>

      <section className="backup-cartao">
        <div className="backup-cartao-icone" aria-hidden="true"><FaDatabase /></div>
        <div className="backup-cartao-conteudo">
          <h2>Backup dos dados do aplicativo</h2>
          <p>Gera um arquivo JSON com contratos, frentes, medições, vínculos e seleção de fotos com suas legendas.</p>
          <p className="backup-nota">As imagens e os documentos continuam armazenados no Google Drive; eles não são baixados para este backup.</p>
          <button type="button" className="backup-botao" onClick={baixarBackup} disabled={gerando}>
            <FaDownload aria-hidden="true" />
            {gerando ? "Preparando backup..." : "Baixar backup"}
          </button>
        </div>
      </section>

      {erro && <div className="backup-alerta backup-alerta-erro" role="alert">{erro}</div>}

      {resultado && (
        <section className="backup-resultado" aria-live="polite">
          <h2>Backup baixado</h2>
          <p className="backup-data">Gerado em {formatarData(resultado.geradoEm)}.</p>
          <div className="backup-lista">
            {resultado.tabelas.map((tabela) => (
              <div className="backup-linha" key={tabela.nome}>
                <span>{tabela.titulo}</span>
                <strong>{tabela.registros.length}</strong>
              </div>
            ))}
          </div>
          <p className="backup-guardar">Guarde esse arquivo em um local seguro, como uma pasta de backup no seu computador ou no Drive.</p>
        </section>
      )}
    </main>
  );
}
