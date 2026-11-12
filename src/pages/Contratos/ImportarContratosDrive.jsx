import { useState } from "react";
import { supabase } from "../../services/supabase";

const GOOGLE_DRIVE_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbykcDwsViBK50fZmdSBW1_f9_K7Blz5TPuZICdvLO-LUFsMxG6-5A94A4f1yqe1QufB5Q/exec";

function extrairIdPasta(valor) {
  const texto = String(valor || "").trim();
  const link = texto.match(/\/folders\/([\w-]+)/i);
  return link?.[1] || texto;
}

function conferir(resultado, contexto) {
  if (resultado.error) {
    throw new Error(`${contexto}: ${resultado.error.message}`);
  }
  return resultado.data;
}

export default function ImportarContratosDrive({ onConcluido }) {
  const [importando, setImportando] = useState(false);

  async function importar() {
    const entrada = window.prompt(
      "Cole o link ou o ID da pasta Contratos Ativos no Google Drive:"
    );
    if (!entrada) return;

    const pastaId = extrairIdPasta(entrada);
    if (!pastaId || /^https?:\/\//i.test(pastaId)) {
      window.alert("Não reconheci o ID da pasta. Cole o link de uma pasta do Google Drive ou somente o ID.");
      return;
    }

    setImportando(true);
    const totais = { contratosNovos: 0, frentesNovas: 0, medicoesNovas: 0, vinculosNovos: 0 };

    try {
      const url = new URL(GOOGLE_DRIVE_SCRIPT_URL);
      url.searchParams.set("acao", "importar_contratos");
      url.searchParams.set("pasta_contratos_id", pastaId);
      const resposta = await fetch(url.toString());
      const estrutura = await resposta.json();
      if (!resposta.ok || !estrutura.ok) {
        throw new Error(estrutura.erro || `Falha ao consultar o Drive (HTTP ${resposta.status}).`);
      }

      const contratosDrive = Array.isArray(estrutura.contratos) ? estrutura.contratos : [];
      if (!contratosDrive.length) {
        window.alert("Não encontrei contratos com a estrutura esperada dentro dessa pasta.");
        return;
      }

      const frentesTotal = contratosDrive.reduce((soma, item) => soma + item.frentes.length, 0);
      const medicoesTotal = contratosDrive.reduce(
        (soma, item) => soma + item.frentes.reduce((n, frente) => n + frente.medicoes.length, 0), 0
      );
      const avisos = Array.isArray(estrutura.avisos) ? estrutura.avisos : [];
      const confirmar = window.confirm(
        `Encontrei ${contratosDrive.length} contrato(s), ${frentesTotal} frente(s) e ${medicoesTotal} medição(ões).\n\n` +
        `O importador vai ignorar pastas Custo e Fotos como frentes. As fotos continuarão no Drive. ` +
        `Contratos já cadastrados serão reaproveitados. Novos contratos receberão cliente "Não informado" e poderão ser completados depois.` +
        (avisos.length ? `\n\nHá ${avisos.length} aviso(s) sobre pastas que não seguem a estrutura.` : "") +
        "\n\nDeseja iniciar?"
      );
      if (!confirmar) return;

      for (const contratoDrive of contratosDrive) {
        let encontrados = conferir(
          await supabase.from("contratos").select("id").eq("numero", String(contratoDrive.numero)).limit(1),
          "Falha ao procurar contrato"
        );
        let contratoId = encontrados?.[0]?.id;
        if (!contratoId) {
          const novo = conferir(
            await supabase.from("contratos").insert([{
              numero: String(contratoDrive.numero),
              nome: String(contratoDrive.nome || ""),
              cliente: "Não informado",
              cidade: "",
              uf: "SC",
              status: "ativo",
            }]).select("id").single(),
            `Falha ao cadastrar o contrato ${contratoDrive.numero}`
          );
          contratoId = novo.id;
          totais.contratosNovos += 1;
        }

        const frentesAtuais = conferir(
          await supabase.from("frentes").select("id,nome,ordem,drive_pasta_id").eq("contrato_id", contratoId),
          `Falha ao consultar frentes do contrato ${contratoDrive.numero}`
        ) || [];
        const frentesPorNome = new Map(frentesAtuais.map((item) => [item.nome.trim().toLocaleLowerCase("pt-BR"), item]));
        let ordem = frentesAtuais.reduce((max, item) => Math.max(max, Number(item.ordem) || 0), 0);

        const medicoesAtuais = conferir(
          await supabase.from("medicoes").select("id,numero").eq("contrato_id", contratoId),
          `Falha ao consultar medições do contrato ${contratoDrive.numero}`
        ) || [];
        const medicoesPorNumero = new Map(medicoesAtuais.map((item) => [Number(item.numero), item]));

        for (const frenteDrive of contratoDrive.frentes) {
          const chaveFrente = frenteDrive.nome.trim().toLocaleLowerCase("pt-BR");
          let frente = frentesPorNome.get(chaveFrente);
          if (!frente) {
            frente = conferir(
              await supabase.from("frentes").insert([{
                contrato_id: contratoId,
                nome: frenteDrive.nome,
                drive_pasta_id: frenteDrive.drive_pasta_id,
                ordem: ++ordem,
                status: "ativo",
                situacao: "em_andamento",
              }]).select("id,nome,ordem,drive_pasta_id").single(),
              `Falha ao cadastrar a frente ${frenteDrive.nome}`
            );
            frentesPorNome.set(chaveFrente, frente);
            totais.frentesNovas += 1;
          } else if (frente.drive_pasta_id !== frenteDrive.drive_pasta_id) {
            conferir(
              await supabase.from("frentes").update({ drive_pasta_id: frenteDrive.drive_pasta_id }).eq("id", frente.id),
              `Falha ao atualizar a pasta da frente ${frenteDrive.nome}`
            );
          }

          for (const medicaoDrive of frenteDrive.medicoes) {
            let medicao = medicoesPorNumero.get(Number(medicaoDrive.numero));
            if (!medicao) {
              medicao = conferir(
                await supabase.from("medicoes").insert([{
                  contrato_id: contratoId,
                  numero: Number(medicaoDrive.numero),
                  data_inicio: null,
                  data_fim: null,
                  status: "em_andamento",
                  observacao: "",
                }]).select("id,numero").single(),
                `Falha ao cadastrar a medição ${medicaoDrive.numero}`
              );
              medicoesPorNumero.set(Number(medicaoDrive.numero), medicao);
              totais.medicoesNovas += 1;
            }

            const vinculos = conferir(
              await supabase.from("medicao_frentes").select("medicao_id")
                .eq("medicao_id", medicao.id).eq("frente_id", frente.id).limit(1),
              "Falha ao conferir o vínculo da medição com a frente"
            );
            if (!vinculos?.length) {
              conferir(
                await supabase.from("medicao_frentes").insert([{ medicao_id: medicao.id, frente_id: frente.id }]),
                `Falha ao vincular a medição ${medicaoDrive.numero} à frente ${frenteDrive.nome}`
              );
              totais.vinculosNovos += 1;
            }
          }
        }
      }

      await onConcluido?.();
      window.alert(
        `Importação concluída.\n\n` +
        `Novos contratos: ${totais.contratosNovos}\nNovas frentes: ${totais.frentesNovas}\n` +
        `Novas medições: ${totais.medicoesNovas}\nVínculos criados: ${totais.vinculosNovos}` +
        (avisos.length ? `\n\nAvisos: ${avisos.join("\n")}` : "")
      );
    } catch (erro) {
      console.error("Erro na importação do Google Drive:", erro);
      window.alert(
        `A importação foi interrompida. Os itens já gravados foram mantidos; execute novamente para continuar.\n\n` +
        `${erro.message}\n\nNovos contratos: ${totais.contratosNovos}; novas frentes: ${totais.frentesNovas}; novas medições: ${totais.medicoesNovas}.`
      );
      await onConcluido?.();
    } finally {
      setImportando(false);
    }
  }

  return (
    <button
      type="button"
      className="novo-btn"
      onClick={importar}
      disabled={importando}
      style={{ background: "#0f766e", opacity: importando ? 0.7 : 1 }}
    >
      {importando ? "Importando do Drive..." : "Importar do Google Drive"}
    </button>
  );
}
