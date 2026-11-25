import { useEffect, useMemo, useRef, useState } from "react";
import "./Frentes.css";
import { supabase } from "../../services/supabase";
import {
  criarPastaFrenteNoDrive,
  moverPastaFrenteNoDrive,
  sincronizarEstruturaDrive,
} from "../../services/estruturaDrive";

export default function Frentes({
  contratoSelecionado: contratoSelecionadoProp,
  somenteFinalizadas = false,
  voltarContrato,
  abrirFrente,
}) {
  const [contratos, setContratos] = useState([]);
  const [contratoSelecionadoInterno, setContratoSelecionadoInterno] =
    useState("");

  const contratoSelecionado =
    contratoSelecionadoProp != null
      ? String(contratoSelecionadoProp.id ?? contratoSelecionadoProp)
      : contratoSelecionadoInterno;

  const [frentes, setFrentes] = useState([]);

  const [filtroStatus, setFiltroStatus] = useState("ativo");
  const [filtroSituacao, setFiltroSituacao] = useState("todas");

  const [nome, setNome] = useState("");
  const [drivePastaId, setDrivePastaId] = useState("");
  const [editandoId, setEditandoId] = useState(null);

  const [transferindoId, setTransferindoId] = useState(null);
  const [novoContratoId, setNovoContratoId] = useState("");

  const [carregandoContratos, setCarregandoContratos] = useState(true);
  const [carregandoFrentes, setCarregandoFrentes] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [transferindo, setTransferindo] = useState(false);
  const [alterandoStatus, setAlterandoStatus] = useState(false);
  const [alterandoSituacao, setAlterandoSituacao] = useState(false);

  // Aviso discreto (não bloqueia a tela) sobre a última sincronização
  // automática com o Drive, feita toda vez que a tela abre.
  const [avisoSincronizacaoDrive, setAvisoSincronizacaoDrive] = useState("");

  // ============================================================
  // CONTRATOS
  // ============================================================

  async function carregarContratos() {
    setCarregandoContratos(true);

    const { data, error } = await supabase
      .from("contratos")
      .select("id, numero, nome, drive_pasta_id")
      .order("id", { ascending: false });

    if (error) {
      console.error("Erro ao carregar contratos:", error);

      alert(
        `Não foi possível carregar os contratos.\n\n${error.message}`
      );

      setCarregandoContratos(false);
      return;
    }

    const lista = data || [];

    setContratos(lista);

    if (
      contratoSelecionadoProp == null &&
      lista.length > 0 &&
      !contratoSelecionadoInterno
    ) {
      setContratoSelecionadoInterno(String(lista[0].id));
    }

    setCarregandoContratos(false);
  }

  // ============================================================
  // FRENTES
  // ============================================================

  async function carregarFrentes(contratoId) {
    if (!contratoId) {
      setFrentes([]);
      return;
    }

    setCarregandoFrentes(true);

    const { data, error } = await supabase
      .from("frentes")
      .select("*")
      .eq("contrato_id", Number(contratoId))
      .order("ordem", { ascending: true });

    if (error) {
      console.error("Erro ao carregar frentes:", error);

      alert(
        `Não foi possível carregar as frentes.\n\n${error.message}`
      );

      setFrentes([]);
      setCarregandoFrentes(false);
      return;
    }

    setFrentes(data || []);
    setCarregandoFrentes(false);
  }

  // ============================================================
  // SINCRONIZAÇÃO AUTOMÁTICA COM O DRIVE
  // ============================================================
  // Toda vez que esta tela abre, confere silenciosamente se alguém criou ou
  // moveu uma pasta de contrato/frente direto no Google Drive, e atualiza o
  // banco de acordo (ver src/services/estruturaDrive.js), antes de carregar
  // a lista de contratos. Erros aqui não bloqueiam a tela.

  // Mantém a referência do contrato atualmente aberto sempre atualizada,
  // para a sincronização em segundo plano (abaixo) saber de qual contrato
  // recarregar as frentes quando terminar — sem isso, o efeito abaixo (que
  // só roda uma vez, ao montar a tela) enxergaria sempre o valor inicial.
  const contratoSelecionadoRef = useRef(contratoSelecionado);
  useEffect(() => {
    contratoSelecionadoRef.current = contratoSelecionado;
  }, [contratoSelecionado]);

  useEffect(() => {
    let ativo = true;

    // Carrega a lista de contratos imediatamente (consulta rápida e direta
    // no banco), sem esperar a sincronização com o Drive. A sincronização
    // varre a estrutura inteira de pastas (Contratos Ativos + Inativos) no
    // Google Drive e pode demorar bem mais — por isso ela roda em segundo
    // plano, sem travar a tela, e só recarrega o que for preciso se tiver
    // mudado algo.
    carregarContratos();

    async function sincronizarEmSegundoPlano() {
      try {
        const { totais, avisos } = await sincronizarEstruturaDrive();
        if (!ativo) return;

        const mudou =
          totais.contratosNovos ||
          totais.frentesNovas ||
          totais.medicoesNovas ||
          totais.statusAtualizados ||
          totais.situacoesAtualizadas;

        if (mudou) {
          setAvisoSincronizacaoDrive(
            `Sincronizado com o Drive: ${totais.contratosNovos} contrato(s) novo(s), ` +
              `${totais.frentesNovas} frente(s) nova(s), ${totais.situacoesAtualizadas} situação(ões) de obra atualizada(s).`
          );
          await carregarContratos();
          if (contratoSelecionadoRef.current) {
            await carregarFrentes(contratoSelecionadoRef.current);
          }
        } else if (avisos.length) {
          setAvisoSincronizacaoDrive(
            `Sincronizado com o Drive (${avisos.length} aviso(s) sobre pastas fora do padrão — veja o console).`
          );
          console.warn("Avisos da sincronização com o Drive:", avisos);
        } else {
          setAvisoSincronizacaoDrive("");
        }
      } catch (erro) {
        console.error("Falha ao sincronizar estrutura com o Drive:", erro);
        if (ativo) {
          setAvisoSincronizacaoDrive(
            "Não foi possível sincronizar com o Google Drive agora (" + (erro.message || "erro desconhecido") + ")."
          );
        }
      }
    }

    sincronizarEmSegundoPlano();

    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    carregarFrentes(contratoSelecionado);

    setEditandoId(null);
    setNome("");
    setDrivePastaId("");
    setTransferindoId(null);
    setNovoContratoId("");
  }, [contratoSelecionado]);

  // ============================================================
  // LISTAS
  // ============================================================

  const frentesAtivas = useMemo(
    () =>
      frentes.filter(
        (frente) => (frente.status || "ativo") === "ativo"
      ),
    [frentes]
  );

  const frentesArquivadas = useMemo(
    () =>
      frentes.filter(
        (frente) => frente.status === "arquivado"
      ),
    [frentes]
  );

  const frentesEmAndamento = useMemo(
    () =>
      frentesAtivas.filter(
        (frente) =>
          (frente.situacao || "em_andamento") === "em_andamento"
      ),
    [frentesAtivas]
  );

  const frentesFinalizadas = useMemo(
    () =>
      frentesAtivas.filter(
        (frente) => frente.situacao === "finalizada"
      ),
    [frentesAtivas]
  );

  const frentesVisiveis = useMemo(() => {
    let lista = [];

    if (filtroStatus === "arquivado") {
      lista = frentesArquivadas;
    } else if (filtroStatus === "todos") {
      lista = frentes;
    } else {
      lista = frentesAtivas;
    }

    // Obras finalizadas
    if (somenteFinalizadas) {
      lista = lista.filter(
        (frente) => frente.situacao === "finalizada"
      );
    }

    // Obras em andamento
    else if (contratoSelecionadoProp != null) {
      lista = lista.filter(
        (frente) =>
          (frente.situacao || "em_andamento") === "em_andamento"
      );
    }

    // Tela independente
    else {
      if (filtroSituacao === "em_andamento") {
        lista = lista.filter(
          (frente) =>
            (frente.situacao || "em_andamento") === "em_andamento"
        );
      }

      if (filtroSituacao === "finalizada") {
        lista = lista.filter(
          (frente) => frente.situacao === "finalizada"
        );
      }
    }

    return lista;
  }, [
    somenteFinalizadas,
    contratoSelecionadoProp,
    filtroStatus,
    filtroSituacao,
    frentes,
    frentesAtivas,
    frentesArquivadas,
  ]);

  const frentesOrdenaveis = useMemo(
    () =>
      frentesAtivas
        .filter(
          (frente) =>
            (frente.situacao || "em_andamento") === "em_andamento"
        )
        .sort(
          (a, b) =>
            Number(a.ordem || 0) - Number(b.ordem || 0)
        ),
    [frentesAtivas]
  );

  // ============================================================
  // ABRIR OBRA
  // ============================================================

  function abrirObra(frente) {
    if (typeof abrirFrente !== "function") {
      console.error(
        "A função abrirFrente não foi recebida pelo componente Frentes."
      );

      alert(
        "A navegação para a obra ainda não está configurada no App.jsx."
      );

      return;
    }

    abrirFrente(frente);
  }

  // ============================================================
  // CADASTRO / EDIÇÃO
  // ============================================================

  async function adicionarOuSalvarFrente(evento) {
    evento.preventDefault();

    if (!contratoSelecionado) {
      alert("Selecione um contrato.");
      return;
    }

    if (!nome.trim()) {
      alert("Informe o nome da frente/obra.");
      return;
    }

    // Ao EDITAR, o campo de pasta do Drive continua disponível para corrigir
    // manualmente um vínculo errado, se necessário.
    let pastaFotosIdManual = null;

    if (editandoId) {
      const valorPastaDrive = drivePastaId.trim();
      const idEncontrado = valorPastaDrive.match(/\/folders\/([\w-]+)/i);
      pastaFotosIdManual = idEncontrado?.[1] || valorPastaDrive;

      if (!pastaFotosIdManual) {
        alert("Informe o link ou o ID da pasta Fotos desta frente no Google Drive.");
        return;
      }

      if (/^https?:\/\//i.test(valorPastaDrive) && !idEncontrado) {
        alert("O link informado não parece ser de uma pasta do Google Drive. Copie o link da pasta Fotos.");
        return;
      }
    }

    setSalvando(true);

    try {
      if (editandoId) {
        const { error } = await supabase
          .from("frentes")
          .update({
            nome: nome.trim(),
            drive_pasta_id: pastaFotosIdManual,
          })
          .eq("id", editandoId);

        if (error) {
          console.error("Erro ao editar frente:", error);

          alert(
            `Não foi possível atualizar a frente.\n\n${error.message}`
          );

          return;
        }
      } else {
        const novaOrdem =
          frentesOrdenaveis.length > 0
            ? Math.max(
                ...frentesOrdenaveis.map((item) =>
                  Number(item.ordem || 0)
                )
              ) + 1
            : 1;

        const { data: novaFrente, error } = await supabase
          .from("frentes")
          .insert([
            {
              contrato_id: Number(contratoSelecionado),
              nome: nome.trim(),
              drive_pasta_id: null,
              ordem: novaOrdem,
              status: "ativo",
              situacao: "em_andamento",
            },
          ])
          .select("id")
          .single();

        if (error) {
          console.error("Erro ao criar frente:", error);

          alert(
            `Não foi possível criar a frente.\n\n${error.message}`
          );

          return;
        }

        // Cria a pasta da frente no Drive (dentro de OBRAS EM ANDAMENTO do
        // contrato, já com a subpasta Fotos) e salva o ID dela na frente
        // recém-criada. Se o contrato ainda não tiver pasta no Drive (por
        // exemplo, criado antes desta funcionalidade existir), a frente
        // continua cadastrada sem pasta — pode ser vinculada depois editando
        // a frente ou criando a pasta manualmente no padrão esperado.
        const contratoAtual = contratos.find(
          (item) => String(item.id) === String(contratoSelecionado)
        );

        if (contratoAtual?.drive_pasta_id) {
          try {
            const drivePastaId = await criarPastaFrenteNoDrive(
              contratoAtual.drive_pasta_id,
              nome.trim()
            );
            const { error: erroPasta } = await supabase
              .from("frentes")
              .update({ drive_pasta_id: drivePastaId })
              .eq("id", novaFrente.id);
            if (erroPasta) {
              console.error("Falha ao salvar o ID da pasta da frente:", erroPasta);
            }
          } catch (erroDrive) {
            console.error("Falha ao criar a pasta da frente no Drive:", erroDrive);
            alert(
              "A frente foi criada, mas não foi possível criar a pasta dela no Google Drive agora.\n\n" +
                (erroDrive.message || "") +
                "\n\nCrie a pasta manualmente em OBRAS EM ANDAMENTO, com o nome \"" +
                nome.trim() +
                '" e uma subpasta Fotos, e depois edite a frente aqui informando o ID dessa pasta Fotos.'
            );
          }
        } else {
          alert(
            "A frente foi criada, mas o contrato ainda não tem uma pasta vinculada no Google Drive, " +
              "então a pasta da frente não pôde ser criada automaticamente. " +
              "Crie a pasta manualmente e depois edite a frente aqui informando o ID da pasta Fotos."
          );
        }
      }

      setNome("");
      setDrivePastaId("");
      setEditandoId(null);

      await carregarFrentes(contratoSelecionado);
    } finally {
      setSalvando(false);
    }
  }

  function iniciarEdicao(frente) {
    if ((frente.status || "ativo") === "arquivado") {
      alert("Reative a frente antes de editá-la.");
      return;
    }

    setEditandoId(frente.id);
    setNome(frente.nome || "");
    setDrivePastaId(frente.drive_pasta_id || "");
    setTransferindoId(null);
    setNovoContratoId("");
  }

  function cancelarEdicao() {
    setEditandoId(null);
    setNome("");
    setDrivePastaId("");
  }

  // ============================================================
  // FINALIZAR / REABRIR
  // ============================================================

  async function alterarSituacaoFrente(frente) {
    if ((frente.status || "ativo") === "arquivado") {
      alert(
        "Reative a frente antes de alterar a situação da obra."
      );
      return;
    }

    const situacaoAtual =
      frente.situacao || "em_andamento";

    const novaSituacao =
      situacaoAtual === "finalizada"
        ? "em_andamento"
        : "finalizada";

    const finalizando =
      novaSituacao === "finalizada";

    const confirmar = window.confirm(
      finalizando
        ? `Deseja marcar a frente "${frente.nome}" como FINALIZADA?\n\n` +
            "Ela continuará disponível no contrato e no histórico."
        : `Deseja reabrir a frente "${frente.nome}"?\n\n` +
            "A obra voltará para 'Em andamento'."
    );

    if (!confirmar) {
      return;
    }

    setAlterandoSituacao(true);

    try {
      if (finalizando) {
        const { error } = await supabase
          .from("frentes")
          .update({
            situacao: "finalizada",
          })
          .eq("id", frente.id);

        if (error) {
          console.error(
            "Erro ao finalizar frente:",
            error
          );

          alert(
            `Não foi possível finalizar a frente.\n\n${error.message}`
          );

          return;
        }

        if (frente.drive_pasta_id) {
          try {
            await moverPastaFrenteNoDrive(frente.drive_pasta_id, false);
          } catch (erroDrive) {
            console.error("Falha ao mover a pasta da frente no Drive:", erroDrive);
            alert(
              "A frente foi finalizada, mas não foi possível mover a pasta dela no Google Drive agora.\n\n" +
                (erroDrive.message || "") +
                "\n\nMova a pasta manualmente para OBRAS FINALIZADAS ou tente novamente mais tarde (a próxima sincronização também corrige isso)."
            );
          }
        }

        await reorganizarOrdemAtivas(false);
        await carregarFrentes(contratoSelecionado);

        alert(
          `Frente "${frente.nome}" marcada como finalizada.`
        );

        return;
      }

      const {
        data: obrasEmAndamento,
        error: erroOrdem,
      } = await supabase
        .from("frentes")
        .select("id, ordem")
        .eq(
          "contrato_id",
          Number(contratoSelecionado)
        )
        .eq("status", "ativo")
        .eq("situacao", "em_andamento")
        .order("ordem", { ascending: true });

      if (erroOrdem) {
        console.error(
          "Erro ao verificar ordem das obras:",
          erroOrdem
        );

        alert(
          `Não foi possível reabrir a frente.\n\n${erroOrdem.message}`
        );

        return;
      }

      const maiorOrdem =
        obrasEmAndamento &&
        obrasEmAndamento.length > 0
          ? Math.max(
              ...obrasEmAndamento.map((item) =>
                Number(item.ordem || 0)
              )
            )
          : 0;

      const novaOrdem =
        Math.max(1, maiorOrdem + 1);

      const { error } = await supabase
        .from("frentes")
        .update({
          situacao: "em_andamento",
          ordem: novaOrdem,
        })
        .eq("id", frente.id);

      if (error) {
        console.error(
          "Erro ao reabrir frente:",
          error
        );

        alert(
          `Não foi possível reabrir a frente.\n\n${error.message}`
        );

        return;
      }

      if (frente.drive_pasta_id) {
        try {
          await moverPastaFrenteNoDrive(frente.drive_pasta_id, true);
        } catch (erroDrive) {
          console.error("Falha ao mover a pasta da frente no Drive:", erroDrive);
          alert(
            "A frente foi reaberta, mas não foi possível mover a pasta dela no Google Drive agora.\n\n" +
              (erroDrive.message || "") +
              "\n\nMova a pasta manualmente para OBRAS EM ANDAMENTO ou tente novamente mais tarde (a próxima sincronização também corrige isso)."
          );
        }
      }

      await reorganizarOrdemAtivas(false);
      await carregarFrentes(contratoSelecionado);

      alert(
        `Frente "${frente.nome}" reaberta com sucesso.`
      );
    } finally {
      setAlterandoSituacao(false);
    }
  }

  // ============================================================
  // TRANSFERÊNCIA
  // ============================================================

  function iniciarTransferencia(frente) {
    setEditandoId(null);
    setNome("");
    setTransferindoId(frente.id);
    setNovoContratoId("");
  }

  function cancelarTransferencia() {
    setTransferindoId(null);
    setNovoContratoId("");
  }

  async function transferirFrente(frente) {
    if (!novoContratoId) {
      alert("Selecione o novo contrato.");
      return;
    }

    if (
      Number(novoContratoId) ===
      Number(contratoSelecionado)
    ) {
      alert("A frente já pertence a este contrato.");
      return;
    }

    const contratoDestino = contratos.find(
      (contrato) =>
        Number(contrato.id) ===
        Number(novoContratoId)
    );

    if (!contratoDestino) {
      alert("Contrato de destino não encontrado.");
      return;
    }

    const situacaoAtual =
      frente.situacao || "em_andamento";

    const situacaoTexto =
      situacaoAtual === "finalizada"
        ? "finalizada"
        : "em andamento";

    const confirmar = window.confirm(
      `Deseja transferir a frente "${frente.nome}" para:\n\n` +
        `${contratoDestino.numero} - ${contratoDestino.nome}?\n\n` +
        `A frente continuará com a situação "${situacaoTexto}" ` +
        "e com os mesmos dados."
    );

    if (!confirmar) {
      return;
    }

    setTransferindo(true);

    try {
      const {
        data: frenteExistente,
        error: erroBusca,
      } = await supabase
        .from("frentes")
        .select("id, nome")
        .eq(
          "contrato_id",
          Number(novoContratoId)
        )
        .eq("nome", frente.nome.trim())
        .maybeSingle();

      if (erroBusca) {
        console.error(
          "Erro ao verificar frente no destino:",
          erroBusca
        );

        alert(
          `Não foi possível verificar o contrato de destino.\n\n${erroBusca.message}`
        );

        return;
      }

      if (frenteExistente) {
        alert(
          `O contrato de destino já possui uma frente chamada "${frente.nome}".\n\n` +
            "Renomeie uma das frentes antes de fazer a transferência."
        );

        return;
      }

      const {
        data: frentesDestino,
        error: erroDestino,
      } = await supabase
        .from("frentes")
        .select("id, ordem, status, situacao")
        .eq(
          "contrato_id",
          Number(novoContratoId)
        )
        .eq("status", "ativo")
        .order("ordem", { ascending: true });

      if (erroDestino) {
        console.error(
          "Erro ao carregar frentes do destino:",
          erroDestino
        );

        alert(
          `Não foi possível carregar as frentes do contrato de destino.\n\n${erroDestino.message}`
        );

        return;
      }

      const maiorOrdemDestino =
        frentesDestino &&
        frentesDestino.length > 0
          ? Math.max(
              ...frentesDestino.map((item) =>
                Number(item.ordem || 0)
              )
            )
          : 0;

      const novaOrdem =
        Math.max(1, maiorOrdemDestino + 1);

      const {
        data: frentesOrigemAtivas,
      } = await supabase
        .from("frentes")
        .select("id, ordem")
        .eq(
          "contrato_id",
          Number(contratoSelecionado)
        )
        .eq("status", "ativo")
        .eq("situacao", "em_andamento");

      const maiorOrdemOrigem =
        frentesOrigemAtivas &&
        frentesOrigemAtivas.length > 0
          ? Math.max(
              ...frentesOrigemAtivas.map((item) =>
                Number(item.ordem || 0)
              )
            )
          : 0;

      const ordemTemporaria =
        Math.max(1, maiorOrdemOrigem + 1000);

      const { error: erroTemporario } =
        await supabase
          .from("frentes")
          .update({
            ordem: ordemTemporaria,
          })
          .eq("id", frente.id);

      if (erroTemporario) {
        console.error(
          "Erro ao preparar transferência:",
          erroTemporario
        );

        alert(
          `Não foi possível preparar a transferência.\n\n${erroTemporario.message}`
        );

        return;
      }

      const {
        data: frentesAntigas,
        error: erroAntigas,
      } = await supabase
        .from("frentes")
        .select("id, ordem, situacao")
        .eq(
          "contrato_id",
          Number(contratoSelecionado)
        )
        .eq("status", "ativo")
        .eq("situacao", "em_andamento")
        .neq("id", frente.id)
        .order("ordem", { ascending: true });

      if (erroAntigas) {
        console.error(
          "Erro ao reorganizar contrato antigo:",
          erroAntigas
        );

        alert(
          `Não foi possível reorganizar o contrato antigo.\n\n${erroAntigas.message}`
        );

        await carregarFrentes(
          contratoSelecionado
        );

        return;
      }

      for (
        let i = 0;
        i < (frentesAntigas || []).length;
        i++
      ) {
        const { error: erroOrdem } =
          await supabase
            .from("frentes")
            .update({
              ordem: i + 1,
            })
            .eq(
              "id",
              frentesAntigas[i].id
            );

        if (erroOrdem) {
          console.error(
            "Erro ao reorganizar frente:",
            erroOrdem
          );

          alert(
            `Não foi possível reorganizar as frentes.\n\n${erroOrdem.message}`
          );

          await carregarFrentes(
            contratoSelecionado
          );

          return;
        }
      }

      const {
        error: erroTransferencia,
      } = await supabase
        .from("frentes")
        .update({
          contrato_id: Number(novoContratoId),
          ordem: novaOrdem,
          situacao: situacaoAtual,
        })
        .eq("id", frente.id);

      if (erroTransferencia) {
        console.error(
          "Erro ao transferir frente:",
          erroTransferencia
        );

        alert(
          `Não foi possível transferir a frente.\n\n${erroTransferencia.message}`
        );

        await carregarFrentes(
          contratoSelecionado
        );

        return;
      }

      if (frente.drive_pasta_id && contratoDestino.drive_pasta_id) {
        try {
          await moverPastaFrenteNoDrive(
            frente.drive_pasta_id,
            situacaoAtual !== "finalizada",
            contratoDestino.drive_pasta_id
          );
        } catch (erroDrive) {
          console.error("Falha ao mover a pasta da frente no Drive:", erroDrive);
          alert(
            "A frente foi transferida, mas não foi possível mover a pasta dela no Google Drive agora.\n\n" +
              (erroDrive.message || "") +
              "\n\nMova a pasta manualmente para o contrato de destino ou tente novamente mais tarde (a próxima sincronização não move pastas entre contratos automaticamente)."
          );
        }
      }

      setTransferindoId(null);
      setNovoContratoId("");

      await carregarFrentes(
        contratoSelecionado
      );

      alert(
        `Frente "${frente.nome}" transferida com sucesso.`
      );
    } finally {
      setTransferindo(false);
    }
  }

  // ============================================================
  // ARQUIVAR / REATIVAR
  // ============================================================

  async function alterarStatusFrente(frente) {
    const statusAtual =
      frente.status || "ativo";

    const novoStatus =
      statusAtual === "arquivado"
        ? "ativo"
        : "arquivado";

    const confirmar = window.confirm(
      novoStatus === "arquivado"
        ? `Deseja arquivar a frente "${frente.nome}"?\n\n` +
            "Ela continuará registrada no sistema e no histórico, " +
            "mas deixará de aparecer entre as frentes ativas."
        : `Deseja reativar a frente "${frente.nome}"?`
    );

    if (!confirmar) {
      return;
    }

    setAlterandoStatus(true);

    try {
      const { error } = await supabase
        .from("frentes")
        .update({
          status: novoStatus,
        })
        .eq("id", frente.id);

      if (error) {
        console.error(
          "Erro ao alterar status da frente:",
          error
        );

        alert(
          `Não foi possível alterar o status da frente.\n\n${error.message}`
        );

        return;
      }

      // Arquivar sempre manda a pasta para OBRAS FINALIZADAS (junto com as
      // obras finalizadas, já que ambas significam "não está mais em
      // andamento"). Reativar devolve a pasta para onde a situação da frente
      // indica (em andamento ou finalizada).
      if (frente.drive_pasta_id) {
        try {
          const emAndamento =
            novoStatus === "arquivado"
              ? false
              : (frente.situacao || "em_andamento") !== "finalizada";

          await moverPastaFrenteNoDrive(frente.drive_pasta_id, emAndamento);
        } catch (erroDrive) {
          console.error("Falha ao mover a pasta da frente no Drive:", erroDrive);
          alert(
            `A frente foi ${novoStatus === "arquivado" ? "arquivada" : "reativada"}, mas não foi possível mover a pasta dela no Google Drive agora.\n\n` +
              (erroDrive.message || "") +
              "\n\nMova a pasta manualmente ou tente novamente mais tarde (a próxima sincronização também corrige isso quando a frente está ativa)."
          );
        }
      }

      if (
        novoStatus === "arquivado" &&
        editandoId === frente.id
      ) {
        cancelarEdicao();
      }

      if (
        transferindoId === frente.id
      ) {
        cancelarTransferencia();
      }

      await reorganizarOrdemAtivas(false);
      await carregarFrentes(
        contratoSelecionado
      );

      alert(
        novoStatus === "arquivado"
          ? `Frente "${frente.nome}" arquivada com sucesso.`
          : `Frente "${frente.nome}" reativada com sucesso.`
      );
    } finally {
      setAlterandoStatus(false);
    }
  }

  // ============================================================
  // EXCLUSÃO
  // ============================================================

  // Excluir uma frente apaga em cascata, no banco de dados, os vínculos
  // dela com medições e as fotos já selecionadas para relatórios dessa
  // frente. Por isso, antes de excluir, conferimos se existe algo
  // vinculado: se existir, bloqueamos a exclusão e orientamos a usar
  // "Arquivar" em vez de apagar o histórico. Só é possível excluir de
  // fato uma frente sem nenhuma medição e nenhuma foto de relatório
  // vinculada.

  async function excluirFrente(id) {
    const [
      { count: totalMedicoes, error: erroMedicoes },
      { count: totalFotosRelatorio, error: erroFotosRelatorio },
    ] = await Promise.all([
      supabase
        .from("medicao_frentes")
        .select("medicao_id", { count: "exact", head: true })
        .eq("frente_id", id),
      supabase
        .from("relatorio_fotos")
        .select("id", { count: "exact", head: true })
        .eq("frente_id", id),
    ]);

    if (erroMedicoes || erroFotosRelatorio) {
      console.error(
        "Erro ao conferir dados vinculados à frente:",
        erroMedicoes || erroFotosRelatorio
      );

      alert(
        "Não foi possível conferir se esta frente possui medições ou fotos de relatório vinculadas. Tente novamente."
      );

      return;
    }

    if ((totalMedicoes || 0) > 0 || (totalFotosRelatorio || 0) > 0) {
      alert(
        "Esta frente/obra não pode ser excluída porque possui dados vinculados:\n\n" +
          `- ${totalMedicoes || 0} medição(ões) vinculada(s)\n` +
          `- ${totalFotosRelatorio || 0} foto(s) de relatório vinculada(s)\n\n` +
          "Excluir a frente apagaria tudo isso sem possibilidade de desfazer. " +
          "Para preservar o histórico, use \"Arquivar\" em vez de excluir."
      );

      return;
    }

    const confirmar = window.confirm(
      "Esta frente/obra não possui medições nem fotos de relatório vinculadas.\n\n" +
        "Deseja realmente excluí-la? Esta ação não poderá ser desfeita."
    );

    if (!confirmar) {
      return;
    }

    const { error } = await supabase
      .from("frentes")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(
        "Erro ao excluir frente:",
        error
      );

      alert(
        `Não foi possível excluir a frente.\n\n${error.message}`
      );

      return;
    }

    await reorganizarOrdemAtivas();
  }

  // ============================================================
  // REORGANIZAÇÃO
  // ============================================================

  async function reorganizarOrdemAtivas(
    recarregar = true
  ) {
    if (!contratoSelecionado) {
      return;
    }

    const {
      data: lista,
      error,
    } = await supabase
      .from("frentes")
      .select("id, ordem, situacao")
      .eq(
        "contrato_id",
        Number(contratoSelecionado)
      )
      .eq("status", "ativo")
      .eq("situacao", "em_andamento")
      .order("ordem", {
        ascending: true,
      });

    if (error) {
      console.error(
        "Erro ao carregar ordem das frentes:",
        error
      );

      alert(
        `Não foi possível reorganizar as frentes.\n\n${error.message}`
      );

      return;
    }

    for (
      let i = 0;
      i < (lista || []).length;
      i++
    ) {
      const {
        error: erroAtualizacao,
      } = await supabase
        .from("frentes")
        .update({
          ordem: i + 1,
        })
        .eq("id", lista[i].id);

      if (erroAtualizacao) {
        console.error(
          "Erro ao reorganizar ordem:",
          erroAtualizacao
        );

        alert(
          `Não foi possível reorganizar a ordem.\n\n${erroAtualizacao.message}`
        );

        return;
      }
    }

    if (recarregar) {
      await carregarFrentes(
        contratoSelecionado
      );
    }
  }

  // ============================================================
  // MOVER FRENTE
  // ============================================================

  async function moverFrente(
    id,
    direcao
  ) {
    const listaAtivas = [
      ...frentesOrdenaveis,
    ].sort(
      (a, b) =>
        Number(a.ordem || 0) -
        Number(b.ordem || 0)
    );

    const indice =
      listaAtivas.findIndex(
        (frente) => frente.id === id
      );

    if (indice === -1) {
      return;
    }

    const novoIndice =
      indice + direcao;

    if (
      novoIndice < 0 ||
      novoIndice >= listaAtivas.length
    ) {
      return;
    }

    const frenteAtual =
      listaAtivas[indice];

    const frenteDestino =
      listaAtivas[novoIndice];

    const ordemAtual =
      Number(frenteAtual.ordem);

    const ordemDestino =
      Number(frenteDestino.ordem);

    const maiorOrdem =
      listaAtivas.length > 0
        ? Math.max(
            ...listaAtivas.map(
              (frente) =>
                Number(
                  frente.ordem || 0
                )
            )
          )
        : 0;

    const ordemTemporaria =
      Math.max(
        1,
        maiorOrdem + 1000
      );

    const {
      error: erroTemporario,
    } = await supabase
      .from("frentes")
      .update({
        ordem: ordemTemporaria,
      })
      .eq(
        "id",
        frenteAtual.id
      );

    if (erroTemporario) {
      console.error(
        "Erro ao preparar movimentação:",
        erroTemporario
      );

      alert(
        `Não foi possível mover a frente.\n\n${erroTemporario.message}`
      );

      return;
    }

    const {
      error: erroDestino,
    } = await supabase
      .from("frentes")
      .update({
        ordem: ordemAtual,
      })
      .eq(
        "id",
        frenteDestino.id
      );

    if (erroDestino) {
      console.error(
        "Erro ao mover frente de destino:",
        erroDestino
      );

      alert(
        `Não foi possível mover a frente.\n\n${erroDestino.message}`
      );

      await carregarFrentes(
        contratoSelecionado
      );

      return;
    }

    const {
      error: erroAtual,
    } = await supabase
      .from("frentes")
      .update({
        ordem: ordemDestino,
      })
      .eq(
        "id",
        frenteAtual.id
      );

    if (erroAtual) {
      console.error(
        "Erro ao finalizar movimentação:",
        erroAtual
      );

      alert(
        `Não foi possível finalizar a movimentação.\n\n${erroAtual.message}`
      );

      await carregarFrentes(
        contratoSelecionado
      );

      return;
    }

    await carregarFrentes(
      contratoSelecionado
    );
  }

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="frentes-page">

      {/* ======================================================
          TOPO
      ====================================================== */}

      <div className="frentes-topo">
        <div>

          {voltarContrato && (
            <button
              type="button"
              onClick={voltarContrato}
              className="frentes-voltar"
            >
              ← Voltar para o contrato
            </button>
          )}

          <h1>
            {somenteFinalizadas
              ? "Obras finalizadas"
              : "Obras em andamento"}
          </h1>

        </div>
      </div>

      {avisoSincronizacaoDrive && (
        <p style={{ margin: "0 0 14px", color: "#52514e", fontSize: "13px" }}>
          {avisoSincronizacaoDrive}
        </p>
      )}

      {/* ======================================================
          CONTRATO
      ====================================================== */}

      {contratoSelecionadoProp == null && (
        <div className="frentes-cadastro">
          <h2>Contrato</h2>

          {carregandoContratos ? (
            <div className="frentes-vazio">
              <p>
                Carregando contratos...
              </p>
            </div>
          ) : contratos.length === 0 ? (
            <div className="frentes-vazio">
              <p>
                Nenhum contrato cadastrado.
              </p>

              <p>
                Cadastre um contrato antes de
                criar uma frente/obra.
              </p>
            </div>
          ) : (
            <select
              value={
                contratoSelecionado
              }
              onChange={(e) =>
                setContratoSelecionadoInterno(
                  e.target.value
                )
              }
            >
              {contratos.map(
                (contrato) => (
                  <option
                    key={contrato.id}
                    value={contrato.id}
                  >
                    {contrato.numero} -{" "}
                    {contrato.nome}
                  </option>
                )
              )}
            </select>
          )}
        </div>
      )}

      {/* ======================================================
          CADASTRO
      ====================================================== */}

      {contratos.length > 0 && (
        <div className="frentes-cadastro">
          <h2>
            {editandoId
              ? "Editar Frente / Obra"
              : "Nova Frente / Obra"}
          </h2>

          <form
            onSubmit={
              adicionarOuSalvarFrente
            }
          >
            <input
              type="text"
              placeholder="Ex.: ETA - Ingleses"
              value={nome}
              onChange={(e) =>
                setNome(
                  e.target.value
                )
              }
              disabled={salvando}
            />

            {editandoId ? (
              <label
                className="frente-pasta-drive-campo"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  width: "100%",
                }}
              >
                <span>Pasta Fotos desta frente no Google Drive</span>
                <input
                  type="text"
                  placeholder="Cole o link da pasta Fotos ou somente o ID"
                  value={drivePastaId}
                  onChange={(e) => setDrivePastaId(e.target.value)}
                  disabled={salvando}
                  required
                  style={{ width: "100%" }}
                />
                <small style={{ color: "#64748b", fontSize: "0.85rem" }}>
                  Só altere isto se a pasta vinculada estiver errada.
                </small>
              </label>
            ) : (
              <small style={{ color: "#64748b", fontSize: "0.85rem" }}>
                A pasta desta frente será criada automaticamente no Google Drive, dentro de "OBRAS EM ANDAMENTO" do contrato.
              </small>
            )}

            <button
              type="submit"
              className={editandoId ? "frente-botao-salvar" : "frente-botao-adicionar"}
              disabled={salvando}
            >
              {salvando
                ? "Salvando..."
                : editandoId
                  ? "Salvar Alteração"
                  : "+ Adicionar Frente / Obra"}
            </button>

            {editandoId && (
              <button
                type="button"
                onClick={
                  cancelarEdicao
                }
                disabled={salvando}
              >
                Cancelar
              </button>
            )}
          </form>
        </div>
      )}

      {/* ======================================================
          LISTA
      ====================================================== */}

      <div className="lista-frentes">

        <div className="frentes-lista-topo">
          <div>
            <h2>
              {somenteFinalizadas
                ? "Obras finalizadas"
                : "Obras em andamento"}
            </h2>

            <p>
              Em andamento:{" "}
              {frentesEmAndamento.length}
              {" · "}
              Finalizadas:{" "}
              {frentesFinalizadas.length}
              {" · "}
              Arquivadas:{" "}
              {frentesArquivadas.length}
            </p>
          </div>

          <div className="frentes-filtros">

            <div className="frentes-filtro">
              <label htmlFor="filtro-status-frentes">
                Cadastro:
              </label>

              <select
                id="filtro-status-frentes"
                value={filtroStatus}
                onChange={(e) =>
                  setFiltroStatus(
                    e.target.value
                  )
                }
              >
                <option value="ativo">
                  Ativas
                </option>

                <option value="arquivado">
                  Arquivadas
                </option>

                <option value="todos">
                  Todas
                </option>
              </select>
            </div>

            {contratoSelecionadoProp == null && (
              <div className="frentes-filtro">
                <label htmlFor="filtro-situacao-frentes">
                  Situação:
                </label>

                <select
                  id="filtro-situacao-frentes"
                  value={filtroSituacao}
                  onChange={(e) =>
                    setFiltroSituacao(
                      e.target.value
                    )
                  }
                >
                  <option value="todas">
                    Todas
                  </option>

                  <option value="em_andamento">
                    Em andamento
                  </option>

                  <option value="finalizada">
                    Finalizadas
                  </option>
                </select>
              </div>
            )}

          </div>
        </div>

        {carregandoFrentes ? (
          <div className="frentes-vazio">
            <p>
              Carregando frentes...
            </p>
          </div>
        ) : frentesVisiveis.length === 0 ? (
          <div className="frentes-vazio">
            <p>
              {somenteFinalizadas
                ? "Nenhuma obra finalizada para este contrato."
                : contratoSelecionadoProp != null
                  ? "Nenhuma obra em andamento para este contrato."
                  : filtroStatus === "arquivado"
                    ? "Nenhuma frente arquivada para este contrato."
                    : filtroSituacao ===
                        "em_andamento"
                      ? "Nenhuma obra em andamento para este contrato."
                      : filtroSituacao ===
                          "finalizada"
                        ? "Nenhuma obra finalizada para este contrato."
                        : filtroStatus ===
                            "todos"
                          ? "Nenhuma frente/obra cadastrada para este contrato."
                          : "Nenhuma frente ativa para este contrato."}
            </p>
          </div>
        ) : (
          <div className="frentes-grid">

            {frentesVisiveis.map(
              (frente) => {
                const arquivada =
                  frente.status ===
                  "arquivado";

                const finalizada =
                  frente.situacao ===
                  "finalizada";

                const emAndamento =
                  !finalizada;

                const listaOrdenada = [
                  ...frentesOrdenaveis,
                ].sort(
                  (a, b) =>
                    Number(
                      a.ordem || 0
                    ) -
                    Number(
                      b.ordem || 0
                    )
                );

                const indiceAtiva =
                  listaOrdenada.findIndex(
                    (item) =>
                      item.id ===
                      frente.id
                  );

                return (
                  <div
                    className={`frente-card ${
                      arquivada
                        ? "frente-card-arquivada"
                        : ""
                    } ${
                      finalizada
                        ? "frente-card-finalizada"
                        : ""
                    }`}
                    key={frente.id}
                  >

                    <div className="frente-info">

                      <div className="frente-cabecalho">

                        <span>
                          {arquivada
                            ? "Frente / Obra arquivada"
                            : finalizada
                              ? "Obra finalizada"
                              : `Frente / Obra ${frente.ordem}`}
                        </span>

                        {!arquivada && (
                          <span
                            className={
                              finalizada
                                ? "frente-badge-finalizada"
                                : "frente-badge-andamento"
                            }
                          >
                            {finalizada
                              ? "Finalizada"
                              : "Em andamento"}
                          </span>
                        )}

                      </div>

                      <h3>
                        {frente.nome}
                      </h3>

                    </div>

                    <div className="frente-acoes">

                      {/* =================================================
                          ABRIR OBRA
                          ESTE BOTÃO FICA SEMPRE VISÍVEL PARA
                          OBRAS NÃO ARQUIVADAS.
                      ================================================= */}

                      {!arquivada && (
                        <button
                          type="button"
                          className="frente-abrir"
                          onClick={() =>
                            abrirObra(
                              frente
                            )
                          }
                          disabled={
                            salvando ||
                            transferindo ||
                            alterandoStatus ||
                            alterandoSituacao
                          }
                        >
                          Abrir obra
                        </button>
                      )}

                      {/* =================================================
                          MOVIMENTAÇÃO
                      ================================================= */}

                      {!arquivada &&
                        emAndamento && (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                moverFrente(
                                  frente.id,
                                  -1
                                )
                              }
                              disabled={
                                indiceAtiva ===
                                  0 ||
                                salvando ||
                                transferindo ||
                                alterandoStatus ||
                                alterandoSituacao
                              }
                              title="Subir"
                            >
                              ↑
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                moverFrente(
                                  frente.id,
                                  1
                                )
                              }
                              disabled={
                                indiceAtiva ===
                                  listaOrdenada.length -
                                    1 ||
                                salvando ||
                                transferindo ||
                                alterandoStatus ||
                                alterandoSituacao
                              }
                              title="Descer"
                            >
                              ↓
                            </button>
                          </>
                        )}

                      {/* EDITAR */}

                      {!arquivada && (
                        <button
                          type="button"
                          onClick={() =>
                            iniciarEdicao(
                              frente
                            )
                          }
                          disabled={
                            salvando ||
                            transferindo ||
                            alterandoStatus ||
                            alterandoSituacao
                          }
                        >
                          Editar
                        </button>
                      )}

                      {/* FINALIZAR / REABRIR */}

                      {!arquivada && (
                        <button
                          type="button"
                          className={
                            finalizada
                              ? "frente-reabrir"
                              : "frente-finalizar"
                          }
                          onClick={() =>
                            alterarSituacaoFrente(
                              frente
                            )
                          }
                          disabled={
                            salvando ||
                            transferindo ||
                            alterandoStatus ||
                            alterandoSituacao
                          }
                        >
                          {finalizada
                            ? "Reabrir obra"
                            : "Finalizar obra"}
                        </button>
                      )}

                      {/* ARQUIVAR / REATIVAR */}

                      <button
                        type="button"
                        className={
                          arquivada
                            ? "frente-reativar"
                            : "frente-arquivar"
                        }
                        onClick={() =>
                          alterarStatusFrente(
                            frente
                          )
                        }
                        disabled={
                          salvando ||
                          transferindo ||
                          alterandoStatus ||
                          alterandoSituacao
                        }
                      >
                        {arquivada
                          ? "Reativar"
                          : "Arquivar"}
                      </button>

                      {/* EXCLUIR */}

                      <button
                        type="button"
                        className="frente-excluir"
                        onClick={() =>
                          excluirFrente(
                            frente.id
                          )
                        }
                        disabled={
                          salvando ||
                          transferindo ||
                          alterandoStatus ||
                          alterandoSituacao
                        }
                      >
                        Excluir
                      </button>

                      {/* MUDAR CONTRATO */}

                      <button
                        type="button"
                        onClick={() =>
                          iniciarTransferencia(
                            frente
                          )
                        }
                        disabled={
                          salvando ||
                          transferindo ||
                          alterandoStatus ||
                          alterandoSituacao
                        }
                      >
                        Mudar contrato
                      </button>

                    </div>

                    {/* =================================================
                        TRANSFERÊNCIA
                    ================================================= */}

                    {transferindoId ===
                      frente.id && (
                      <div className="frente-transferencia">

                        <div className="frente-transferencia-linha">

                          <select
                            value={
                              novoContratoId
                            }
                            onChange={(e) =>
                              setNovoContratoId(
                                e.target.value
                              )
                            }
                            disabled={
                              transferindo
                            }
                          >
                            <option value="">
                              Selecione o novo
                              contrato...
                            </option>

                            {contratos
                              .filter(
                                (contrato) =>
                                  Number(
                                    contrato.id
                                  ) !==
                                  Number(
                                    contratoSelecionado
                                  )
                              )
                              .map(
                                (
                                  contrato
                                ) => (
                                  <option
                                    key={
                                      contrato.id
                                    }
                                    value={
                                      contrato.id
                                    }
                                  >
                                    {
                                      contrato.numero
                                    }{" "}
                                    -{" "}
                                    {
                                      contrato.nome
                                    }
                                  </option>
                                )
                              )}
                          </select>

                          <button
                            type="button"
                            onClick={() =>
                              transferirFrente(
                                frente
                              )
                            }
                            disabled={
                              transferindo
                            }
                          >
                            {transferindo
                              ? "Transferindo..."
                              : "Transferir"}
                          </button>

                          <button
                            type="button"
                            onClick={
                              cancelarTransferencia
                            }
                            disabled={
                              transferindo
                            }
                          >
                            Cancelar
                          </button>

                        </div>

                      </div>
                    )}

                  </div>
                );
              }
            )}

          </div>
        )}
      </div>
    </div>
  );
}
