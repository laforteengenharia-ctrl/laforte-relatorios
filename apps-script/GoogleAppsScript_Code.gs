function doGet(e) {
  try {
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

    if (acao === "importar_contratos") {
      const pastaContratosId = e && e.parameter ? e.parameter.pasta_contratos_id : null;
      if (!pastaContratosId) {
        return resposta({ ok: false, erro: "Informe o ID da pasta Contratos Ativos." });
      }
      return listarEstruturaContratos(pastaContratosId);
    }
    if (acao === "buscar_relatorio_word") {
      if (!pastaFotosId || !numeroContrato || !numeroMedicao) {
        return resposta({ ok: false, erro: "Informe a pasta Fotos, o contrato e a medição." });
      }
      const pastaRelatorios = localizarPastaRelatoriosDoContrato(pastaFotosId, numeroContrato);
      const nomeArquivo = `Relatório fotográfico - ${numeroContrato} - Medição ${String(numeroMedicao).padStart(2, "0")}.docx`;
      const arquivo = localizarArquivoRelatorio(pastaRelatorios, nomeArquivo);
      return resposta(arquivo
        ? { ok: true, encontrado: true, file_id: arquivo.getId(), file_url: arquivo.getUrl(), file_name: arquivo.getName() }
        : { ok: true, encontrado: false });
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
  try {
    const body = JSON.parse(e && e.postData ? e.postData.contents : "{}");
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
    if (arquivoBase64.length > 48 * 1024 * 1024) {
      return resposta({ ok: false, erro: "O Word excede o limite de envio do Apps Script. Reduza a quantidade de fotos." });
    }

    const nomeArquivo = `Relatório fotográfico - ${numeroContrato} - Medição ${String(numeroMedicao).padStart(2, "0")}.docx`;
    const pastaRelatorios = localizarPastaRelatoriosDoContrato(idFotos, numeroContrato);
    const bytes = Utilities.base64Decode(arquivoBase64);
    const blob = Utilities.newBlob(bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", nomeArquivo);
    let arquivo = null;
    const arquivoExistente = String(body.drive_file_id || "").trim()
      ? DriveApp.getFileById(String(body.drive_file_id).trim())
      : localizarArquivoRelatorio(pastaRelatorios, nomeArquivo);
    const arquivoExistenteId = arquivoExistente ? arquivoExistente.getId() : "";

    if (arquivoExistenteId && arquivoEstaNaPasta(arquivoExistenteId, pastaRelatorios.getId())) {
      const urlAtualizacao = `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(arquivoExistenteId)}?uploadType=media&fields=id,name,webViewLink`;
      const atualizacao = UrlFetchApp.fetch(urlAtualizacao, {
        method: "patch",
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers: { Authorization: `Bearer ${ScriptApp.getOAuthToken()}` },
        payload: blob.getBytes(),
        muteHttpExceptions: true
      });
      if (atualizacao.getResponseCode() < 200 || atualizacao.getResponseCode() >= 300) {
        throw new Error(`O Word já existe, mas não foi possível atualizar o arquivo no Drive (HTTP ${atualizacao.getResponseCode()}).`);
      }
      arquivo = DriveApp.getFileById(arquivoExistenteId).setName(nomeArquivo);
    } else {
      arquivo = pastaRelatorios.createFile(blob);
    }

    return resposta({
      ok: true,
      file_id: arquivo.getId(),
      file_url: arquivo.getUrl(),
      file_name: arquivo.getName(),
      pasta_id: pastaRelatorios.getId(),
      pasta_nome: pastaRelatorios.getName()
    });
  } catch (erro) {
    console.error("Erro ao sincronizar Word do relatório:", erro);
    return resposta({ ok: false, erro: erro.message || "Não foi possível salvar o Word no Google Drive." });
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
