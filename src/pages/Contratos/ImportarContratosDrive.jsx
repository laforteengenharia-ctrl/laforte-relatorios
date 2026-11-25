import { useState } from "react";
import { sincronizarEstruturaDrive } from "../../services/estruturaDrive";

export default function ImportarContratosDrive({ onConcluido }) {
  const [sincronizando, setSincronizando] = useState(false);

  async function sincronizar() {
    setSincronizando(true);

    try {
      const { totais, avisos } = await sincronizarEstruturaDrive();

      await onConcluido?.();

      const mudou =
        totais.contratosNovos ||
        totais.frentesNovas ||
        totais.medicoesNovas ||
        totais.statusAtualizados ||
        totais.situacoesAtualizadas;

      if (!mudou && !avisos.length) {
        window.alert("Tudo certo: o app já está sincronizado com a estrutura do Google Drive.");
        return;
      }

      window.alert(
        "Sincronização com o Google Drive concluída.\n\n" +
          `Novos contratos: ${totais.contratosNovos}\n` +
          `Novas frentes: ${totais.frentesNovas}\n` +
          `Novas medições: ${totais.medicoesNovas}\n` +
          `Vínculos criados: ${totais.vinculosNovos}\n` +
          `Status de contrato atualizados: ${totais.statusAtualizados}\n` +
          `Situações de obra atualizadas: ${totais.situacoesAtualizadas}` +
          (avisos.length
            ? `\n\nAvisos sobre pastas fora do padrão esperado:\n${avisos.join("\n")}`
            : "")
      );
    } catch (erro) {
      console.error("Erro ao sincronizar com o Google Drive:", erro);
      window.alert(
        `Não foi possível sincronizar com o Google Drive agora.\n\n${erro.message || ""}`
      );
    } finally {
      setSincronizando(false);
    }
  }

  return (
    <button
      type="button"
      className="novo-btn"
      onClick={sincronizar}
      disabled={sincronizando}
      title="Confere contratos/frentes criados ou movidos direto no Google Drive e atualiza o app"
    >
      {sincronizando ? "Sincronizando..." : "Sincronizar com Drive"}
    </button>
  );
}
