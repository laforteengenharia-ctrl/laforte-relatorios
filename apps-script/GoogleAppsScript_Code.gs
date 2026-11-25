const VERSAO_CUSTOS_IMPORTADOR = "custos-itens-2026-11-25-r12";
const VERSAO_WORD_SYNC = "word-sync-2026-11-19-r6";

// IDs fixos das pastas raiz de Contratos no Google Drive (usadas pela
// sincronização automática de estrutura — ver "SINCRONIZAÇÃO DE ESTRUTURA
// DE CONTRATOS/FRENTES" mais abaixo). Trocar aqui se as pastas mudarem.
const PASTA_CONTRATOS_ATIVOS_ID = "1dCQUK4VTQDfy0j-rGWnpuvRLuCzBQRHp";
const PASTA_CONTRATOS_INATIVOS_ID = "1U_FG769AKRsH9VY_ra-UhXruwkVoZVPx";

// =========================================================
// AUTENTICAÇÃO (SESSÃO DO SUPABASE)
// =========================================================
// O Apps Script (doGet/doPost) não tem acesso aos cabeçalhos HTTP da
// requisição, então o token de sessão do Supabase chega como parâmetro de
// URL (GET: ?token=...) ou como campo "token" no corpo JSON (POST). Ele é
// validado chamando a própria API de autenticação do Supabase; o resultado
// positivo fica em cache por alguns minutos para não atrasar sequências
// rápidas de requisições (ex.: carregar várias fotos de uma vez).

const SUPABASE_URL = "https://flruewqbimlffvwkawfb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_DbjYDviPMjiY5Y3yoi81Fw_F_zSGhKA";

function validarToken(token) {
  const valor = String(token || "").trim();
  if (!valor) return false;

  const cache = CacheService.getScriptCache();
  const hash = Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, valor)
  );
  const chaveCache = "auth-token:" + hash;

  const emCache = cache.get(chaveCache);
  if (emCache === "1") return true;
  if (emCache === "0") return false;

  try {
    const resposta = UrlFetchApp.fetch(SUPABASE_URL + "/auth/v1/user", {
      method: "get",
      headers: {
        Authorization: "Bearer " + valor,
        apikey: SUPABASE_ANON_KEY
      },
      muteHttpExceptions: true
    });
    const valido = resposta.getResponseCode() === 200;
    cache.put(chaveCache, valido ? "1" : "0", valido ? 300 : 30);
    return valido;
  } catch (erro) {
    console.error("Falha ao validar sessão do Supabase:", erro);
    return false;
  }
}

function respostaNaoAutorizado() {
  return resposta({
    ok: false,
    erro: "Sessão expirada ou inválida. Faça login novamente para continuar.",
    erro_auth: true
  });
}

function doGet(e) {
  try {
    const token = e && e.parameter ? e.parameter.token : null;
    if (!validarToken(token)) {
      return respostaNaoAutorizado();
    }

    const pastaFotosId = e && e.parameter
      ? e.parameter.drive_pasta_id
      : null;

    const numeroMedicao = e && e.parameter
      ? e.parameter.medicao
      : null;

    const acao = e && e.parameter
      ? e.parameter.acao
      : null;

    const arquivoId = e && e.parameter
      ? e.parameter.arquivo_id
      : null;

    const tamanhoImagem = e && e.parameter
      ? e.parameter.tamanho
      : null;
    const numeroContrato = e && e.parameter ? e.parameter.contrato_numero : null;

    // =========================================================
    // SERVIR IMAGEM
    // =========================================================

    if (acao === "listar_custos" || acao === "sincronizar_custos" || acao === "reimportar_custos") {
      return responderCustosDrive(e.parameter, acao === "sincronizar_custos", acao === "reimportar_custos");
    }
    if (acao === "importar_contratos") {
      const pastaContratosId = e && e.parameter ? e.parameter.pasta_contratos_id : null;
      if (!pastaContratosId) {
        return resposta({ ok: false, erro: "Informe o ID da pasta Contratos Ativos." });
      }
      return listarEstruturaContratos(pastaContratosId);
    }
    if (acao === "sincronizar_estrutura_contratos") {
      return sincronizarEstruturaContratos();
    }
    if (acao === "buscar_relatorio_word") {
      if (!pastaFotosId || !numeroContrato || !numeroMedicao) {
        return resposta({ ok: false, erro: "Informe a pasta Fotos, o contrato e a medição." });
      }
      const pastaRelatorios = localizarPastaRelatoriosDoContrato(pastaFotosId, numeroContrato);
      const nomeArquivo = `Relatório fotográfico - ${numeroContrato} - Medição ${String(numeroMedicao).padStart(2, "0")}.docx`;
      const arquivo = localizarArquivoRelatorio(pastaRelatorios, nomeArquivo);
      const syncToken = String(e.parameter.sync_token || "").trim();
      const propriedades = PropertiesService.getScriptProperties();
      const chaveSync = syncToken ? "word-sync:" + syncToken : "";
      const syncStatus = chaveSync ? propriedades.getProperty(chaveSync) : null;
      if (syncStatus) propriedades.deleteProperty(chaveSync);
      return resposta(arquivo
        ? { ok: true, encontrado: true, file_id: arquivo.getId(), file_url: arquivo.getUrl(), file_name: arquivo.getName(), updated_at: arquivo.getLastUpdated().toISOString(), sync_status: syncStatus ? JSON.parse(syncStatus) : null, script_version: VERSAO_WORD_SYNC }
        : { ok: true, encontrado: false, sync_status: syncStatus ? JSON.parse(syncStatus) : null, script_version: VERSAO_WORD_SYNC });
    }
    if (acao === "imagem") {
      if (!arquivoId || !pastaFotosId || !numeroMedicao) {
        return resposta({
          ok: false,
          erro: "Informe arquivo_id, drive_pasta_id e medicao."
        });
      }

      // Restringe o proxy à pasta da medição solicitada para não permitir
      // consultar arquivos arbitrários acessíveis à conta que executa o script.
      const numeroNormalizadoImagem = String(numeroMedicao)
        .trim()
        .replace(/^0+/, "") || "0";
      const chaveCachePasta = `pasta-medicao:${pastaFotosId}:${numeroNormalizadoImagem}`;
      const cacheScript = CacheService.getScriptCache();
      let pastaMedicaoImagem = null;
      const pastaMedicaoIdEmCache = cacheScript.get(chaveCachePasta);

      if (pastaMedicaoIdEmCache) {
        try {
          pastaMedicaoImagem = DriveApp.getFolderById(pastaMedicaoIdEmCache);
        } catch (erroCache) {
          cacheScript.remove(chaveCachePasta);
        }
      }

      if (!pastaMedicaoImagem) {
        const pastaFotosImagem = DriveApp.getFolderById(pastaFotosId);
        const pastasImagem = pastaFotosImagem.getFolders();

        while (pastasImagem.hasNext()) {
          const pasta = pastasImagem.next();
          const correspondencia = pasta.getName().trim().match(/^Medição\s+0*(\d+)/i);
          if (!correspondencia) continue;

          const numeroDaPasta = correspondencia[1].replace(/^0+/, "") || "0";
          if (numeroDaPasta === numeroNormalizadoImagem) {
            pastaMedicaoImagem = pasta;
            cacheScript.put(chaveCachePasta, pasta.getId(), 21600);
            break;
          }
        }
      }

      if (!pastaMedicaoImagem) {
        return resposta({
          ok: false,
          erro: `A pasta da Medição ${numeroMedicao} não foi encontrada.`
        });
      }

      const arquivo = DriveApp.getFileById(
        arquivoId
      );

      if (!arquivo.getMimeType().startsWith("image/")) {
        return resposta({
          ok: false,
          erro: "O arquivo solicitado não é uma imagem."
        });
      }

      const pais = arquivo.getParents();
      let arquivoPertenceAMedicao = false;
      while (pais.hasNext()) {
        if (pais.next().getId() === pastaMedicaoImagem.getId()) {
          arquivoPertenceAMedicao = true;
          break;
        }
      }

      if (!arquivoPertenceAMedicao) {
        return resposta({
          ok: false,
          erro: "A imagem não pertence à pasta da medição solicitada."
        });
      }

      const miniatura = tamanhoImagem !== "original"
        ? arquivo.getThumbnail()
        : null;
      const blob = miniatura || arquivo.getBlob();

      const bytes = blob.getBytes();

      const base64 = Utilities.base64Encode(
        bytes
      );

      return resposta({
        ok: true,
        id: arquivo.getId(),
        nome: arquivo.getName(),
        tipo: blob.getContentType(),
        tamanho: bytes.length,
        miniatura: Boolean(miniatura),
        base64: base64
      });
    }

    // =========================================================
    // VALIDAR PASTA DE FOTOS
    // =========================================================

    if (!pastaFotosId) {
      return resposta({
        ok: false,
        erro:
          "Informe o parâmetro drive_pasta_id."
      });
    }

    const pastaFotos =
      DriveApp.getFolderById(
        pastaFotosId
      );

    // =========================================================
    // LISTAR MEDIÇÕES
    // =========================================================

    if (acao === "listar_medicoes") {
      const pastas =
        pastaFotos.getFolders();

      const medicoes = [];

      while (pastas.hasNext()) {
        const pasta =
          pastas.next();

        const nome =
          pasta.getName().trim();

        const correspondencia =
          nome.match(
            /^Medição\s+0*(\d+)/i
          );

        if (!correspondencia) {
          continue;
        }

        const numero =
          Number(
            correspondencia[1]
          );

        medicoes.push({
          numero: numero,
          nome: nome,
          id: pasta.getId()
        });
      }

      medicoes.sort(
        (a, b) =>
          a.numero - b.numero
      );

      return resposta({
        ok: true,
        pastaFotos: {
          id: pastaFotos.getId(),
          nome: pastaFotos.getName()
        },
        quantidade:
          medicoes.length,
        medicoes: medicoes
      });
    }

    // =========================================================
    // CONSULTAR UMA MEDIÇÃO
    // =========================================================

    if (!numeroMedicao) {
      return resposta({
        ok: false,
        erro:
          "Informe o parâmetro medicao."
      });
    }

    const pastas =
      pastaFotos.getFolders();

    const numeroNormalizado =
      String(numeroMedicao)
        .trim()
        .replace(/^0+/, "") || "0";

    let pastaMedicao = null;

    while (pastas.hasNext()) {
      const pasta =
        pastas.next();

      const nome =
        pasta.getName().trim();

      const correspondencia =
        nome.match(
          /^Medição\s+0*(\d+)/i
        );

      if (!correspondencia) {
        continue;
      }

      const numeroDaPasta =
        correspondencia[1]
          .replace(/^0+/, "") ||
        "0";

      if (
        numeroDaPasta ===
        numeroNormalizado
      ) {
        pastaMedicao = pasta;
        break;
      }
    }

    if (!pastaMedicao) {
      return resposta({
        ok: true,
        encontrada: false,
        pastaFotos: {
          id: pastaFotos.getId(),
          nome: pastaFotos.getName()
        },
        medicao:
          Number(numeroMedicao),
        mensagem:
          `A pasta da Medição ${numeroMedicao} não foi encontrada.`
      });
    }

    // =========================================================
    // LISTAR ARQUIVOS
    // =========================================================

    const arquivos =
      pastaMedicao.getFiles();

    const fotos = [];
    const videos = [];
    const outros = [];

    while (arquivos.hasNext()) {
      const arquivo =
        arquivos.next();

      const item = {
        id: arquivo.getId(),
        nome: arquivo.getName(),
        tipo: arquivo.getMimeType(),
        tamanho: arquivo.getSize()
      };

      if (
        arquivo
          .getMimeType()
          .startsWith("image/")
      ) {
        fotos.push(item);

      } else if (
        arquivo
          .getMimeType()
          .startsWith("video/")
      ) {
        videos.push(item);

      } else {
        outros.push(item);
      }
    }

    const ordenar = (a, b) =>
      a.nome.localeCompare(
        b.nome,
        "pt-BR",
        {
          numeric: true,
          sensitivity: "base"
        }
      );

    fotos.sort(ordenar);
    videos.sort(ordenar);
    outros.sort(ordenar);

    return resposta({
      ok: true,
      encontrada: true,

      pastaFotos: {
        id: pastaFotos.getId(),
        nome: pastaFotos.getName()
      },

      pastaMedicao: {
        id: pastaMedicao.getId(),
        nome: pastaMedicao.getName()
      },

      medicao:
        Number(numeroMedicao),

      quantidade: {
        fotos: fotos.length,
        videos: videos.length,
        outros: outros.length,
        total:
          fotos.length +
          videos.length +
          outros.length
      },

      fotos: fotos,
      videos: videos,
      outros: outros
    });

  } catch (erro) {
    return resposta({
      ok: false,
      erro: erro.message
    });
  }
}


// =========================================================
// =========================================================
// IMPORTAR ESTRUTURA DE CONTRATOS DO DRIVE
// =========================================================

function listarEstruturaContratos(pastaContratosId) {
  const raiz = DriveApp.getFolderById(pastaContratosId);
  const contratos = [];
  const avisos = [];
  const pastasContrato = raiz.getFolders();

  while (pastasContrato.hasNext()) {
    const pastaContrato = pastasContrato.next();
    const nomePastaContrato = pastaContrato.getName().trim();
    const correspondenciaContrato = nomePastaContrato.match(/^Contrato\s+(.+?)\s*[-–—]\s*(.+)$/i);
    if (!correspondenciaContrato) {
      avisos.push(`Contrato ignorado por não seguir o padrão "Contrato número - nome": ${nomePastaContrato}`);
      continue;
    }

    const numero = correspondenciaContrato[1].trim();
    const nome = correspondenciaContrato[2].trim();
    const pastaObras = encontrarSubpasta(pastaContrato, "OBRAS EM ANDAMENTO");
    if (!pastaObras) {
      avisos.push(`Pasta OBRAS EM ANDAMENTO não encontrada em ${nomePastaContrato}`);
      continue;
    }

    const frentes = [];
    const pastasFrentes = pastaObras.getFolders();
    while (pastasFrentes.hasNext()) {
      const pastaFrente = pastasFrentes.next();
      const nomeFrente = pastaFrente.getName().trim();
      if (/^(custo|fotos)$/i.test(nomeFrente)) continue;

      const pastaFotos = encontrarSubpasta(pastaFrente, "Fotos");
      if (!pastaFotos) {
        avisos.push(`Pasta Fotos não encontrada na frente ${nomeFrente} (${nomePastaContrato})`);
        continue;
      }

      const medicoes = [];
      const pastasMedicoes = pastaFotos.getFolders();
      while (pastasMedicoes.hasNext()) {
        const pastaMedicao = pastasMedicoes.next();
        const nomeMedicao = pastaMedicao.getName().trim();
        const correspondenciaMedicao = nomeMedicao.match(/^Medição\s+0*(\d+)/i);
        if (!correspondenciaMedicao) continue;
        medicoes.push({
          numero: Number(correspondenciaMedicao[1]),
          nome: nomeMedicao,
          id: pastaMedicao.getId()
        });
      }
      medicoes.sort((a, b) => a.numero - b.numero);
      frentes.push({
        nome: nomeFrente,
        drive_pasta_id: pastaFotos.getId(),
        medicoes: medicoes
      });
    }

    contratos.push({ numero: numero, nome: nome, frentes: frentes });
  }

  contratos.sort((a, b) => a.numero.localeCompare(b.numero, "pt-BR", { numeric: true }));
  return resposta({ ok: true, raiz: { id: raiz.getId(), nome: raiz.getName() }, contratos: contratos, avisos: avisos });
}

// =========================================================
// SINCRONIZAÇÃO DE ESTRUTURA DE CONTRATOS/FRENTES (DRIVE <-> APP)
// =========================================================
// Mantém a pasta de cada contrato/frente no Drive e o status/situação no
// app sempre no mesmo lugar: quando o app cria ou inativa/arquiva/finaliza
// algo, a pasta certa é criada/movida aqui; quando alguém mexe direto no
// Drive (cria ou move uma pasta manualmente), o app detecta a diferença na
// próxima sincronização (ver sincronizarEstruturaDrive em
// src/services/estruturaDrive.js) e atualiza o banco.
//
// Estrutura esperada:
//   Contratos Ativos/      (PASTA_CONTRATOS_ATIVOS_ID)
//   Contratos Inativos/    (PASTA_CONTRATOS_INATIVOS_ID)
//     Contrato {numero} - {nome}/
//       OBRAS EM ANDAMENTO/
//         {nome da frente}/
//           Fotos/
//             Medição NN/
//       OBRAS FINALIZADAS/
//         {nome da frente}/
//           Fotos/
//             Medição NN/

// Varre uma das duas pastas raiz (Ativos ou Inativos) e devolve os
// contratos/frentes/medições encontrados, já com o status e a situação
// implícitos pela localização de cada pasta.
function escanearRaizContratos(raizId, statusContrato) {
  const raiz = DriveApp.getFolderById(raizId);
  const contratos = [];
  const avisos = [];
  const pastasContrato = raiz.getFolders();

  while (pastasContrato.hasNext()) {
    const pastaContrato = pastasContrato.next();
    const nomePastaContrato = pastaContrato.getName().trim();
    const correspondenciaContrato = nomePastaContrato.match(/^Contrato\s+(.+?)\s*[-–—]\s*(.+)$/i);
    if (!correspondenciaContrato) {
      avisos.push(`Contrato ignorado por não seguir o padrão "Contrato número - nome": ${nomePastaContrato}`);
      continue;
    }

    const numero = correspondenciaContrato[1].trim();
    const nome = correspondenciaContrato[2].trim();
    const frentes = [];

    [
      { nomePasta: "OBRAS EM ANDAMENTO", situacao: "em_andamento" },
      { nomePasta: "OBRAS FINALIZADAS", situacao: "finalizada" },
    ].forEach(function (grupo) {
      const pastaObras = encontrarSubpasta(pastaContrato, grupo.nomePasta);
      if (!pastaObras) return;

      const pastasFrentes = pastaObras.getFolders();
      while (pastasFrentes.hasNext()) {
        const pastaFrente = pastasFrentes.next();
        const nomeFrente = pastaFrente.getName().trim();
        if (/^(custo|fotos)$/i.test(nomeFrente)) continue;

        const pastaFotos = encontrarSubpasta(pastaFrente, "Fotos");
        if (!pastaFotos) {
          avisos.push(`Pasta Fotos não encontrada na frente ${nomeFrente} (${nomePastaContrato})`);
          return;
        }

        const medicoes = [];
        const pastasMedicoes = pastaFotos.getFolders();
        while (pastasMedicoes.hasNext()) {
          const pastaMedicao = pastasMedicoes.next();
          const nomeMedicao = pastaMedicao.getName().trim();
          const correspondenciaMedicao = nomeMedicao.match(/^Medição\s+0*(\d+)/i);
          if (!correspondenciaMedicao) continue;
          medicoes.push({
            numero: Number(correspondenciaMedicao[1]),
            nome: nomeMedicao,
            id: pastaMedicao.getId()
          });
        }
        medicoes.sort((a, b) => a.numero - b.numero);

        frentes.push({
          nome: nomeFrente,
          drive_pasta_id: pastaFotos.getId(),
          situacao: grupo.situacao,
          medicoes: medicoes
        });
      }
    });

    contratos.push({
      numero: numero,
      nome: nome,
      drive_pasta_id: pastaContrato.getId(),
      status: statusContrato,
      frentes: frentes
    });
  }

  return { contratos: contratos, avisos: avisos };
}

// Ação GET usada pelo app a cada abertura da tela de Contratos/Frentes
// (sincronização silenciosa) e pelo botão "Sincronizar com Drive".
function sincronizarEstruturaContratos() {
  const ativos = escanearRaizContratos(PASTA_CONTRATOS_ATIVOS_ID, "ativo");
  const inativos = escanearRaizContratos(PASTA_CONTRATOS_INATIVOS_ID, "encerrado");
  const contratos = ativos.contratos.concat(inativos.contratos);
  contratos.sort((a, b) => a.numero.localeCompare(b.numero, "pt-BR", { numeric: true }));
  return resposta({ ok: true, contratos: contratos, avisos: ativos.avisos.concat(inativos.avisos) });
}

// Troca o(s) pai(s) atual(is) de uma pasta por um único pai novo. O Drive
// raramente permite mais de um pai ao mesmo tempo; removemos todos os
// antigos para a pasta nunca ficar "grudada" em dois lugares.
function moverPastaParaNovoPai(pasta, novoPai) {
  if (pasta.getId() === novoPai.getId()) return;
  const paisAtuais = pasta.getParents();
  const idsParaRemover = [];
  while (paisAtuais.hasNext()) {
    const pai = paisAtuais.next();
    if (pai.getId() !== novoPai.getId()) idsParaRemover.push(pai.getId());
  }
  novoPai.addFolder(pasta);
  idsParaRemover.forEach(function (idPai) {
    DriveApp.getFolderById(idPai).removeFolder(pasta);
  });
}

// Cria a pasta de um contrato novo dentro de "Contratos Ativos", já com as
// subpastas OBRAS EM ANDAMENTO e OBRAS FINALIZADAS prontas para receber
// frentes.
function criarPastaContrato(numero, nome) {
  if (!numero || !nome) throw new Error("Informe o número e o nome do contrato.");
  const raiz = DriveApp.getFolderById(PASTA_CONTRATOS_ATIVOS_ID);
  const nomePasta = nomeSeguroArquivo(`Contrato ${numero} - ${nome}`);
  const pastaContrato = raiz.createFolder(nomePasta);
  pastaContrato.createFolder("OBRAS EM ANDAMENTO");
  pastaContrato.createFolder("OBRAS FINALIZADAS");
  return resposta({ ok: true, drive_pasta_id: pastaContrato.getId() });
}

// Move a pasta de um contrato entre "Contratos Ativos" e "Contratos
// Inativos" quando o status muda para/de "ativo" no app.
function moverPastaContrato(drivePastaContratoId, ativo) {
  if (!drivePastaContratoId) throw new Error("Informe a pasta do contrato a mover.");
  const pasta = DriveApp.getFolderById(drivePastaContratoId);
  const destino = DriveApp.getFolderById(ativo ? PASTA_CONTRATOS_ATIVOS_ID : PASTA_CONTRATOS_INATIVOS_ID);
  moverPastaParaNovoPai(pasta, destino);
  return resposta({ ok: true });
}

// Cria a pasta de uma frente nova (com a subpasta Fotos) dentro de "OBRAS
// EM ANDAMENTO" do contrato indicado.
function criarPastaFrente(drivePastaContratoId, nomeFrente) {
  if (!drivePastaContratoId || !nomeFrente) throw new Error("Informe o contrato e o nome da frente.");
  const pastaContrato = DriveApp.getFolderById(drivePastaContratoId);
  const pastaObras = encontrarSubpasta(pastaContrato, "OBRAS EM ANDAMENTO") || pastaContrato.createFolder("OBRAS EM ANDAMENTO");
  const pastaFrente = pastaObras.createFolder(nomeSeguroArquivo(nomeFrente));
  const pastaFotos = pastaFrente.createFolder("Fotos");
  return resposta({ ok: true, drive_pasta_id: pastaFotos.getId() });
}

// Move a pasta de uma frente (localizada a partir da pasta Fotos) entre
// OBRAS EM ANDAMENTO e OBRAS FINALIZADAS — do mesmo contrato ou, se
// drivePastaContratoDestinoId vier preenchido, para outro contrato (usado
// na transferência de frente entre contratos).
function moverPastaFrente(drivePastaFotosId, emAndamento, drivePastaContratoDestinoId) {
  if (!drivePastaFotosId) throw new Error("Informe a pasta Fotos da frente a mover.");
  const pastaFotos = DriveApp.getFolderById(drivePastaFotosId);
  const paisFotos = pastaFotos.getParents();
  if (!paisFotos.hasNext()) throw new Error("Não encontrei a pasta da frente a partir da pasta Fotos.");
  const pastaFrente = paisFotos.next();

  let pastaContrato;
  if (drivePastaContratoDestinoId) {
    pastaContrato = DriveApp.getFolderById(drivePastaContratoDestinoId);
  } else {
    const paisObras = pastaFrente.getParents();
    if (!paisObras.hasNext()) throw new Error("Não encontrei o contrato a partir da pasta da frente.");
    const paisContrato = paisObras.next().getParents();
    if (!paisContrato.hasNext()) throw new Error("Não encontrei o contrato a partir da pasta de obras.");
    pastaContrato = paisContrato.next();
  }

  const nomeSubpasta = emAndamento ? "OBRAS EM ANDAMENTO" : "OBRAS FINALIZADAS";
  const pastaDestino = encontrarSubpasta(pastaContrato, nomeSubpasta) || pastaContrato.createFolder(nomeSubpasta);
  moverPastaParaNovoPai(pastaFrente, pastaDestino);
  return resposta({ ok: true, drive_pasta_contrato_id: pastaContrato.getId() });
}

function encontrarSubpasta(pasta, nomeEsperado) {
  const pastas = pasta.getFolders();
  while (pastas.hasNext()) {
    const candidata = pastas.next();
    if (candidata.getName().trim().toLocaleLowerCase() === nomeEsperado.toLocaleLowerCase()) {
      return candidata;
    }
  }
  return null;
}

// =========================================================
// RECEBER E SINCRONIZAR O WORD DO RELATÓRIO
// =========================================================

function doPost(e) {
  let syncToken = String(e && e.parameter ? e.parameter.sync_token || "" : "").trim().slice(0, 100);
  try {
    const body = JSON.parse(e && e.postData ? e.postData.contents : "{}");
    const tokenAutenticacao = (e && e.parameter ? e.parameter.token : null) || body.token;
    if (!validarToken(tokenAutenticacao)) {
      return respostaNaoAutorizado();
    }
    syncToken = syncToken || String(body.sync_token || "").trim().slice(0, 100);
    if (body.acao === "salvar_custo" || body.acao === "excluir_custo" || body.acao === "ajustar_quantidade_custo") {
      return processarAcaoCusto(body);
    }
    if (body.acao === "criar_pasta_contrato") {
      return criarPastaContrato(String(body.numero || "").trim(), String(body.nome || "").trim());
    }
    if (body.acao === "mover_pasta_contrato") {
      return moverPastaContrato(String(body.drive_pasta_id || "").trim(), Boolean(body.ativo));
    }
    if (body.acao === "criar_pasta_frente") {
      return criarPastaFrente(String(body.drive_pasta_contrato_id || "").trim(), String(body.nome_frente || "").trim());
    }
    if (body.acao === "mover_pasta_frente") {
      return moverPastaFrente(
        String(body.drive_pasta_id || "").trim(),
        Boolean(body.em_andamento),
        body.drive_pasta_contrato_destino_id ? String(body.drive_pasta_contrato_destino_id).trim() : null
      );
    }
    // Envio do Word em pedaços pequenos (19/11): confirmado pelo histórico
    // de execuções do Apps Script que um envio único grande demais é
    // descartado pela própria infraestrutura do Google antes de chegar a
    // rodar o doPost (nenhuma execução aparece no log). Dividindo em
    // pedaços pequenos não existe mais um teto prático de tamanho.
    if (body.acao === "enviar_relatorio_word_pedaco") {
      return resposta(receberPedacoRelatorioWord(body));
    }
    if (body.acao === "finalizar_relatorio_word") {
      const resultadoFinal = finalizarRelatorioWordPorPedacos(body, syncToken);
      if (syncToken) PropertiesService.getScriptProperties().setProperty("word-sync:" + syncToken, JSON.stringify(resultadoFinal));
      return resposta(resultadoFinal);
    }
    if (body.acao !== "salvar_relatorio_word") {
      return resposta({ ok: false, erro: "Ação POST não reconhecida." });
    }
    const idFotos = String(body.drive_pasta_id || "").trim();
    const numeroContrato = String(body.contrato_numero || "").trim();
    const numeroMedicao = String(body.medicao_numero || "").trim();
    const arquivoBase64 = String(body.arquivo_base64 || "").trim();
    if (!idFotos || !numeroContrato || !numeroMedicao || !arquivoBase64) {
      return resposta({ ok: false, erro: "Faltam dados do contrato, medição, pasta Fotos ou conteúdo Word." });
    }
    // Mantido apenas como caminho de reserva (não usado mais pelo app, que
    // agora sempre envia em pedaços — ver enviar_relatorio_word_pedaco e
    // finalizar_relatorio_word). Não existe limite oficial documentado pelo
    // Google para o tamanho do doPost recebido pelo Apps Script.
    if (arquivoBase64.length > 48 * 1024 * 1024) {
      return resposta({ ok: false, erro: "O Word excede o limite de envio do Apps Script. Reduza a quantidade de fotos." });
    }

    const nomeArquivo = `Relatório fotográfico - ${numeroContrato} - Medição ${String(numeroMedicao).padStart(2, "0")}.docx`;
    const pastaRelatorios = localizarPastaRelatoriosDoContrato(idFotos, numeroContrato);
    const bytes = Utilities.base64Decode(arquivoBase64);
    const arquivo = gravarArquivoWordNoDrive(pastaRelatorios, nomeArquivo, bytes, body.drive_file_id);

    const resultado = {
      ok: true,
      file_id: arquivo.getId(),
      file_url: arquivo.getUrl(),
      file_name: arquivo.getName(),
      pasta_id: pastaRelatorios.getId(),
      pasta_nome: pastaRelatorios.getName(),
      updated_at: arquivo.getLastUpdated().toISOString()
    };
    if (syncToken) PropertiesService.getScriptProperties().setProperty("word-sync:" + syncToken, JSON.stringify(resultado));
    return resposta(resultado);
  } catch (erro) {
    console.error("Erro ao sincronizar Word do relatório:", erro);
    if (syncToken) {
      PropertiesService.getScriptProperties().setProperty("word-sync:" + syncToken, JSON.stringify({ ok: false, erro: erro.message || "Falha ao salvar o Word no Google Drive." }));
    }
    return resposta({ ok: false, erro: erro.message || "Não foi possível salvar o Word no Google Drive." });
  }
}

// Cria ou atualiza o .docx do relatório no Drive a partir dos bytes já
// decodificados. Compartilhado entre o envio único antigo (reserva) e a
// finalização do envio em pedaços, para as duas formas nunca divergirem.
//
// O upload para o Drive é feito em pedaços (upload retomável da API v3,
// não confundir com o "envio em pedaços" do navegador até aqui) porque o
// UrlFetchApp do Apps Script tem um limite de 50 MB por requisição,
// documentado pelo Google (https://developers.google.com/apps-script/guides/services/quotas,
// "URL Fetch POST size"). Um relatório com muitas fotos grandes passa
// facilmente desse tamanho; sem isso, o envio para o Drive falharia (ou
// estouraria o tempo de execução de 6 minutos do script) exatamente no
// mesmo tipo de limite que já resolvemos do lado do envio do navegador.
function gravarArquivoWordNoDrive(pastaRelatorios, nomeArquivo, bytes, driveFileIdFornecido) {
  const mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const arquivoExistente = String(driveFileIdFornecido || "").trim()
    ? DriveApp.getFileById(String(driveFileIdFornecido).trim())
    : localizarArquivoRelatorio(pastaRelatorios, nomeArquivo);
  const arquivoExistenteId = arquivoExistente ? arquivoExistente.getId() : "";

  if (arquivoExistenteId && arquivoEstaNaPasta(arquivoExistenteId, pastaRelatorios.getId())) {
    enviarBytesParaDriveEmPedacos(bytes, mimeType, null, arquivoExistenteId);
    return DriveApp.getFileById(arquivoExistenteId).setName(nomeArquivo);
  }
  const novoArquivoId = enviarBytesParaDriveEmPedacos(bytes, mimeType, { name: nomeArquivo, parents: [pastaRelatorios.getId()] }, null);
  return DriveApp.getFileById(novoArquivoId);
}

// Envia bytes para o Drive em pedaços usando o protocolo de upload
// retomável (resumable upload) da Drive API v3: primeiro abre uma sessão
// de envio, depois manda o conteúdo em pedaços (múltiplos de 256 KB,
// exigido pela própria API) até confirmar o envio completo. Usado tanto
// para criar um arquivo novo (passe metadadosParaCriar) quanto para
// atualizar um já existente (passe arquivoIdParaAtualizar).
function enviarBytesParaDriveEmPedacos(bytes, mimeType, metadadosParaCriar, arquivoIdParaAtualizar) {
  const TAMANHO_PEDACO_DRIVE = 8 * 1024 * 1024; // 8 MB por pedaço, múltiplo de 256 KB
  const urlSessao = arquivoIdParaAtualizar
    ? `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(arquivoIdParaAtualizar)}?uploadType=resumable`
    : "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable";

  const aberturaSessao = UrlFetchApp.fetch(urlSessao, {
    method: arquivoIdParaAtualizar ? "patch" : "post",
    contentType: "application/json; charset=UTF-8",
    headers: { Authorization: `Bearer ${ScriptApp.getOAuthToken()}` },
    payload: JSON.stringify(metadadosParaCriar || {}),
    muteHttpExceptions: true
  });
  if (aberturaSessao.getResponseCode() < 200 || aberturaSessao.getResponseCode() >= 300) {
    throw new Error(`Não foi possível iniciar o envio do Word para o Drive (HTTP ${aberturaSessao.getResponseCode()}).`);
  }
  const cabecalhos = aberturaSessao.getAllHeaders();
  const urlUpload = cabecalhos.Location || cabecalhos.location;
  if (!urlUpload) throw new Error("O Drive não retornou a sessão de envio do Word (cabeçalho Location ausente).");

  const total = bytes.length;
  let enviado = 0;
  let respostaFinal = null;
  while (enviado < total) {
    const fim = Math.min(enviado + TAMANHO_PEDACO_DRIVE, total);
    const pedaco = bytes.slice(enviado, fim);
    const resposta = UrlFetchApp.fetch(urlUpload, {
      method: "put",
      contentType: mimeType,
      headers: { "Content-Range": `bytes ${enviado}-${fim - 1}/${total}` },
      payload: pedaco,
      muteHttpExceptions: true
    });
    const codigo = resposta.getResponseCode();
    if (codigo === 308) {
      enviado = fim;
      continue;
    }
    if (codigo >= 200 && codigo < 300) {
      enviado = fim;
      respostaFinal = resposta;
      break;
    }
    throw new Error(`Falha ao enviar o Word para o Drive em pedaços (HTTP ${codigo}).`);
  }
  if (!respostaFinal) throw new Error("O envio do Word ao Drive terminou sem confirmação final.");
  const corpo = JSON.parse(respostaFinal.getContentText());
  return corpo.id;
}

// =========================================================
// ENVIO DO WORD EM PEDAÇOS
// =========================================================
// Cada pedaço é um texto base64 pequeno, salvo como um arquivo temporário
// na pasta "Dados do aplicativo" dentro da pasta Relatório fotográfico do
// contrato. Ao final, finalizar_relatorio_word lê todos os pedaços na
// ordem, remonta o base64 completo e grava o .docx no Drive.

function obterPastaPedacosRelatorio(pastaRelatorios) {
  return encontrarSubpasta(pastaRelatorios, "Dados do aplicativo") || pastaRelatorios.createFolder("Dados do aplicativo");
}

// Igual a localizarPastaRelatoriosDoContrato, mas com cache (mesmo padrão já
// usado para a pasta de medição, no proxy de imagem). Sem isso, cada pedaço
// do envio do Word (podem ser dezenas, para relatórios grandes) repetia a
// subida pela árvore de pastas do Drive até achar o contrato — desperdício
// de tempo que, somado, ajudava a estourar o limite de 6 minutos de
// execução do script na finalização.
function localizarPastaRelatoriosDoContratoComCache(idPastaFotos, numeroContrato) {
  const chaveCache = `pasta-relatorios:${idPastaFotos}:${numeroContrato}`;
  const cache = CacheService.getScriptCache();
  const idEmCache = cache.get(chaveCache);
  if (idEmCache) {
    try {
      return DriveApp.getFolderById(idEmCache);
    } catch (erroCache) {
      cache.remove(chaveCache);
    }
  }
  const pasta = localizarPastaRelatoriosDoContrato(idPastaFotos, numeroContrato);
  cache.put(chaveCache, pasta.getId(), 21600);
  return pasta;
}

function receberPedacoRelatorioWord(body) {
  const syncToken = String(body.sync_token || "").trim().slice(0, 100);
  const indice = Number(body.indice_pedaco);
  const total = Number(body.total_pedacos);
  const pedacoBase64 = String(body.pedaco_base64 || "");
  const idFotos = String(body.drive_pasta_id || "").trim();
  const numeroContrato = String(body.contrato_numero || "").trim();

  if (!syncToken || !idFotos || !numeroContrato || !Number.isInteger(indice) || indice < 0 || !Number.isInteger(total) || total <= 0) {
    throw new Error("Dados incompletos para receber o pedaço do Word.");
  }

  const pastaRelatorios = localizarPastaRelatoriosDoContratoComCache(idFotos, numeroContrato);
  const pastaPedacos = obterPastaPedacosRelatorio(pastaRelatorios);

  // Limpeza de pedaços de tentativas abandonadas (token diferente, com mais
  // de 6 horas). Roda só no primeiro pedaço para não repetir a varredura a
  // cada requisição; uma falha aqui nunca deve interromper o envio atual.
  if (indice === 0) {
    try {
      const limite = Date.now() - 6 * 60 * 60 * 1000;
      const prefixoAtual = `pedaco-word-${syncToken}-`;
      const arquivos = pastaPedacos.getFiles();
      while (arquivos.hasNext()) {
        const arquivo = arquivos.next();
        const nome = arquivo.getName();
        if (/^pedaco-word-/.test(nome) && nome.indexOf(prefixoAtual) !== 0 && arquivo.getLastUpdated().getTime() < limite) {
          arquivo.setTrashed(true);
        }
      }
    } catch (erroLimpeza) {
      console.warn("Falha ao limpar pedaços antigos do Word:", erroLimpeza);
    }
  }

  const nomePedaco = `pedaco-word-${syncToken}-${String(indice).padStart(4, "0")}`;
  const existentes = pastaPedacos.getFilesByName(nomePedaco);
  while (existentes.hasNext()) existentes.next().setTrashed(true);
  pastaPedacos.createFile(Utilities.newBlob(pedacoBase64, "text/plain", nomePedaco));

  return { ok: true, indice_pedaco: indice, total_pedacos: total };
}

function finalizarRelatorioWordPorPedacos(body, syncToken) {
  const idFotos = String(body.drive_pasta_id || "").trim();
  const numeroContrato = String(body.contrato_numero || "").trim();
  const numeroMedicao = String(body.medicao_numero || "").trim();
  const totalPedacos = Number(body.total_pedacos);

  if (!syncToken || !idFotos || !numeroContrato || !numeroMedicao || !Number.isInteger(totalPedacos) || totalPedacos <= 0) {
    throw new Error("Faltam dados do contrato, medição, pasta Fotos ou total de pedaços.");
  }

  const pastaRelatorios = localizarPastaRelatoriosDoContratoComCache(idFotos, numeroContrato);
  const pastaPedacos = obterPastaPedacosRelatorio(pastaRelatorios);

  // Lista a pasta uma única vez (1 chamada à API do Drive) em vez de uma
  // busca por nome por pedaço — para um relatório grande (dezenas de
  // pedaços), isso evita dezenas de idas e vindas desnecessárias ao Drive
  // bem no trecho que mais arrisca estourar os 6 minutos de execução.
  const prefixoPedacos = `pedaco-word-${syncToken}-`;
  const mapaPedacos = new Map();
  const todosOsArquivos = pastaPedacos.getFiles();
  while (todosOsArquivos.hasNext()) {
    const arquivo = todosOsArquivos.next();
    const nome = arquivo.getName();
    if (nome.indexOf(prefixoPedacos) === 0) mapaPedacos.set(nome, arquivo);
  }

  const pedacos = [];
  for (let indice = 0; indice < totalPedacos; indice += 1) {
    const nomePedaco = `${prefixoPedacos}${String(indice).padStart(4, "0")}`;
    const arquivo = mapaPedacos.get(nomePedaco);
    if (!arquivo) {
      throw new Error(`O pedaço ${indice + 1} de ${totalPedacos} do Word não chegou ao Drive. Tente sincronizar novamente.`);
    }
    pedacos.push(arquivo);
  }

  let arquivoBase64 = "";
  pedacos.forEach((arquivo) => {
    arquivoBase64 += arquivo.getBlob().getDataAsString();
  });
  if (!arquivoBase64) {
    throw new Error("Os pedaços do Word chegaram vazios. Tente sincronizar novamente.");
  }

  const nomeArquivo = `Relatório fotográfico - ${numeroContrato} - Medição ${String(numeroMedicao).padStart(2, "0")}.docx`;
  const bytes = Utilities.base64Decode(arquivoBase64);
  const arquivo = gravarArquivoWordNoDrive(pastaRelatorios, nomeArquivo, bytes, body.drive_file_id);

  pedacos.forEach((pedaco) => pedaco.setTrashed(true));

  return {
    ok: true,
    file_id: arquivo.getId(),
    file_url: arquivo.getUrl(),
    file_name: arquivo.getName(),
    pasta_id: pastaRelatorios.getId(),
    pasta_nome: pastaRelatorios.getName(),
    updated_at: arquivo.getLastUpdated().toISOString()
  };
}

// =========================================================
// PLANILHA DE CUSTOS POR FRENTE (BASE GOOGLE SHEETS + CÓPIA XLSX)
// =========================================================

// O app React roda em modo de desenvolvimento com <StrictMode>, que
// dispara os efeitos de montagem da tela duas vezes de propósito. Isso faz
// com que esta função (chamada ao abrir a tela de Custos) seja executada
// duas vezes quase ao mesmo tempo para a mesma frente. Sem um bloqueio, as
// duas execuções concorrentes podiam decidir, cada uma por conta própria,
// que uma aba de medição ainda não existia e tentar criá-la ao mesmo
// tempo — a segunda falhava com o erro nativo do Google Sheets "Já existe
// uma página chamada X. Insira outro nome.", mesmo com a comparação de
// nomes já flexibilizada (ver encontrarAbaPorNomeFlexivel), porque as duas
// checagens acontecem antes de qualquer uma das duas criações terminar.
// obterLockCustos() serializa essas execuções para eliminar a corrida.

// Versões "só leitura" de localizarPastaCustosDaFrente/localizarOuCriarPlanilhaCustos,
// usadas pelo caminho rápido sem lock (ver responderCustosDrive): nunca criam
// pasta, planilha ou aba — se algo não existir ainda, devolvem null e quem
// chamou cai no caminho de sempre, protegido pelo lock, que cria o que faltar.
function encontrarPastaCustosExistente(idFotos) {
  const pastaFotos = DriveApp.getFolderById(idFotos);
  const pais = pastaFotos.getParents();
  if (!pais.hasNext()) return null;
  const pastaFrente = pais.next();

  const pastas = pastaFrente.getFolders();
  const candidatas = [];
  while (pastas.hasNext()) {
    const pasta = pastas.next();
    const nome = normalizarTexto(pasta.getName());
    if (nome === "custo" || nome === "custos") candidatas.push(pasta);
  }

  if (candidatas.length === 1) return candidatas[0];
  if (candidatas.length > 1) {
    const comArquivoOriginal = candidatas.filter(pastaTemArquivoDeCustoOriginal);
    if (comArquivoOriginal.length === 1) return comArquivoOriginal[0];
  }
  // Nenhuma pasta, ou caso ambíguo: deixa o caminho com lock decidir (ele
  // cria quando falta, ou lança o erro detalhado de sempre quando é ambíguo).
  return null;
}

function encontrarPlanilhaCustosExistente(pastaCustos, nomeBase) {
  const pastaBase = encontrarSubpasta(pastaCustos, "Dados do aplicativo");
  if (!pastaBase) return null;
  const arquivos = pastaBase.getFilesByName(nomeBase);
  while (arquivos.hasNext()) {
    const arquivo = arquivos.next();
    if (arquivo.getMimeType() === MimeType.GOOGLE_SHEETS) return SpreadsheetApp.openById(arquivo.getId());
  }
  return null;
}

function tentarResponderCustosSemLock(idFotos, nomeBase) {
  const pastaCustos = encontrarPastaCustosExistente(idFotos);
  if (!pastaCustos) return null;

  const planilha = encontrarPlanilhaCustosExistente(pastaCustos, nomeBase);
  if (!planilha) return null;

  // Se ainda não foi feita a primeira importação do Excel original, o
  // caminho de sempre precisa rodar (pode importar dados) — não dá pra
  // responder só de leitura.
  const chaveImportacao = "custos-importado-" + pastaCustos.getId();
  if (PropertiesService.getScriptProperties().getProperty(chaveImportacao) !== "true") return null;

  const nomeXlsx = nomeBase + ".xlsx";
  const arquivoXlsx = localizarArquivoExcelDaPasta(pastaCustos, nomeXlsx);
  if (!arquivoXlsx) return null;

  return resposta({
    ok: true,
    lancamentos: lerLancamentosCustos(planilha),
    importados: 0,
    planilha_url: planilha.getUrl(),
    excel_url: arquivoXlsx.getUrl(),
    excel_nome: arquivoXlsx.getName(),
    pasta_nome: pastaCustos.getName(),
    versao_importador: VERSAO_CUSTOS_IMPORTADOR,
  });
}

function obterLockCustos() {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (erroLock) {
    throw new Error("O sistema está processando outra atualização de custos desta frente no momento. Aguarde alguns segundos e tente novamente.");
  }
  return lock;
}

function responderCustosDrive(parametros, exportarXlsx, reimportar) {
  const idFotos = String(parametros.drive_pasta_id || "").trim();
  const numeroContrato = String(parametros.contrato_numero || "").trim();
  const nomeFrente = String(parametros.frente_nome || "").trim();
  if (!idFotos || !numeroContrato || !nomeFrente) throw new Error("Informe a pasta Fotos, o contrato e a frente.");
  const nomeBase = nomeSeguroArquivo("Custos - " + nomeFrente);

  // Caminho rápido, sem lock: numa simples consulta (listar_custos), se a
  // pasta Custo, a planilha e o Excel já existirem e os dados já tiverem
  // sido importados alguma vez, não há nada para criar nem alterar — é
  // só leitura. Pular o lock aqui evita que a tela de custos de um
  // contrato inteiro (que consulta todas as frentes de uma vez) sirva uma
  // fila só, onde as últimas frentes esperam as anteriores e às vezes
  // acabam caindo no erro de "processando outra atualização". Se faltar
  // qualquer coisa, a função devolve null e cai no caminho de sempre, com
  // lock, que cria o que for preciso.
  if (!reimportar && !exportarXlsx) {
    const respostaRapida = tentarResponderCustosSemLock(idFotos, nomeBase);
    if (respostaRapida) return respostaRapida;
  }

  const lock = obterLockCustos();
  try {
    const pastaCustos = localizarPastaCustosDaFrente(idFotos);
    const planilha = localizarOuCriarPlanilhaCustos(pastaCustos, nomeBase);
    let importados = 0;
    const chaveImportacao = "custos-importado-" + pastaCustos.getId();
    const propriedadesImportacao = PropertiesService.getScriptProperties();
    if (reimportar) {
      importados = reimportarCustosDoExcel(pastaCustos, planilha);
      propriedadesImportacao.setProperty(chaveImportacao, "true");
    } else if (propriedadesImportacao.getProperty(chaveImportacao) !== "true") {
      const resultadoImportacao = importarPlanilhaExistente(pastaCustos, planilha);
      if (resultadoImportacao !== null) {
        importados = resultadoImportacao;
        propriedadesImportacao.setProperty(chaveImportacao, "true");
      }

    }
    const nomeXlsx = nomeBase + ".xlsx";
    let arquivoXlsx = localizarArquivoExcelDaPasta(pastaCustos, nomeXlsx);
    if (!reimportar && (exportarXlsx || !arquivoXlsx)) arquivoXlsx = atualizarCopiaExcel(planilha, pastaCustos, nomeXlsx, arquivoXlsx);
    return resposta({ ok: true, lancamentos: lerLancamentosCustos(planilha), importados: importados, planilha_url: planilha.getUrl(), excel_url: arquivoXlsx.getUrl(), excel_nome: arquivoXlsx.getName(), pasta_nome: pastaCustos.getName(), versao_importador: VERSAO_CUSTOS_IMPORTADOR });
  } finally {
    lock.releaseLock();
  }
}

// Reimporta apenas os dados vindos do Excel. Primeiro lê a fonte em uma planilha
// temporária; só altera a planilha-base depois de validar que encontrou linhas.
// Remove apenas IDs marcados como importados, preservando lançamentos do app.
function reimportarCustosDoExcel(pastaCustos, planilhaDestino) {
  const fonte = localizarFonteOriginalCustos(pastaCustos);
  if (!fonte) throw new Error("Não encontrei uma planilha original do Excel nesta pasta Custo. A planilha-base não foi alterada. Envie a planilha original para a pasta Custo e tente novamente.");
  const pastaDados = encontrarSubpasta(pastaCustos, "Dados do aplicativo");

  let temporaria = null;
  let convertida = null;
  try {
    temporaria = SpreadsheetApp.create("Importação temporária de custos");
    const arquivoTemporario = DriveApp.getFileById(temporaria.getId());
    if (fonte.getMimeType() === MimeType.GOOGLE_SHEETS) {
      // Converte também para uma planilha isolada, evitando alterar a fonte.
      convertida = SpreadsheetApp.openById(fonte.getId());
      copiarLancamentosDaPlanilha(convertida, temporaria, fonte.getId());
    } else {
      const pastaTemporarios = pastaDados || pastaCustos;
      const excelConvertido = converterExcelParaPlanilha(fonte, pastaTemporarios);
      try {
        copiarLancamentosDaPlanilha(SpreadsheetApp.openById(excelConvertido.getId()), temporaria, fonte.getId());
      } finally {
        excelConvertido.setTrashed(true);
      }
    }

    const novasLinhas = [];
    temporaria.getSheets().forEach(function(aba) {
      if (aba.getLastRow() < 5) return;
      const numero = aba.getName() === "Sem medição" ? null : Number(aba.getName().replace(/\D/g, "")) || null;
      const periodo = { numero: numero, inicio: aba.getRange("O2").getDisplayValue(), fim: aba.getRange("O3").getDisplayValue() };
      aba.getRange(5, 1, aba.getLastRow() - 4, 11).getValues().forEach(function(linha) {
        if (linha[0]) novasLinhas.push({ aba: numero ? "Medição " + String(numero).padStart(2, "0") : "Sem medição", periodo: periodo, valores: linha });
      });
    });
    if (!novasLinhas.length) throw new Error("Não encontrei lançamentos válidos na planilha original. A planilha-base não foi alterada.");

    limparLancamentosImportadosDaPlanilha(planilhaDestino);
    novasLinhas.forEach(function(item) {
      const abaDestino = obterAbaCustos(planilhaDestino, item.aba, item.periodo);
      inserirLancamentoNaAba(abaDestino, item.valores);
      formatarAbaCustos(abaDestino);
    });
    // Remove também subtotais de importações antigas sem prefixo importado-.
    limparSubtotaisDeCategoria(planilhaDestino);
    recalcularParticipacoes(planilhaDestino);
    SpreadsheetApp.flush();
    return novasLinhas.length;
  } finally {
    if (temporaria) DriveApp.getFileById(temporaria.getId()).setTrashed(true);
  }
}

function limparLancamentosImportadosDaPlanilha(planilha) {
  planilha.getSheets().forEach(function(aba) {
    if (aba.getLastRow() < 5) return;
    const dados = aba.getRange(5, 1, aba.getLastRow() - 4, 11).getValues();
    for (let i = dados.length - 1; i >= 0; i -= 1) {
      const id = String(dados[i][0] || "");
      if (id.indexOf("importado-") === 0 || ehSubtotalCategoriaSemUnidade(dados[i])) aba.deleteRow(i + 5);
    }
  });
}

function limparSubtotaisDeCategoria(planilha) {
  planilha.getSheets().forEach(function(aba) {
    if (aba.getLastRow() < 5) return;
    const dados = aba.getRange(5, 1, aba.getLastRow() - 4, 11).getValues();
    for (let i = dados.length - 1; i >= 0; i -= 1) {
      if (ehSubtotalCategoriaSemUnidade(dados[i])) aba.deleteRow(i + 5);
    }
  });
}

function ehSubtotalCategoriaSemUnidade(linha) {
  const descricao = String(linha[1] || "").trim();
  return Boolean(categoriaDaDescricao(descricao)) && !String(linha[3] || "").trim();
}

function localizarFonteOriginalCustos(pastaCustos) {
  const propriedades = PropertiesService.getScriptProperties();
  const idRegistrado = propriedades.getProperty("custos-fonte-original-" + pastaCustos.getId());
  let arquivoRegistrado = null;
  if (idRegistrado) {
    try { arquivoRegistrado = DriveApp.getFileById(idRegistrado); } catch (erro) { arquivoRegistrado = null; }
  }

  const pastaDados = encontrarSubpasta(pastaCustos, "Dados do aplicativo");
  const backups = [];
  if (pastaDados) {
    const arquivosDados = pastaDados.getFiles();
    while (arquivosDados.hasNext()) {
      const arquivo = arquivosDados.next();
      if (/^original\s*-/i.test(arquivo.getName()) && (/\.xlsx$/i.test(arquivo.getName()) || arquivo.getMimeType() === MimeType.GOOGLE_SHEETS)) backups.push(arquivo);
    }
  }
  if (backups.length) {
    if (arquivoRegistrado) {
      const nomeEsperado = "Original - " + arquivoRegistrado.getName();
      const correspondente = backups.find(function(arquivo) { return arquivo.getName() === nomeEsperado; });
      if (correspondente) return correspondente;
    }
    if (backups.length === 1) return backups[0];
    throw new Error("Encontrei mais de um backup original na pasta Dados do aplicativo. Nenhum dado foi alterado; verifique qual é o Excel correto.");
  }

  if (arquivoRegistrado && propriedades.getProperty("custos-xlsx-gerado-" + arquivoRegistrado.getId()) !== "true") return arquivoRegistrado;

  const candidatos = [];
  const arquivosCusto = pastaCustos.getFiles();
  while (arquivosCusto.hasNext()) {
    const arquivo = arquivosCusto.next();
    const planilha = /\.xlsx$/i.test(arquivo.getName()) || arquivo.getMimeType() === MimeType.GOOGLE_SHEETS;
    const geradoPeloApp = propriedades.getProperty("custos-xlsx-gerado-" + arquivo.getId()) === "true";
    if (planilha && !geradoPeloApp && arquivo.getId() !== (arquivoRegistrado && arquivoRegistrado.getId())) candidatos.push(arquivo);
  }
  if (candidatos.length === 1) return candidatos[0];
  if (candidatos.length > 1) {
    const nomes = candidatos.slice(0, 5).map(function(arquivo) { return arquivo.getName(); }).join(", ");
    throw new Error("Encontrei mais de uma planilha original na pasta Custo: " + nomes + ". Nenhum dado foi alterado; deixe apenas a planilha correta ou envie uma captura dos nomes.");
  }
  return null;
}

function localizarArquivoExcelDaPasta(pastaCustos, nomePadrao) {
  const chaveFonte = "custos-fonte-original-" + pastaCustos.getId();
  const idFonte = PropertiesService.getScriptProperties().getProperty(chaveFonte);
  if (idFonte) {
    try { return DriveApp.getFileById(idFonte); } catch (erroFonte) { PropertiesService.getScriptProperties().deleteProperty(chaveFonte); }
  }
  const exato = localizarArquivoPeloNome(pastaCustos, nomePadrao);
  if (exato) return exato;
  const arquivos = pastaCustos.getFiles();
  let candidato = null;
  while (arquivos.hasNext()) {
    const arquivo = arquivos.next();
    if (/\.xlsx$/i.test(arquivo.getName())) {
      if (!candidato || arquivo.getLastUpdated().getTime() > candidato.getLastUpdated().getTime()) candidato = arquivo;
    }
  }
  return candidato;
}

function importarPlanilhaExistente(pastaCustos, planilhaDestino) {
  const arquivos = pastaCustos.getFiles();
  const fontes = [];
  while (arquivos.hasNext()) {
    const arquivo = arquivos.next();
    const geradoPeloApp = PropertiesService.getScriptProperties().getProperty("custos-xlsx-gerado-" + arquivo.getId()) === "true";
    if (!geradoPeloApp && (/\.xlsx$/i.test(arquivo.getName()) || arquivo.getMimeType() === MimeType.GOOGLE_SHEETS)) fontes.push(arquivo);
  }
  if (!fontes.length) return null;
  if (fontes.length > 1) {
    const relacionadas = fontes.filter(function(arquivo) { return /custo|medicao|medição|despesa/i.test(arquivo.getName()); });
    if (relacionadas.length === 1) fontes.splice(0, fontes.length, relacionadas[0]);
    else throw new Error("Há mais de uma planilha na pasta Custo e não consegui identificar a principal. Deixe a planilha de custos com nome contendo Custo ou Medição e tente novamente.");
  }
  fontes.sort(function(a, b) { return b.getLastUpdated().getTime() - a.getLastUpdated().getTime(); });
  const fonte = fontes[0];
  let planilhaFonte = null;
  let convertido = null;
  try {
    if (fonte.getMimeType() === MimeType.GOOGLE_SHEETS) {
      planilhaFonte = SpreadsheetApp.openById(fonte.getId());
    } else {
      const pastaDados = encontrarSubpasta(pastaCustos, "Dados do aplicativo");
      convertido = converterExcelParaPlanilha(fonte, pastaDados);
      planilhaFonte = SpreadsheetApp.openById(convertido.getId());
    }
    const resultadoCopia = copiarLancamentosDaPlanilha(planilhaFonte, planilhaDestino, fonte.getId());
    const quantidade = resultadoCopia.importados;
    // Só é erro de verdade quando NENHUMA aba teve um cabeçalho reconhecido
    // (Descrição + Total/Valor unitário) — aí sim o formato do Excel não bate
    // com o esperado. Se o cabeçalho foi reconhecido mas simplesmente não há
    // nenhum lançamento com valor (planilha de custos legítima, só que ainda
    // vazia — por exemplo, uma cópia gerada pelo próprio app que perdeu a
    // marca de "gerada pelo app" e acabou sendo tratada como original),
    // não há nada de errado: é só "zero lançamentos para importar".
    if (!quantidade && !resultadoCopia.cabecalhoEncontrado && lerLancamentosCustos(planilhaDestino).length === 0) {
      throw new Error("Encontrei " + fonte.getName() + ", mas não achei linhas com descrição e valor. Confira os cabeçalhos do Excel.");
    }
    PropertiesService.getScriptProperties().setProperty("custos-fonte-original-" + pastaCustos.getId(), fonte.getId());
    recalcularParticipacoes(planilhaDestino);
    SpreadsheetApp.flush();
    return quantidade;
  } finally {
    if (convertido) DriveApp.getFileById(convertido.getId()).setTrashed(true);
  }
}

function converterExcelParaPlanilha(arquivoExcel, pastaDestino) {
  const boundary = "laForteCosts" + String(new Date().getTime());
  const mimeGoogle = "application/vnd.google-apps.spreadsheet";
  const metadata = { name: "Conversão temporária - " + arquivoExcel.getName(), mimeType: mimeGoogle, parents: pastaDestino ? [pastaDestino.getId()] : [] };
  const inicio = Utilities.newBlob("--" + boundary + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" + JSON.stringify(metadata) + "\r\n--" + boundary + "\r\nContent-Type: " + arquivoExcel.getMimeType() + "\r\n\r\n").getBytes();
  const conteudo = arquivoExcel.getBlob().getBytes();
  const fim = Utilities.newBlob("\r\n--" + boundary + "--").getBytes();
  const retorno = UrlFetchApp.fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", {
    method: "post",
    contentType: "multipart/related; boundary=" + boundary,
    headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() },
    payload: inicio.concat(conteudo, fim),
    muteHttpExceptions: true
  });
  if (retorno.getResponseCode() < 200 || retorno.getResponseCode() >= 300) throw new Error("Não consegui converter " + arquivoExcel.getName() + " (HTTP " + retorno.getResponseCode() + ").");
  return DriveApp.getFileById(JSON.parse(retorno.getContentText()).id);
}
function copiarLancamentosDaPlanilha(origem, destino, idOrigem) {
  let importados = 0;
  // Além da quantidade importada, registra se ALGUMA aba teve um cabeçalho
  // reconhecido (Descrição + Total/Valor unitário), mesmo que nenhuma linha
  // vire lançamento de verdade (ex.: uma planilha de custos legítima, mas
  // ainda totalmente vazia). Isso permite ao chamador (importarPlanilhaExistente)
  // distinguir "achei o formato certo, só que está vazio" (não é erro) de
  // "não reconheci o formato desse arquivo" (erro de verdade).
  let cabecalhoEncontrado = false;
  origem.getSheets().forEach(function(abaOrigem, indiceAba) {
    const dados = abaOrigem.getDataRange().getValues();
    let indiceCabecalho = -1;
    let colunas = null;
    for (let i = 0; i < Math.min(dados.length, 20); i += 1) {
      const tentativa = mapearColunasCustos(dados[i]);
      if (tentativa.descricao >= 0 && (tentativa.total >= 0 || tentativa.valorUnitario >= 0)) {
        indiceCabecalho = i;
        colunas = tentativa;
        break;
      }
    }
    if (!colunas) return;
    cabecalhoEncontrado = true;

    const numeroMedicao = acharNumeroMedicao(abaOrigem.getName(), dados);
    const periodo = acharPeriodoMedicao(dados);
    const nomeAba = numeroMedicao ? "Medição " + String(numeroMedicao).padStart(2, "0") : "Sem medição";
    const candidatos = [];
    let categoriaAtual = "";
    // Categoria cujo cabeçalho (linha com total mas sem detalhe de item) foi
    // visto por último, aguardando para ver se itens de verdade aparecem
    // embaixo dela. Se a próxima categoria (ou o fim da planilha) chegar
    // sem nenhum item ter aparecido, o próprio cabeçalho vira um lançamento
    // (ver "Linha de categoria sem nenhum item embaixo" abaixo) — cobre o
    // caso de uma planilha que só lista o total por categoria, sem
    // detalhamento item a item.
    let categoriaPendente = null;

    function confirmarCategoriaPendente() {
      if (categoriaPendente) {
        candidatos.push(categoriaPendente.candidato);
        categoriaPendente = null;
      }
    }

    for (let i = indiceCabecalho + 1; i < dados.length; i += 1) {
      const linha = dados[i];
      const descricao = textoCelula(linha[colunas.descricao]);
      const descricaoNormalizada = normalizarTexto(descricao);
      const valorTotalPlanilha = colunas.total >= 0 ? numeroCelula(linha[colunas.total]) : 0;

      if (/^(valor total|total geral|total|subtotal)\b/.test(descricaoNormalizada)) {
        confirmarCategoriaPendente();
        continue;
      }
      if (!descricao) continue;

      const quantidadePlanilha = colunas.quantidade >= 0 ? numeroCelula(linha[colunas.quantidade]) : 0;
      const valorUnitarioPlanilha = colunas.valorUnitario >= 0 ? numeroCelula(linha[colunas.valorUnitario]) : 0;
      const quantidade = quantidadePlanilha > 0 ? quantidadePlanilha : 1;
      const valorTotal = valorTotalPlanilha;
      const valorUnitario = valorUnitarioPlanilha > 0 ? valorUnitarioPlanilha : valorTotal / quantidade;
      const categoriaNaLinha = colunas.categoria >= 0 ? textoCelula(linha[colunas.categoria]) : "";
      const categoriaInferida = categoriaDaDescricao(descricao);
      const camposDetalhe = [
        colunas.unidade >= 0 ? linha[colunas.unidade] : "",
        colunas.quantidade >= 0 ? linha[colunas.quantidade] : "",
        colunas.valorUnitario >= 0 ? linha[colunas.valorUnitario] : "",
        colunas.localCompra >= 0 ? linha[colunas.localCompra] : "",
        colunas.nfe >= 0 ? linha[colunas.nfe] : "",
        colunas.data >= 0 ? linha[colunas.data] : ""
      ];
      const possuiDadosDeItem = camposDetalhe.some(function(valor) { return textoCelula(valor) !== ""; });
      const linhaTituloCategoria = Boolean(categoriaInferida) && !possuiDadosDeItem;
      if (linhaTituloCategoria) {
        // Nova categoria chegou: se a anterior ficou pendente (nenhum item
        // real apareceu para ela), confirma seu cabeçalho como lançamento
        // antes de trocar de categoria.
        if (categoriaPendente && categoriaPendente.categoria !== categoriaInferida) confirmarCategoriaPendente();
        categoriaAtual = categoriaInferida;
        categoriaPendente = valorTotalPlanilha > 0
          ? {
              categoria: categoriaInferida,
              candidato: {
                id: "importado-" + idOrigem + "-" + indiceAba + "-" + i,
                descricao: descricao,
                categoria: categoriaInferida,
                unidade: "vb",
                quantidade: 1,
                valor_unitario: valorTotalPlanilha,
                valor: valorTotalPlanilha,
                local_compra: "",
                nfe: "",
                data: periodo.inicio || ""
              }
            }
          : null;
        continue;
      }
      if (valorTotalPlanilha <= 0) continue;
      const categoria = categoriaNaLinha || categoriaAtual || categoriaInferida || "Outros";
      // Um item de verdade apareceu para esta categoria: o total já vem da
      // soma dos itens reais, então descarta o lançamento-fallback do
      // cabeçalho (evita contar o mesmo valor duas vezes).
      if (categoriaPendente && categoriaPendente.categoria === categoria) categoriaPendente = null;
      const dataCelula = colunas.data >= 0 ? normalizarDataPlanilha(linha[colunas.data]) : "";
      // IDs próprios permitem substituir somente as linhas importadas na
      // reimportação; o ID original da planilha não identifica a origem no app.
      const id = "importado-" + idOrigem + "-" + indiceAba + "-" + i;

      const candidato = {
        id: id,
        descricao: descricao,
        categoria: categoria,
        unidade: colunas.unidade >= 0 ? textoCelula(linha[colunas.unidade]) : "",
        quantidade: quantidade,
        valor_unitario: valorUnitario,
        valor: valorTotal,
        local_compra: colunas.localCompra >= 0 ? textoCelula(linha[colunas.localCompra]) : "",
        nfe: colunas.nfe >= 0 ? textoCelula(linha[colunas.nfe]) : "",
        data: dataCelula || periodo.inicio || ""
      };
      candidatos.push(candidato);
    }

    // Fim da planilha: se a última categoria ficou sem nenhum item embaixo,
    // o cabeçalho dela também vira lançamento.
    confirmarCategoriaPendente();

    if (!candidatos.length) return;

    const destinoAba = obterAbaCustos(destino, nomeAba, { numero: numeroMedicao, inicio: periodo.inicio, fim: periodo.fim });
    const idsExistentes = new Set(destinoAba.getLastRow() >= 5
      ? destinoAba.getRange(5, 1, destinoAba.getLastRow() - 4, 1).getDisplayValues().flat()
      : []);
    let linhasImportadas = 0;
    candidatos.forEach(function(item) {
      if (idsExistentes.has(item.id)) return;
      inserirLancamentoNaAba(destinoAba, [
        item.id, item.descricao, item.categoria, item.unidade, item.quantidade,
        item.valor_unitario, item.valor, item.local_compra, item.nfe, item.data, 0
      ]);
      idsExistentes.add(item.id);
      linhasImportadas += 1;
      importados += 1;
    });
    if (linhasImportadas) formatarAbaCustos(destinoAba);
  });
  return { importados: importados, cabecalhoEncontrado: cabecalhoEncontrado };
}

function mapearColunasCustos(cabecalhos) {
  const colunas = { id: -1, descricao: -1, categoria: -1, unidade: -1, quantidade: -1, valorUnitario: -1, total: -1, localCompra: -1, nfe: -1, data: -1 };
  cabecalhos.forEach(function(celula, indice) {
    const nome = normalizarTexto(celula);
    if (colunas.id < 0 && /^(id|id interno)$/.test(nome)) colunas.id = indice;
    if (colunas.descricao < 0 && /(descricao|discriminacao|item)/.test(nome)) colunas.descricao = indice;
    if (colunas.categoria < 0 && /categoria/.test(nome)) colunas.categoria = indice;
    if (colunas.unidade < 0 && /unidade/.test(nome)) colunas.unidade = indice;
    if (colunas.quantidade < 0 && /(quantidade|^qtd$)/.test(nome)) colunas.quantidade = indice;
    if (colunas.valorUnitario < 0 && /(valor unitario|preco unitario)/.test(nome)) colunas.valorUnitario = indice;
    if (colunas.total < 0 && /(valor total|^total$)/.test(nome)) colunas.total = indice;
    if (colunas.localCompra < 0 && /(local compra|fornecedor|loja)/.test(nome)) colunas.localCompra = indice;
    if (colunas.nfe < 0 && /(nfe|nota fiscal|nota)/.test(nome)) colunas.nfe = indice;
    if (colunas.data < 0 && /^data$/.test(nome)) colunas.data = indice;
  });
  return colunas;
}

function acharNumeroMedicao(nomeAba, dados) {
  // Os nomes das abas frequentemente usam "Medição" com acento. Normalize
  // antes de aplicar a expressão para manter o número da aba como vínculo.
  const correspondencia = normalizarTexto(nomeAba).match(/medicao\s+0*(\d+)/i);
  if (correspondencia) return Number(correspondencia[1]);
  for (let i = 0; i < Math.min(dados.length - 1, 10); i += 1) {
    for (let j = 0; j < dados[i].length; j += 1) {
      if (normalizarTexto(dados[i][j]) === "medicao") {
        const valor = numeroCelula(dados[i + 1][j] || dados[i][j + 1]);
        if (valor > 0) return valor;
      }
    }
  }
  return null;
}

function acharPeriodoMedicao(dados) {
  const periodo = { inicio: "", fim: "" };
  for (let i = 0; i < Math.min(dados.length - 1, 12); i += 1) {
    for (let j = 0; j < dados[i].length; j += 1) {
      const rotulo = normalizarTexto(dados[i][j]);
      if (rotulo !== "inicio" && rotulo !== "data inicio" && rotulo !== "fim" && rotulo !== "data fim") continue;
      const valor = dados[i + 1][j] || dados[i][j + 1];
      if (rotulo.indexOf("inicio") >= 0) periodo.inicio = normalizarDataPlanilha(valor);
      else periodo.fim = normalizarDataPlanilha(valor);
    }
  }
  return periodo;
}

function categoriaDaDescricao(descricao) {
  const chave = normalizarTexto(descricao);
  if (chave === "concreto") return "Concreto";
  if (chave === "tercerizados" || chave === "terceirizados") return "Terceirizados";
  const categorias = ["Alvenaria", "Pintura", "Serviços Gerais", "Hidráulica", "Impermeabilização", "Madeira", "Esquadrias", "Serralheria", "Móveis", "Elétrica", "Ferramentas", "Segurança/EPI", "Combustível", "Alimentação", "Mão de obra", "Aluguel", "Impostos", "Terceirizados", "Outros"];
  for (let i = 0; i < categorias.length; i += 1) {
    if (normalizarTexto(categorias[i]) === chave) return categorias[i];
  }
  return "";
}

function normalizarTexto(valor) {
  return String(valor == null ? "" : valor).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function textoCelula(valor) {
  return valor == null ? "" : String(valor).trim();
}

function numeroCelula(valor) {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;
  const texto = String(valor == null ? "" : valor).trim().replace(/R\$|%|\s/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : 0;
}

function normalizarDataPlanilha(valor) {
  if (valor instanceof Date && !isNaN(valor.getTime())) return Utilities.formatDate(valor, Session.getScriptTimeZone(), "yyyy-MM-dd");
  const texto = String(valor == null ? "" : valor).trim();
  let correspondencia = texto.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (correspondencia) return correspondencia[3] + "-" + String(correspondencia[2]).padStart(2, "0") + "-" + String(correspondencia[1]).padStart(2, "0");
  correspondencia = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return correspondencia ? correspondencia[1] + "-" + correspondencia[2] + "-" + correspondencia[3] : "";
}
function processarAcaoCusto(body) {
  const idFotos = String(body.drive_pasta_id || "").trim();
  const numeroContrato = String(body.contrato_numero || "").trim();
  const nomeFrente = String(body.frente_nome || "").trim();
  if (!idFotos || !numeroContrato || !nomeFrente) throw new Error("Informe a pasta Fotos, o contrato e a frente.");
  const lock = obterLockCustos();
  try {
    return processarAcaoCustoComLock(body, idFotos, nomeFrente);
  } finally {
    lock.releaseLock();
  }
}

function processarAcaoCustoComLock(body, idFotos, nomeFrente) {
  const pastaCustos = localizarPastaCustosDaFrente(idFotos);
  const nomeBase = nomeSeguroArquivo("Custos - " + nomeFrente);
  const planilha = localizarOuCriarPlanilhaCustos(pastaCustos, nomeBase);
  if (body.acao === "salvar_custo") {
    const item = body.lancamento || {};
    if (!item.id || !item.descricao || !item.data || !(Number(item.quantidade) > 0) || !(Number(item.valor_unitario) > 0)) throw new Error("Os dados do lançamento estão incompletos ou inválidos.");
    const tituloAba = item.medicao_numero ? "Medição " + String(item.medicao_numero).padStart(2, "0") : "Sem medição";
    const aba = obterAbaCustos(planilha, tituloAba, { numero: item.medicao_numero, inicio: item.medicao_inicio, fim: item.medicao_fim });
    const ids = aba.getLastRow() >= 5 ? aba.getRange(5, 1, aba.getLastRow() - 4, 1).getDisplayValues().flat() : [];
    if (!ids.includes(String(item.id))) {
      inserirLancamentoNaAba(aba, [String(item.id), String(item.descricao), String(item.categoria || "Outros"), String(item.unidade || ""), Number(item.quantidade), Number(item.valor_unitario), Number(item.quantidade) * Number(item.valor_unitario), String(item.local_compra || ""), String(item.nfe || ""), String(item.data), 0]);
      formatarAbaCustos(aba);
    }
  } else if (body.acao === "ajustar_quantidade_custo") {
    // Ajuste rápido (+1/-1) de quantidade de um lançamento já existente, sem
    // recriar a linha (ex.: somar 1 dia de mão de obra). O valor unitário
    // cadastrado é preservado; só quantidade e valor total são recalculados.
    const idAjustar = String(body.lancamento_id || "").trim();
    const delta = Number(body.delta);
    if (!idAjustar || !(delta === 1 || delta === -1)) throw new Error("Informe o lançamento e o ajuste de quantidade (+1 ou -1).");
    let abaEncontrada = null;
    let linhaEncontrada = 0;
    planilha.getSheets().some(function(aba) {
      if (aba.getLastRow() < 5) return false;
      const ids = aba.getRange(5, 1, aba.getLastRow() - 4, 1).getDisplayValues().flat();
      for (let i = 0; i < ids.length; i += 1) {
        if (ids[i] === idAjustar) { abaEncontrada = aba; linhaEncontrada = i + 5; return true; }
      }
      return false;
    });
    if (!abaEncontrada) throw new Error("Lançamento não encontrado para ajustar a quantidade.");
    const quantidadeAtual = Number(abaEncontrada.getRange(linhaEncontrada, 5).getValue()) || 0;
    const valorUnitario = Number(abaEncontrada.getRange(linhaEncontrada, 6).getValue()) || 0;
    const novaQuantidade = quantidadeAtual + delta;
    if (!(novaQuantidade > 0)) throw new Error("A quantidade não pode ficar menor ou igual a zero.");
    abaEncontrada.getRange(linhaEncontrada, 5).setValue(novaQuantidade);
    abaEncontrada.getRange(linhaEncontrada, 7).setValue(novaQuantidade * valorUnitario);
  } else {
    const idRemover = String(body.lancamento_id || "");
    if (!idRemover) throw new Error("Informe o lançamento que deseja remover.");
    planilha.getSheets().forEach(function(aba) {
      if (aba.getLastRow() < 5) return;
      const ids = aba.getRange(5, 1, aba.getLastRow() - 4, 1).getDisplayValues().flat();
      for (let i = ids.length - 1; i >= 0; i -= 1) if (ids[i] === idRemover) aba.deleteRow(i + 5);
    });
  }
  recalcularParticipacoes(planilha);
  SpreadsheetApp.flush();
  try {
    atualizarCopiaExcel(planilha, pastaCustos, nomeBase + ".xlsx", localizarArquivoExcelDaPasta(pastaCustos, nomeBase + ".xlsx"));
  } catch (erroExcel) {
    return resposta({ ok: false, gravado_na_planilha: true, lancamentos: lerLancamentosCustos(planilha), erro: erroExcel.message || "A planilha foi gravada, mas a cópia Excel precisa ser sincronizada." });
  }
  return resposta({ ok: true, lancamentos: lerLancamentosCustos(planilha), planilha_url: planilha.getUrl(), excel_url: localizarArquivoPeloNome(pastaCustos, nomeBase + ".xlsx").getUrl() });
}

// Uma planilha original (não gerada pelo app) diretamente dentro da pasta
// indica que é essa a pasta de custos "de verdade" do usuário — usado para
// desempatar quando existe mais de uma pasta "Custo"/"Custos" na mesma frente
// (ver localizarPastaCustosDaFrente).
function pastaTemArquivoDeCustoOriginal(pasta) {
  const arquivos = pasta.getFiles();
  while (arquivos.hasNext()) {
    const arquivo = arquivos.next();
    const geradoPeloApp = PropertiesService.getScriptProperties().getProperty("custos-xlsx-gerado-" + arquivo.getId()) === "true";
    if (!geradoPeloApp && (/\.xlsx$/i.test(arquivo.getName()) || arquivo.getMimeType() === MimeType.GOOGLE_SHEETS)) return true;
  }
  return false;
}

// Aceita tanto "Custo" quanto "Custos" como nome da pasta — antes só "Custo"
// (singular) era reconhecido, então uma frente cuja pasta real se chamasse
// "Custos" (plural) nunca era encontrada: o app criava uma pasta "Custo"
// nova e vazia ao lado da pasta real, e todo lançamento genuíno do usuário
// ficava invisível para o app (foi exatamente o que aconteceu na frente
// URAT do contrato 1437 — a pasta real era "Custos" e o app tinha criado
// uma "Custo" vazia). Se as duas pastas já existirem (caso de quem já
// passou por esse bug), prefere a que realmente tem uma planilha original
// do usuário; se não der para decidir sozinho, avisa em vez de adivinhar.
function localizarPastaCustosDaFrente(idFotos) {
  const pastaFotos = DriveApp.getFolderById(idFotos);
  const pais = pastaFotos.getParents();
  if (!pais.hasNext()) throw new Error("A pasta Fotos não está dentro de uma pasta de frente.");
  const pastaFrente = pais.next();

  const pastas = pastaFrente.getFolders();
  const candidatas = [];
  while (pastas.hasNext()) {
    const pasta = pastas.next();
    const nome = normalizarTexto(pasta.getName());
    if (nome === "custo" || nome === "custos") candidatas.push(pasta);
  }

  if (!candidatas.length) return pastaFrente.createFolder("Custo");
  if (candidatas.length === 1) return candidatas[0];

  const comArquivoOriginal = candidatas.filter(pastaTemArquivoDeCustoOriginal);
  if (comArquivoOriginal.length === 1) return comArquivoOriginal[0];

  throw new Error(
    "Encontrei mais de uma pasta de custo nesta frente (" + candidatas.map(function(pasta) { return pasta.getName(); }).join(", ") +
    ") e não consegui identificar sozinho qual usar. Deixe só uma pasta de custo nesta frente (apague ou renomeie a outra, movendo o conteúdo se precisar) e tente novamente."
  );
}

function localizarOuCriarPlanilhaCustos(pastaCustos, nomeBase) {
  let pastaBase = encontrarSubpasta(pastaCustos, "Dados do aplicativo");
  if (!pastaBase) pastaBase = pastaCustos.createFolder("Dados do aplicativo");
  const arquivos = pastaBase.getFilesByName(nomeBase);
  while (arquivos.hasNext()) {
    const arquivo = arquivos.next();
    if (arquivo.getMimeType() === MimeType.GOOGLE_SHEETS) return SpreadsheetApp.openById(arquivo.getId());
  }
  const planilha = SpreadsheetApp.create(nomeBase);
  DriveApp.getFileById(planilha.getId()).moveTo(pastaBase);
  const abaInicial = planilha.getSheets()[0];
  abaInicial.setName("Sem medição");
  prepararAbaCustos(abaInicial, null);
  return planilha;
}

// O Google Sheets trata nomes de aba como únicos ignorando maiúsculas/
// minúsculas (e variações de acentuação), mas getSheetByName() faz
// comparação exata (sensível a maiúsculas/minúsculas). Isso permite um
// estado inconsistente: uma aba "medição 05" (criada manualmente, com "m"
// minúsculo, por exemplo) não é encontrada por getSheetByName("Medição
// 05"), então o código tentava criar uma aba nova com esse nome — e o
// próprio Google Sheets recusava, por já existir uma aba equivalente,
// gerando o erro "Já existe uma página chamada X. Insira outro nome."
// mesmo a aba nunca tendo sido "encontrada" pelo código. Esta função evita
// isso comparando os nomes de forma mais flexível (minúsculas, sem
// diferenças de forma de acentuação Unicode) antes de decidir criar uma
// aba nova.
function encontrarAbaPorNomeFlexivel(planilha, nome) {
  const aba = planilha.getSheetByName(nome);
  if (aba) return aba;
  const alvo = normalizarTexto(nome);
  const abas = planilha.getSheets();
  for (let i = 0; i < abas.length; i += 1) {
    if (normalizarTexto(abas[i].getName()) === alvo) return abas[i];
  }
  return null;
}

function obterAbaCustos(planilha, nomeAba, periodo) {
  const nome = String(nomeAba).split("").map(function(caractere) { return ":\\/?*[]".indexOf(caractere) >= 0 ? " " : caractere; }).join("").slice(0, 90);
  let aba = encontrarAbaPorNomeFlexivel(planilha, nome);
  if (!aba) {
    try {
      aba = planilha.insertSheet(nome);
    } catch (erroCriarAba) {
      // Segunda camada de proteção, além do LockService em obterLockCustos():
      // se mesmo assim uma aba com esse nome já existir agora (criada entre a
      // checagem acima e esta linha), reaproveita a aba em vez de falhar.
      const abaExistente = encontrarAbaPorNomeFlexivel(planilha, nome);
      if (!abaExistente) throw erroCriarAba;
      return abaExistente;
    }
    prepararAbaCustos(aba, periodo);
  } else if (periodo) {
    aba.getRange("O1").setValue(periodo.numero ? Number(periodo.numero) : "Sem medição");
    aba.getRange("O2").setValue(periodo.inicio || "");
    aba.getRange("O3").setValue(periodo.fim || "");
  }
  return aba;
}

function prepararAbaCustos(aba, periodo) {
  aba.clear();
  aba.getRange("N1:N3").setValues([["MEDIÇÃO"], ["INÍCIO"], ["FIM"]]);
  aba.getRange("O1:O3").setValues([[periodo && periodo.numero ? Number(periodo.numero) : "Sem medição"], [periodo && periodo.inicio ? String(periodo.inicio) : ""], [periodo && periodo.fim ? String(periodo.fim) : ""]]);
  aba.getRange(4, 1, 1, 11).setValues([["ID INTERNO", "DESCRIÇÃO", "CATEGORIA", "UNIDADE", "QUANTIDADE", "VALOR UNITÁRIO", "VALOR TOTAL", "LOCAL COMPRA", "NF-e", "DATA", "PARTICIPAÇÃO"]]);
  aba.setFrozenRows(4);
  aba.hideColumns(1);
  aba.hideColumns(3);
  formatarAbaCustos(aba);
}

function inserirLancamentoNaAba(aba, valores) {
  const ultimaLinha = aba.getLastRow();
  let ultimaLinhaDados = 4;
  if (ultimaLinha >= 5) {
    const ids = aba.getRange(5, 1, ultimaLinha - 4, 1).getDisplayValues().flat();
    for (let i = 0; i < ids.length; i += 1) if (ids[i]) ultimaLinhaDados = i + 5;
  }
  const linhaDestino = ultimaLinhaDados + 1;
  if (linhaDestino <= ultimaLinha) aba.insertRowBefore(linhaDestino);
  aba.getRange(linhaDestino, 1, 1, 11).setValues([valores]);
}

function formatarAbaCustos(aba) {
  if (!aba.getRange("O1").getValue() && normalizarTexto(aba.getRange("A1").getValue()) === "medicao") {
    const metadadosAntigos = aba.getRange("A1:G1").getValues()[0];
    aba.getRange("N1:O3").setValues([
      ["MEDIÇÃO", metadadosAntigos[1] || String(aba.getName()).replace(/\D/g, "") || "Sem medição"],
      ["INÍCIO", metadadosAntigos[4] || ""],
      ["FIM", metadadosAntigos[6] || ""]
    ]);
    aba.getRange("A1:G1").clearContent();
  }
  aba.hideColumns(1);
  aba.hideColumns(3);
  aba.getRange("N1:O3").setBorder(true, true, true, true, true, true, "#B8C5D8", SpreadsheetApp.BorderStyle.SOLID);
  aba.getRange("N1:N3").setBackground("#08AFE0").setFontColor("#000000").setFontWeight("bold");
  aba.getRange("O1:O3").setBackground("#D9E2F3").setFontColor("#000000").setHorizontalAlignment("center");
  aba.getRange("N1:O3").setVerticalAlignment("middle");
  aba.getRange("O2:O3").setNumberFormat("dd/mm/yyyy");
  aba.getRange("J:J").setNumberFormat("@");
  aba.setColumnWidth(2, 245);
  aba.setColumnWidth(3, 120);
  [0, 105, 115, 130, 140, 180, 130, 115, 120, 135].forEach(function(largura, indice) { if (indice > 0) aba.setColumnWidth(indice + 3, largura); });
  aba.setColumnWidth(14, 110);
  aba.setColumnWidth(15, 115);
  aba.getRange(4, 2, 1, 10).setBackground("#08AFE0").setFontColor("#000000").setFontWeight("bold").setHorizontalAlignment("center").setVerticalAlignment("middle");
  aba.setRowHeight(4, 30);

  const ultimaLinha = aba.getLastRow();
  let ultimaLinhaDados = 4;
  if (ultimaLinha >= 5) {
    const ids = aba.getRange(5, 1, ultimaLinha - 4, 1).getDisplayValues().flat();
    for (let i = 0; i < ids.length; i += 1) if (ids[i]) ultimaLinhaDados = i + 5;
  }
  if (ultimaLinhaDados >= 5) {
    aba.getRange(5, 2, ultimaLinhaDados - 4, 10).setBackground("#D9E2F3").setFontColor("#000000").setVerticalAlignment("middle");
    aba.getRange(5, 2, ultimaLinhaDados - 4, 10).setBorder(true, true, true, true, true, true, "#FFFFFF", SpreadsheetApp.BorderStyle.SOLID);
    aba.getRange(5, 5, ultimaLinhaDados - 4, 3).setNumberFormat("#,##0.00");
    aba.getRange(5, 7, ultimaLinhaDados - 4, 1).setNumberFormat('"R$" #,##0.00');
    aba.getRange(5, 10, ultimaLinhaDados - 4, 1).setNumberFormat("dd/mm/yyyy");
    aba.getRange(5, 11, ultimaLinhaDados - 4, 1).setNumberFormat("0.00%");

    const linhaTotal = ultimaLinhaDados + 1;
    if (linhaTotal <= ultimaLinha && !aba.getRange(linhaTotal, 1).getValue() && normalizarTexto(aba.getRange(linhaTotal, 2).getValue()) === "valor total") {
      aba.getRange(linhaTotal, 2, 1, 10).clearContent();
    } else {
      aba.getRange(linhaTotal, 1, 1, 11).clearContent();
    }
    aba.getRange(linhaTotal, 2).setValue("Valor Total");
    aba.getRange(linhaTotal, 7).setValue(aba.getRange(5, 7, ultimaLinhaDados - 4, 1).getValues().flat().reduce(function(soma, valor) { return soma + (Number(valor) || 0); }, 0));
    aba.getRange(linhaTotal, 11).setValue(1);
    aba.getRange(linhaTotal, 2, 1, 10).setBackground("#FFF200").setFontColor("#000000").setFontWeight("bold").setBorder(true, true, true, true, true, true, "#D4C900", SpreadsheetApp.BorderStyle.SOLID);
    aba.getRange(linhaTotal, 7).setNumberFormat('"R$" #,##0.00');
    aba.getRange(linhaTotal, 11).setNumberFormat("0.00%");
    aba.setRowHeight(linhaTotal, 28);
  } else if (ultimaLinha >= 5) {
    aba.getRange(5, 1, ultimaLinha - 4, 11).clearContent();
  }
}

function recalcularParticipacoes(planilha) {
  planilha.getSheets().forEach(function(aba) {
    if (aba.getLastRow() < 5) { formatarAbaCustos(aba); return; }
    const n = aba.getLastRow() - 4;
    const dados = aba.getRange(5, 1, n, 11).getValues();
    const indices = [];
    const valores = [];
    dados.forEach(function(linha, indice) {
      if (linha[0]) { indices.push(indice + 5); valores.push(Number(linha[6]) || 0); }
    });
    const total = valores.reduce(function(soma, valor) { return soma + valor; }, 0);
    indices.forEach(function(linha, indice) { aba.getRange(linha, 11).setValue(total ? valores[indice] / total : 0); });
    formatarAbaCustos(aba);
  });
}

function lerLancamentosCustos(planilha) {
  const itens = [];
  planilha.getSheets().forEach(function(aba) {
    if (aba.getLastRow() < 5) return;
    aba.getRange(5, 1, aba.getLastRow() - 4, 11).getValues().forEach(function(linha) {
      if (!linha[0]) return;
      itens.push({ id: String(linha[0]), descricao: String(linha[1] || ""), categoria: String(linha[2] || "Outros"), unidade: String(linha[3] || ""), quantidade: Number(linha[4]) || 0, valor_unitario: Number(linha[5]) || 0, valor: Number(linha[6]) || 0, local_compra: String(linha[7] || ""), nfe: String(linha[8] || ""), data: String(linha[9] || ""), medicao_numero: aba.getName() === "Sem medição" ? null : Number(aba.getName().replace(/\D/g, "")) || null });
    });
  });
  return itens.sort(function(a, b) { return String(a.data).localeCompare(String(b.data)) || String(a.id).localeCompare(String(b.id)); });
}

function atualizarCopiaExcel(planilha, pastaCustos, nomeXlsx, arquivoExistente) {
  recalcularParticipacoes(planilha);
  SpreadsheetApp.flush();
  const mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const planilhaExportacao = criarPlanilhaExcelFormatada(planilha);
  try {
    const url = "https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(planilhaExportacao.getId()) + "/export?mimeType=" + encodeURIComponent(mime);
    const exportacao = UrlFetchApp.fetch(url, { method: "get", headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
    if (exportacao.getResponseCode() < 200 || exportacao.getResponseCode() >= 300) throw new Error("A planilha foi gravada, mas não foi possível atualizar o Excel (HTTP " + exportacao.getResponseCode() + ").");
    const blob = exportacao.getBlob().setName(nomeXlsx).setContentType(mime);
    if (!arquivoExistente) {
      const novoArquivo = pastaCustos.createFile(blob);
      PropertiesService.getScriptProperties().setProperty("custos-xlsx-gerado-" + novoArquivo.getId(), "true");
      return novoArquivo;
    }
    const propriedades = PropertiesService.getScriptProperties();
    const chaveGerado = "custos-xlsx-gerado-" + arquivoExistente.getId();
    if (propriedades.getProperty(chaveGerado) !== "true") {
      const pastaDados = encontrarSubpasta(pastaCustos, "Dados do aplicativo") || pastaCustos.createFolder("Dados do aplicativo");
      const nomeBackup = "Original - " + arquivoExistente.getName();
      if (!localizarArquivoPeloNome(pastaDados, nomeBackup)) arquivoExistente.makeCopy(nomeBackup, pastaDados);
    }
    const urlAtualizacao = "https://www.googleapis.com/upload/drive/v3/files/" + encodeURIComponent(arquivoExistente.getId()) + "?uploadType=media";
    const atualizacao = UrlFetchApp.fetch(urlAtualizacao, { method: "patch", contentType: mime, headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() }, payload: blob.getBytes(), muteHttpExceptions: true });
    if (atualizacao.getResponseCode() < 200 || atualizacao.getResponseCode() >= 300) throw new Error("Não foi possível substituir a cópia Excel existente (HTTP " + atualizacao.getResponseCode() + ").");
    propriedades.setProperty(chaveGerado, "true");
    return DriveApp.getFileById(arquivoExistente.getId()).setName(nomeXlsx);
  } finally {
    DriveApp.getFileById(planilhaExportacao.getId()).setTrashed(true);
  }
}

// Monta uma cópia de apresentação para o Excel. A base do app continua em
// linhas individuais; o arquivo exportado mostra subtotais por categoria.
function criarPlanilhaExcelFormatada(planilhaBase) {
  const saida = SpreadsheetApp.create("Exportação temporária de custos");
  let primeiraAbaUsada = false;
  try {
    planilhaBase.getSheets().forEach(function(abaBase) {
      const ultimaLinha = abaBase.getLastRow();
      const lancamentos = [];
      if (ultimaLinha >= 5) {
        abaBase.getRange(5, 1, ultimaLinha - 4, 11).getValues().forEach(function(linha) {
          if (!linha[0]) return;
          lancamentos.push({
            descricao: String(linha[1] || ""),
            categoria: String(linha[2] || "Outros").trim() || "Outros",
            unidade: String(linha[3] || ""),
            quantidade: Number(linha[4]) || 0,
            valorUnitario: Number(linha[5]) || 0,
            valor: Number(linha[6]) || 0,
            localCompra: String(linha[7] || ""),
            nfe: String(linha[8] || ""),
            data: linha[9] || ""
          });
        });
      }
      if (!lancamentos.length) return;

      let abaSaida;
      if (!primeiraAbaUsada) {
        abaSaida = saida.getSheets()[0];
        abaSaida.setName(abaBase.getName());
        primeiraAbaUsada = true;
      } else {
        abaSaida = saida.insertSheet(abaBase.getName());
      }
      preencherAbaExcelFormatada(abaBase, abaSaida, lancamentos);
    });

    if (!primeiraAbaUsada) {
      const aba = saida.getSheets()[0];
      aba.setName("Sem medição");
      preencherAbaExcelFormatada(planilhaBase.getSheets()[0], aba, []);
    }
    SpreadsheetApp.flush();
    return saida;
  } catch (erro) {
    DriveApp.getFileById(saida.getId()).setTrashed(true);
    throw erro;
  }
}

function preencherAbaExcelFormatada(abaBase, abaSaida, lancamentos) {
  const numeroMedicao = abaBase.getRange("O1").getDisplayValue() || (abaBase.getName() === "Sem medição" ? "" : abaBase.getName().replace(/\D/g, ""));
  const inicio = dataParaExcel(abaBase.getRange("O2").getValue());
  const fim = dataParaExcel(abaBase.getRange("O3").getValue());
  abaSaida.clear();

  abaSaida.getRange("K2:M2").setValues([["Medição", "Início", "Final"]]);
  abaSaida.getRange("K3:M3").setValues([[numeroMedicao, inicio, fim]]);
  abaSaida.getRange("A4:I4").setValues([["DESCRIÇÃO", "UNIDADE", "QUANTIDADE", "VALOR UNITÁRIO", "VALOR TOTAL", "LOCAL COMPRA", "NF-e", "DATA", "Porcentagem"]]);

  const porCategoria = new Map();
  lancamentos.forEach(function(item) {
    if (!porCategoria.has(item.categoria)) porCategoria.set(item.categoria, []);
    porCategoria.get(item.categoria).push(item);
  });
  const totalGeral = lancamentos.reduce(function(soma, item) { return soma + item.valor; }, 0);
  let linhaAtual = 5;

  porCategoria.forEach(function(itens, categoria) {
    const subtotal = itens.reduce(function(soma, item) { return soma + item.valor; }, 0);
    abaSaida.getRange(linhaAtual, 1, 1, 9).setValues([[categoria, "", "", "", subtotal, "", "", "", totalGeral ? subtotal / totalGeral : 0]]);
    abaSaida.getRange(linhaAtual, 1, 1, 9).setBackground("#D9E2F3").setFontWeight("bold").setFontColor("#000000").setHorizontalAlignment("center");
    linhaAtual += 1;

    itens.forEach(function(item) {
      abaSaida.getRange(linhaAtual, 1, 1, 9).setValues([[
        item.descricao, item.unidade, item.quantidade || "", item.valorUnitario || "", item.valor,
        item.localCompra, item.nfe, dataParaExcel(item.data), subtotal ? item.valor / subtotal : 0
      ]]);
      linhaAtual += 1;
    });
    linhaAtual += 1;
  });

  const linhaTotal = linhaAtual;
  abaSaida.getRange(linhaTotal, 1, 1, 9).setValues([["Valor Total", "", "", "", totalGeral, "", "", "", 1]]);
  abaSaida.getRange(linhaTotal, 1, 1, 9).setBackground("#FFF200").setFontWeight("bold").setFontColor("#000000").setHorizontalAlignment("center");

  abaSaida.getRange("K2:M2").setBackground("#08AFE0").setFontWeight("bold").setFontColor("#000000").setHorizontalAlignment("center");
  abaSaida.getRange("K3:M3").setHorizontalAlignment("center").setFontColor("#000000");
  abaSaida.getRange("L3:M3").setNumberFormat("dd/mm/yyyy");
  abaSaida.getRange("A4:I4").setBackground("#08AFE0").setFontWeight("bold").setFontColor("#000000").setHorizontalAlignment("center").setVerticalAlignment("middle");
  abaSaida.setFrozenRows(4);
  abaSaida.setRowHeight(4, 28);
  abaSaida.setColumnWidth(1, 340);
  [80, 100, 125, 125, 180, 110, 110, 110].forEach(function(largura, indice) { abaSaida.setColumnWidth(indice + 2, largura); });
  [105, 115, 115].forEach(function(largura, indice) { abaSaida.setColumnWidth(indice + 11, largura); });
  if (linhaTotal > 5) {
    abaSaida.getRange(5, 3, linhaTotal - 4, 1).setNumberFormat("#,##0.00");
    abaSaida.getRange(5, 4, linhaTotal - 4, 2).setNumberFormat('"R$" #,##0.00');
    abaSaida.getRange(5, 8, linhaTotal - 4, 1).setNumberFormat("dd/mm/yyyy");
    abaSaida.getRange(5, 9, linhaTotal - 4, 1).setNumberFormat("0.00%");
    abaSaida.getRange(5, 1, linhaTotal - 4, 9).setVerticalAlignment("middle").setHorizontalAlignment("center");
  }
  abaSaida.getRange(1, 1, linhaTotal, 13).setFontFamily("Arial").setFontSize(10);
  abaSaida.getRange("A4:I4").setFontFamily("Arial").setFontSize(10);
  abaSaida.getRange(5, 1, Math.max(1, linhaTotal - 4), 9).setBorder(true, true, true, true, true, true, "#D9DDE3", SpreadsheetApp.BorderStyle.SOLID);
}

function dataParaExcel(valor) {
  if (!valor) return "";
  if (valor instanceof Date && !isNaN(valor.getTime())) return valor;
  const texto = String(valor).trim();
  let partes = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (partes) return new Date(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3]));
  partes = texto.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
  if (partes) return new Date(Number(partes[3]), Number(partes[2]) - 1, Number(partes[1]));
  const data = new Date(texto);
  return isNaN(data.getTime()) ? texto : data;
}

function localizarArquivoPeloNome(pasta, nome) {
  const arquivos = pasta.getFilesByName(nome);
  return arquivos.hasNext() ? arquivos.next() : null;
}

function nomeSeguroArquivo(nome) {
  return String(nome).replace(/[:*?"<>|]/g, " ").replace(/\s+/g, " ").trim().slice(0, 140);
}
function autorizarAcessoCustos() {
  let arquivoTemporario = null;
  try {
    const teste = SpreadsheetApp.create("Autorização temporária - custos");
    arquivoTemporario = DriveApp.getFileById(teste.getId());
    const url = "https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(teste.getId()) +
      "/export?mimeType=" + encodeURIComponent("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    const retorno = UrlFetchApp.fetch(url, {
      headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true
    });
    if (retorno.getResponseCode() < 200 || retorno.getResponseCode() >= 300) {
      throw new Error("A autorização para exportar Excel não foi concluída (HTTP " + retorno.getResponseCode() + ").");
    }
    return "Acesso à planilha e à exportação Excel autorizado.";
  } finally {
    if (arquivoTemporario) arquivoTemporario.setTrashed(true);
  }
}
function localizarPastaRelatoriosDoContrato(idPastaFotos, numeroContrato) {
  let atual = DriveApp.getFolderById(idPastaFotos);
  const digitosSolicitados = String(numeroContrato).replace(/\D/g, "");
  for (let nivel = 0; nivel < 20; nivel += 1) {
    const nome = atual.getName().trim();
    const match = nome.match(/^Contrato\s+(.+?)\s*[-–—]/i);
    if (match) {
      const digitosPasta = match[1].replace(/\D/g, "");
      const corresponde = digitosSolicitados
        ? digitosPasta && (digitosSolicitados.startsWith(digitosPasta) || digitosPasta.startsWith(digitosSolicitados))
        : match[1].trim().toLocaleLowerCase() === String(numeroContrato).trim().toLocaleLowerCase();
      if (corresponde) {
        const pastas = atual.getFolders();
        while (pastas.hasNext()) {
          const pasta = pastas.next();
          if (pasta.getName().trim().toLocaleLowerCase() === "relatório fotográfico") return pasta;
        }
        return atual.createFolder("Relatório fotográfico");
      }
    }
    const pais = atual.getParents();
    if (!pais.hasNext()) break;
    atual = pais.next();
  }
  throw new Error(`Não encontrei a pasta do contrato ${numeroContrato} acima da pasta Fotos. Confira a estrutura do Drive.`);
}

function arquivoEstaNaPasta(arquivoId, pastaId) {
  try {
    const pais = DriveApp.getFileById(arquivoId).getParents();
    while (pais.hasNext()) {
      if (pais.next().getId() === pastaId) return true;
    }
  } catch (erro) {
    console.warn("Word anterior não encontrado no Drive; um novo será criado.", erro);
  }
  return false;
}

function localizarArquivoRelatorio(pasta, nomeArquivo) {
  const arquivos = pasta.getFilesByName(nomeArquivo);
  return arquivos.hasNext() ? arquivos.next() : null;
}

// RESPOSTA JSON
// =========================================================

function resposta(objeto) {
  return ContentService
    .createTextOutput(
      JSON.stringify(objeto)
    )
    .setMimeType(
      ContentService.MimeType.JSON
    );
}
