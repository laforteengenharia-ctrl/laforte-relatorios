// Sincronização de estrutura de Contratos/Frentes entre o app e o Google
// Drive (ver seção "SINCRONIZAÇÃO DE ESTRUTURA DE CONTRATOS/FRENTES" no
// GoogleAppsScript_Code.gs para a estrutura esperada de pastas).
//
// Duas direções:
// - App -> Drive: criarPastaContratoNoDrive/criarPastaFrenteNoDrive criam a
//   pasta certa quando algo é cadastrado pelo app; moverPastaContratoNoDrive/
//   moverPastaFrenteNoDrive movem a pasta quando o status/situação muda.
// - Drive -> App: sincronizarEstruturaDrive() lê a estrutura de pastas do
//   Drive (as duas pastas raiz, Ativos e Inativos) e cria/atualiza contratos,
//   frentes e medições no Supabase para refletir o que foi criado ou movido
//   direto no Drive.

import { supabase } from "./supabase";
import { obterTokenDrive } from "./driveAuth";
import { fetchComRetentativa } from "../utils/fetchComRetentativa";
import { GOOGLE_DRIVE_SCRIPT_URL } from "../config/googleDriveScript";

async function chamarAcaoDrive(payload) {
  const token = await obterTokenDrive();
  const respostaHttp = await fetchComRetentativa(GOOGLE_DRIVE_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ ...payload, token }),
  });
  const resultado = await respostaHttp.json();
  if (!respostaHttp.ok || !resultado?.ok) {
    throw new Error(
      resultado?.erro_auth
        ? "Sua sessão expirou. Faça login novamente para continuar."
        : resultado?.erro || "O Drive não confirmou a operação."
    );
  }
  return resultado;
}

// ------------------------------------------------------------------
// APP -> DRIVE
// ------------------------------------------------------------------

// Cria a pasta "Contrato {numero} - {nome}" dentro de Contratos Ativos (com
// as subpastas OBRAS EM ANDAMENTO/OBRAS FINALIZADAS já prontas) e devolve o
// drive_pasta_id para salvar no contrato recém-criado.
export async function criarPastaContratoNoDrive(numero, nome) {
  const resultado = await chamarAcaoDrive({ acao: "criar_pasta_contrato", numero, nome });
  return resultado.drive_pasta_id;
}

// Move a pasta de um contrato entre Contratos Ativos/Inativos.
export async function moverPastaContratoNoDrive(drivePastaId, ativo) {
  if (!drivePastaId) return;
  await chamarAcaoDrive({ acao: "mover_pasta_contrato", drive_pasta_id: drivePastaId, ativo });
}

// Cria a pasta de uma frente nova (com a subpasta Fotos) dentro de OBRAS EM
// ANDAMENTO do contrato e devolve o drive_pasta_id (da pasta Fotos, que é o
// que fica salvo em frentes.drive_pasta_id).
export async function criarPastaFrenteNoDrive(drivePastaContratoId, nomeFrente) {
  const resultado = await chamarAcaoDrive({
    acao: "criar_pasta_frente",
    drive_pasta_contrato_id: drivePastaContratoId,
    nome_frente: nomeFrente,
  });
  return resultado.drive_pasta_id;
}

// Move a pasta de uma frente entre OBRAS EM ANDAMENTO/OBRAS FINALIZADAS,
// opcionalmente para outro contrato (transferência de frente).
export async function moverPastaFrenteNoDrive(drivePastaFotosId, emAndamento, drivePastaContratoDestinoId) {
  if (!drivePastaFotosId) return;
  await chamarAcaoDrive({
    acao: "mover_pasta_frente",
    drive_pasta_id: drivePastaFotosId,
    em_andamento: emAndamento,
    drive_pasta_contrato_destino_id: drivePastaContratoDestinoId || null,
  });
}

// ------------------------------------------------------------------
// DRIVE -> APP
// ------------------------------------------------------------------

function conferir(resultado, contexto) {
  if (resultado.error) {
    throw new Error(`${contexto}: ${resultado.error.message}`);
  }
  return resultado.data;
}

// Lê a estrutura completa de pastas do Drive (Contratos Ativos + Contratos
// Inativos) e cria/atualiza contratos, frentes e medições no Supabase para
// refletir o que existe no Drive. Chamada silenciosamente ao abrir as telas
// de Contratos/Frentes, e também pelo botão "Sincronizar com Drive".
//
// Regras de atualização de status/situação a partir do Drive (propositalmente
// conservadoras, para nunca desfazer uma escolha manual do usuário):
// - Contrato: só corrige ativo <-> encerrado quando há divergência clara
//   entre o status salvo e a pasta raiz onde a pasta do contrato está. Nunca
//   mexe em "suspenso" (esse status não tem como ser detectado a partir da
//   localização da pasta).
// - Frente: só atualiza a situação (em_andamento/finalizada) quando a frente
//   está com status "ativo". Uma frente arquivada não tem a situação tocada
//   pela sincronização.
export async function sincronizarEstruturaDrive() {
  const token = await obterTokenDrive();
  const url = new URL(GOOGLE_DRIVE_SCRIPT_URL);
  url.searchParams.set("acao", "sincronizar_estrutura_contratos");
  url.searchParams.set("token", token);
  const respostaHttp = await fetchComRetentativa(url.toString());
  const estrutura = await respostaHttp.json();
  if (!respostaHttp.ok || !estrutura.ok) {
    throw new Error(
      estrutura.erro_auth
        ? "Sua sessão expirou. Faça login novamente para continuar."
        : estrutura.erro || `Falha ao consultar o Drive (HTTP ${respostaHttp.status}).`
    );
  }

  const contratosDrive = Array.isArray(estrutura.contratos) ? estrutura.contratos : [];
  const avisos = Array.isArray(estrutura.avisos) ? estrutura.avisos : [];
  const totais = {
    contratosNovos: 0,
    frentesNovas: 0,
    medicoesNovas: 0,
    vinculosNovos: 0,
    statusAtualizados: 0,
    situacoesAtualizadas: 0,
  };

  for (const contratoDrive of contratosDrive) {
    const encontrados = conferir(
      await supabase.from("contratos").select("id,status,drive_pasta_id").eq("numero", String(contratoDrive.numero)).limit(1),
      "Falha ao procurar contrato"
    );
    let contratoApp = encontrados?.[0];

    // Se não achou pelo número, tenta achar pela própria pasta do Drive. Isso
    // evita cadastrar um contrato duplicado quando o nome salvo no app já foi
    // corrigido/digitado diferente do nome atual da pasta no Drive — o vínculo
    // real é o ID da pasta, não o texto do nome.
    if (!contratoApp && contratoDrive.drive_pasta_id) {
      const porPasta = conferir(
        await supabase
          .from("contratos")
          .select("id,status,drive_pasta_id")
          .eq("drive_pasta_id", contratoDrive.drive_pasta_id)
          .limit(1),
        "Falha ao procurar contrato pela pasta do Drive"
      );
      contratoApp = porPasta?.[0];
    }

    let contratoId;

    if (!contratoApp) {
      const novo = conferir(
        await supabase
          .from("contratos")
          .insert([
            {
              numero: String(contratoDrive.numero),
              nome: String(contratoDrive.nome || ""),
              cliente: "Não informado",
              cidade: "",
              uf: "SC",
              status: contratoDrive.status,
              drive_pasta_id: contratoDrive.drive_pasta_id,
            },
          ])
          .select("id,status,drive_pasta_id")
          .single(),
        `Falha ao cadastrar o contrato ${contratoDrive.numero}`
      );
      contratoApp = novo;
      contratoId = novo.id;
      totais.contratosNovos += 1;
    } else {
      contratoId = contratoApp.id;
      const atualizacoes = {};

      if (!contratoApp.drive_pasta_id || contratoApp.drive_pasta_id !== contratoDrive.drive_pasta_id) {
        atualizacoes.drive_pasta_id = contratoDrive.drive_pasta_id;
      }
      if (contratoApp.status === "ativo" && contratoDrive.status === "encerrado") {
        atualizacoes.status = "encerrado";
      } else if (contratoApp.status === "encerrado" && contratoDrive.status === "ativo") {
        atualizacoes.status = "ativo";
      }

      if (Object.keys(atualizacoes).length) {
        conferir(
          await supabase.from("contratos").update(atualizacoes).eq("id", contratoId),
          `Falha ao atualizar o contrato ${contratoDrive.numero}`
        );
        if (atualizacoes.status) totais.statusAtualizados += 1;
      }
    }

    const frentesAtuais =
      conferir(
        await supabase.from("frentes").select("id,nome,ordem,drive_pasta_id,status,situacao").eq("contrato_id", contratoId),
        `Falha ao consultar frentes do contrato ${contratoDrive.numero}`
      ) || [];
    const frentesPorNome = new Map(frentesAtuais.map((item) => [item.nome.trim().toLocaleLowerCase("pt-BR"), item]));
    // Mesma lógica do contrato acima: casar também pelo ID da pasta do Drive,
    // não só pelo nome. Sem isso, uma frente cujo nome no app já foi corrigido
    // (ou cuja pasta no Drive tem um nome diferente/com erro de digitação)
    // seria cadastrada de novo a cada sincronização, duplicando a frente e
    // "escondendo" os custos reais dela atrás de uma planilha nova e vazia
    // (a pesquisa de custos usa o nome da frente para achar a planilha certa).
    const frentesPorPasta = new Map(
      frentesAtuais.filter((item) => item.drive_pasta_id).map((item) => [item.drive_pasta_id, item])
    );
    let ordem = frentesAtuais.reduce((max, item) => Math.max(max, Number(item.ordem) || 0), 0);

    const medicoesAtuais =
      conferir(
        await supabase.from("medicoes").select("id,numero").eq("contrato_id", contratoId),
        `Falha ao consultar medições do contrato ${contratoDrive.numero}`
      ) || [];
    const medicoesPorNumero = new Map(medicoesAtuais.map((item) => [Number(item.numero), item]));

    for (const frenteDrive of contratoDrive.frentes) {
      const chaveFrente = frenteDrive.nome.trim().toLocaleLowerCase("pt-BR");
      let frente = frentesPorNome.get(chaveFrente) || frentesPorPasta.get(frenteDrive.drive_pasta_id);

      if (!frente) {
        frente = conferir(
          await supabase
            .from("frentes")
            .insert([
              {
                contrato_id: contratoId,
                nome: frenteDrive.nome,
                drive_pasta_id: frenteDrive.drive_pasta_id,
                ordem: ++ordem,
                status: "ativo",
                situacao: frenteDrive.situacao,
              },
            ])
            .select("id,nome,ordem,drive_pasta_id,status,situacao")
            .single(),
          `Falha ao cadastrar a frente ${frenteDrive.nome}`
        );
        frentesPorNome.set(chaveFrente, frente);
        if (frente.drive_pasta_id) frentesPorPasta.set(frente.drive_pasta_id, frente);
        totais.frentesNovas += 1;
      } else {
        const atualizacoesFrente = {};
        if (frente.drive_pasta_id !== frenteDrive.drive_pasta_id) {
          atualizacoesFrente.drive_pasta_id = frenteDrive.drive_pasta_id;
        }
        if ((frente.status || "ativo") === "ativo" && frente.situacao !== frenteDrive.situacao) {
          atualizacoesFrente.situacao = frenteDrive.situacao;
        }
        if (Object.keys(atualizacoesFrente).length) {
          conferir(
            await supabase.from("frentes").update(atualizacoesFrente).eq("id", frente.id),
            `Falha ao atualizar a frente ${frenteDrive.nome}`
          );
          if (atualizacoesFrente.situacao) totais.situacoesAtualizadas += 1;
        }
      }

      for (const medicaoDrive of frenteDrive.medicoes) {
        let medicao = medicoesPorNumero.get(Number(medicaoDrive.numero));
        if (!medicao) {
          medicao = conferir(
            await supabase
              .from("medicoes")
              .insert([
                {
                  contrato_id: contratoId,
                  numero: Number(medicaoDrive.numero),
                  data_inicio: null,
                  data_fim: null,
                  status: "em_andamento",
                  observacao: "",
                },
              ])
              .select("id,numero")
              .single(),
            `Falha ao cadastrar a medição ${medicaoDrive.numero}`
          );
          medicoesPorNumero.set(Number(medicaoDrive.numero), medicao);
          totais.medicoesNovas += 1;
        }

        const vinculos = conferir(
          await supabase.from("medicao_frentes").select("medicao_id").eq("medicao_id", medicao.id).eq("frente_id", frente.id).limit(1),
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

  return { totais, avisos };
}
