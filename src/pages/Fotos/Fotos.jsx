import {
  useEffect,
  useRef,
  useState,
} from "react";

import "./Fotos.css";
import { obterTokenDrive } from "../../services/driveAuth";
import { fetchComRetentativa } from "../../utils/fetchComRetentativa";
import { GOOGLE_DRIVE_SCRIPT_URL } from "../../config/googleDriveScript";

async function buscarImagemDrive(arquivoId, drivePastaId, numeroMedicao, tamanho) {
  const token = await obterTokenDrive();
  const parametros = new URLSearchParams({
    acao: "imagem",
    arquivo_id: String(arquivoId || ""),
    drive_pasta_id: String(drivePastaId || ""),
    medicao: String(numeroMedicao || ""),
    tamanho,
    token,
  });
  const resposta = await fetchComRetentativa(
    `${GOOGLE_DRIVE_SCRIPT_URL}?${parametros.toString()}`
  );

  if (!resposta.ok) {
    throw new Error(`HTTP ${resposta.status}`);
  }

  const dados = await resposta.json();
  if (!dados.ok || !dados.base64) {
    if (dados.erro_auth) {
      throw new Error("Sua sessão expirou. Faça login novamente para continuar.");
    }
    throw new Error(dados.erro || "Imagem não disponível.");
  }

  return `data:${dados.tipo || "image/jpeg"};base64,${dados.base64}`;
}

// ============================================================
// COMPONENTE DE FOTO
// ============================================================

function FotoDrive({
  arquivo,
  onAbrir,
  drivePastaId,
  numeroMedicao,
}) {
  const elementoRef = useRef(null);

  const [imagem, setImagem] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    const elemento = elementoRef.current;

    if (!elemento) {
      return;
    }

    let cancelado = false;

    const observer = new IntersectionObserver(
      (entradas) => {
        const entrada = entradas[0];

        if (
          entrada.isIntersecting &&
          !imagem &&
          !carregando
        ) {
          carregarImagem();
          observer.disconnect();
        }
      },
      {
        rootMargin: "300px",
      }
    );

    observer.observe(elemento);

    return () => {
      cancelado = true;
      observer.disconnect();
    };

    async function carregarImagem() {
      try {
        if (cancelado) {
          return;
        }

        setCarregando(true);
        setErro(false);

        const urlImagem = await buscarImagemDrive(
          arquivo.id,
          drivePastaId,
          numeroMedicao,
          "miniatura"
        );

        if (cancelado) {
          return;
        }

        setImagem(urlImagem);
      } catch (error) {
        console.error(
          "Erro ao carregar imagem:",
          arquivo.nome,
          error
        );

        if (!cancelado) {
          setErro(true);
        }
      } finally {
        if (!cancelado) {
          setCarregando(false);
        }
      }
    }
  }, [arquivo.id, drivePastaId, numeroMedicao]);

  async function abrirImagemAmpliada() {
    if (!imagem) return;

    onAbrir({
      ...arquivo,
      url: imagem,
      _carregandoOriginal: true,
    });

    try {
      const original = await buscarImagemDrive(
        arquivo.id,
        drivePastaId,
        numeroMedicao,
        "original"
      );
      onAbrir((atual) =>
        atual?.id === arquivo.id
          ? { ...atual, url: original, _carregandoOriginal: false }
          : atual
      );
    } catch (error) {
      console.warn("Não foi possível carregar a foto original; mantendo a miniatura.", error);
      onAbrir((atual) =>
        atual?.id === arquivo.id
          ? { ...atual, _carregandoOriginal: false }
          : atual
      );
    }
  }

  return (
    <button
      ref={elementoRef}
      type="button"
      onClick={abrirImagemAmpliada}
      title={arquivo.nome}
      style={{
        padding: 0,
        border: "1px solid #dbe3ef",
        borderRadius: "10px",
        overflow: "hidden",
        background: "#f8fafc",
        cursor: imagem
          ? "pointer"
          : "default",
        aspectRatio: "1 / 1",
        position: "relative",
      }}
    >
      {imagem && (
        <img
          src={imagem}
          alt={arquivo.nome}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      )}

      {!imagem &&
        carregando && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#64748b",
              fontSize: "14px",
            }}
          >
            ⏳
          </div>
        )}

      {!imagem &&
        !carregando &&
        !erro && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#94a3b8",
              fontSize: "28px",
            }}
          >
            📷
          </div>
        )}

      {erro && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "5px",
            color: "#64748b",
            fontSize: "13px",
            padding: "10px",
            textAlign: "center",
          }}
        >
          <span
            style={{
              fontSize: "25px",
            }}
          >
            ⚠️
          </span>

          <span>
            Não foi possível
            carregar
          </span>
        </div>
      )}
    </button>
  );
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

export default function Fotos({
  contratoSelecionado,
  frenteSelecionada,
  voltarObra,
}) {
  const [medicoes, setMedicoes] =
    useState([]);

  const [
    carregandoMedicoes,
    setCarregandoMedicoes,
  ] = useState(false);

  const [
    erroMedicoes,
    setErroMedicoes,
  ] = useState("");

  const [
    medicaoSelecionada,
    setMedicaoSelecionada,
  ] = useState(null);

  const [
    dadosFotos,
    setDadosFotos,
  ] = useState(null);

  const [
    carregandoFotos,
    setCarregandoFotos,
  ] = useState(false);

  const [
    erroFotos,
    setErroFotos,
  ] = useState("");

  const [
    fotoAmpliada,
    setFotoAmpliada,
  ] = useState(null);

  // ==========================================================
  // CARREGAR MEDIÇÕES
  // ==========================================================

  useEffect(() => {
    carregarMedicoes();
  }, [frenteSelecionada?.id]);

  async function carregarMedicoes() {
    if (!frenteSelecionada) {
      return;
    }

    const pastaFotosId =
      frenteSelecionada.drive_pasta_id;

    if (!pastaFotosId) {
      setMedicoes([]);

      setErroMedicoes(
        "Esta obra ainda não possui uma pasta de Fotos configurada no Google Drive."
      );

      return;
    }

    try {
      setCarregandoMedicoes(true);
      setErroMedicoes("");

      const token = await obterTokenDrive();
      const url =
        `${GOOGLE_DRIVE_SCRIPT_URL}` +
        `?drive_pasta_id=${encodeURIComponent(
          pastaFotosId
        )}` +
        `&acao=listar_medicoes` +
        `&token=${encodeURIComponent(token)}`;

      const resposta =
        await fetchComRetentativa(url);

      if (!resposta.ok) {
        throw new Error(
          `Erro ao consultar o Google Drive. HTTP ${resposta.status}.`
        );
      }

      const dados =
        await resposta.json();

      if (!dados.ok) {
        throw new Error(
          dados.erro_auth
            ? "Sua sessão expirou. Faça login novamente para continuar."
            : dados.erro ||
              "Não foi possível carregar as medições."
        );
      }

      setMedicoes(
        Array.isArray(
          dados.medicoes
        )
          ? dados.medicoes
          : []
      );
    } catch (error) {
      console.error(
        "Erro ao carregar medições:",
        error
      );

      setMedicoes([]);

      setErroMedicoes(
        error.message ||
          "Não foi possível carregar as medições."
      );
    } finally {
      setCarregandoMedicoes(false);
    }
  }

  // ==========================================================
  // ABRIR FOTOS DA MEDIÇÃO
  // ==========================================================

  async function abrirFotos(
    medicao
  ) {
    if (
      !frenteSelecionada
        ?.drive_pasta_id
    ) {
      return;
    }

    try {
      setMedicaoSelecionada(
        medicao
      );

      setDadosFotos(null);
      setErroFotos("");
      setFotoAmpliada(null);

      setCarregandoFotos(true);

      const token = await obterTokenDrive();
      const url =
        `${GOOGLE_DRIVE_SCRIPT_URL}` +
        `?drive_pasta_id=${encodeURIComponent(
          frenteSelecionada.drive_pasta_id
        )}` +
        `&medicao=${encodeURIComponent(
          medicao.numero
        )}` +
        `&token=${encodeURIComponent(token)}`;

      const resposta =
        await fetchComRetentativa(url);

      if (!resposta.ok) {
        throw new Error(
          `Erro ao consultar as fotos. HTTP ${resposta.status}.`
        );
      }

      const dados =
        await resposta.json();

      if (!dados.ok) {
        throw new Error(
          dados.erro_auth
            ? "Sua sessão expirou. Faça login novamente para continuar."
            : dados.erro ||
              "Não foi possível carregar as fotos."
        );
      }

      setDadosFotos(dados);
    } catch (error) {
      console.error(
        "Erro ao carregar fotos:",
        error
      );

      setErroFotos(
        error.message ||
          "Não foi possível carregar as fotos."
      );
    } finally {
      setCarregandoFotos(false);
    }
  }

  // ==========================================================
  // VOLTAR PARA MEDIÇÕES
  // ==========================================================

  function voltarParaMedicoes() {
    setMedicaoSelecionada(null);
    setDadosFotos(null);
    setErroFotos("");
    setFotoAmpliada(null);
  }

  // ==========================================================
  // VOLTAR
  // ==========================================================

  function voltar() {
    if (medicaoSelecionada) {
      voltarParaMedicoes();
      return;
    }

    voltarObra();
  }

  // ==========================================================
  // URL DO DRIVE PARA VÍDEOS
  // ==========================================================

  function obterUrlArquivoDrive(
    arquivo
  ) {
    return `https://drive.google.com/file/d/${arquivo.id}/view`;
  }

  // ==========================================================
  // TAMANHO
  // ==========================================================

  function formatarTamanho(
    bytes
  ) {
    if (!bytes) {
      return "0 KB";
    }

    const mb =
      bytes /
      (1024 * 1024);

    if (mb >= 1) {
      return `${mb.toFixed(
        1
      )} MB`;
    }

    const kb =
      bytes / 1024;

    return `${Math.max(
      1,
      Math.round(kb)
    )} KB`;
  }

  // ==========================================================
  // VALIDAÇÃO
  // ==========================================================

  if (
    !contratoSelecionado ||
    !frenteSelecionada
  ) {
    return (
      <div
        style={{
          padding: "30px",
          minHeight: "100%",
          background: "#f5f7fb",
        }}
      >
        <h1>
          Obra não encontrada
        </h1>

        <button
          type="button"
          onClick={voltarObra}
          style={{
            padding:
              "10px 18px",
            cursor:
              "pointer",
          }}
        >
          ← Voltar para obra
        </button>
      </div>
    );
  }

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="fotos-page">

      {/* CABEÇALHO */}
      <header className="fotos-cabecalho">
        <button
          type="button"
          className="fotos-voltar"
          onClick={voltar}
        >
          ← {medicaoSelecionada ? "Voltar para medições" : "Voltar para obra"}
        </button>

        <div className="fotos-identificacao">
          <h1><span aria-hidden="true">📷</span> Fotos</h1>
          <p className="fotos-frente">{frenteSelecionada.nome}</p>
          <p className="fotos-contrato">
            Contrato {contratoSelecionado.numero}
            {" — "}
            {contratoSelecionado.nome}
          </p>
        </div>
      </header>
      {/* ======================================================
          LISTA DE MEDIÇÕES
      ====================================================== */}

      {!medicaoSelecionada && (
        <section className="fotos-medicoes-painel">
          <header className="fotos-medicoes-topo">
            <h2><span aria-hidden="true">📁</span> Medições</h2>
            <span className="fotos-medicoes-contagem">
              {medicoes.length} {medicoes.length === 1 ? "medição" : "medições"}
            </span>
          </header>

          {carregandoMedicoes && (
            <div className="fotos-estado">
              ⏳ Carregando medições do Google Drive...
            </div>
          )}

          {!carregandoMedicoes && erroMedicoes && (
            <div className="fotos-erro">{erroMedicoes}</div>
          )}

          {!carregandoMedicoes && !erroMedicoes && medicoes.length === 0 && (
            <div className="fotos-vazio">
              Nenhuma medição foi encontrada na pasta Fotos desta obra.
            </div>
          )}

          {!carregandoMedicoes && !erroMedicoes && medicoes.length > 0 && (
            <div className="fotos-medicoes-lista">
              {medicoes.map((medicao) => (
                <article className="fotos-medicao" key={medicao.id}>
                  <div className="fotos-medicao-dados">
                    <h3>
                      <span aria-hidden="true">📁</span>
                      Medição {String(medicao.numero).padStart(2, "0")}
                    </h3>
                    <p>{medicao.nome}</p>
                  </div>
                  <button
                    type="button"
                    className="fotos-ver-botao"
                    onClick={() => abrirFotos(medicao)}
                  >
                    <span aria-hidden="true">📷</span>
                    Ver fotos
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
      {/* ======================================================
          GALERIA
      ====================================================== */}

      {medicaoSelecionada && (
        <div
          style={{
            maxWidth:
              "1200px",
            margin:
              "0 auto",
          }}
        >
          <div
            style={{
              background:
                "#fff",
              border:
                "1px solid #dbe3ef",
              borderRadius:
                "16px",
              padding:
                "30px",
              boxShadow:
                "0 2px 8px rgba(0,0,0,0.04)",
            }}
          >

            {/* CABEÇALHO DA MEDIÇÃO */}

            <div
              style={{
                display:
                  "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "center",
                gap:
                  "20px",
                flexWrap:
                  "wrap",
                marginBottom:
                  "30px",
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize:
                      "30px",
                  }}
                >
                  📁{" "}
                  {
                    medicaoSelecionada.nome
                  }
                </h2>

                <div
                  style={{
                    marginTop:
                      "8px",
                    color:
                      "#64748b",
                    fontSize:
                      "17px",
                  }}
                >
                  Fotos recebidas
                  nesta medição
                </div>
              </div>

              {dadosFotos &&
                dadosFotos.quantidade && (
                  <div
                    style={{
                      display:
                        "flex",
                      gap:
                        "10px",
                      flexWrap:
                        "wrap",
                    }}
                  >
                    <span
                      style={{
                        background:
                          "#eef5ff",
                        color:
                          "#1756d1",
                        padding:
                          "10px 15px",
                        borderRadius:
                          "20px",
                        fontWeight:
                          "600",
                      }}
                    >
                      📷{" "}
                      {
                        dadosFotos
                          .quantidade
                          .fotos
                      }{" "}
                      fotos
                    </span>

                    <span
                      style={{
                        background:
                          "#f5f3ff",
                        color:
                          "#6d28d9",
                        padding:
                          "10px 15px",
                        borderRadius:
                          "20px",
                        fontWeight:
                          "600",
                      }}
                    >
                      🎥{" "}
                      {
                        dadosFotos
                          .quantidade
                          .videos
                      }{" "}
                      vídeos
                    </span>
                  </div>
                )}
            </div>

            {/* CARREGANDO */}

            {carregandoFotos && (
              <div
                style={{
                  textAlign:
                    "center",
                  padding:
                    "60px 20px",
                  color:
                    "#58729a",
                  fontSize:
                    "19px",
                }}
              >
                ⏳ Consultando
                fotos do Google
                Drive...
              </div>
            )}

            {/* ERRO */}

            {!carregandoFotos &&
              erroFotos && (
                <div
                  style={{
                    padding:
                      "20px",
                    borderRadius:
                      "10px",
                    background:
                      "#fff1f2",
                    border:
                      "1px solid #fecdd3",
                    color:
                      "#be123c",
                  }}
                >
                  {
                    erroFotos
                  }
                </div>
              )}

            {/* PASTA NÃO ENCONTRADA */}

            {!carregandoFotos &&
              !erroFotos &&
              dadosFotos &&
              dadosFotos.encontrada ===
                false && (
                <div
                  style={{
                    textAlign:
                      "center",
                    padding:
                      "60px 20px",
                    color:
                      "#64748b",
                    fontSize:
                      "18px",
                  }}
                >
                  📁 A pasta desta
                  medição não foi
                  encontrada no
                  Google Drive.
                </div>
              )}

            {/* FOTOS */}

            {!carregandoFotos &&
              !erroFotos &&
              dadosFotos &&
              dadosFotos.encontrada &&
              dadosFotos.fotos &&
              dadosFotos.fotos.length >
                0 && (
                <div>
                  <h3
                    style={{
                      margin:
                        "10px 0 20px",
                      fontSize:
                        "24px",
                    }}
                  >
                    📷 Fotos
                  </h3>

                  <div
                    style={{
                      display:
                        "grid",
                      gridTemplateColumns:
                        "repeat(auto-fill, minmax(180px, 1fr))",
                      gap:
                        "14px",
                    }}
                  >
                    {dadosFotos.fotos.map(
                      (foto) => (
                        <FotoDrive
                          key={
                            foto.id
                          }
                          arquivo={
                            foto
                          }
                          onAbrir={
                            setFotoAmpliada
                          }
                          drivePastaId={
                            frenteSelecionada.drive_pasta_id
                          }
                          numeroMedicao={
                            medicaoSelecionada.numero
                          }
                        />
                      )
                    )}
                  </div>
                </div>
              )}

            {/* VÍDEOS */}

            {!carregandoFotos &&
              !erroFotos &&
              dadosFotos &&
              dadosFotos.encontrada &&
              dadosFotos.videos &&
              dadosFotos.videos.length >
                0 && (
                <div
                  style={{
                    marginTop:
                      "40px",
                  }}
                >
                  <h3
                    style={{
                      marginBottom:
                        "18px",
                      fontSize:
                        "24px",
                    }}
                  >
                    🎥 Vídeos
                  </h3>

                  <div
                    style={{
                      display:
                        "flex",
                      flexDirection:
                        "column",
                      gap:
                        "10px",
                    }}
                  >
                    {dadosFotos.videos.map(
                      (video) => (
                        <a
                          key={
                            video.id
                          }
                          href={obterUrlArquivoDrive(
                            video
                          )}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display:
                              "flex",
                            justifyContent:
                              "space-between",
                            alignItems:
                              "center",
                            gap:
                              "15px",
                            padding:
                              "14px 18px",
                            border:
                              "1px solid #dbe3ef",
                            borderRadius:
                              "9px",
                            background:
                              "#f8fafc",
                            color:
                              "#1d4ed8",
                            textDecoration:
                              "none",
                          }}
                        >
                          <span
                            style={{
                              fontWeight:
                                "600",
                            }}
                          >
                            🎥{" "}
                            {
                              video.nome
                            }
                          </span>

                          <span
                            style={{
                              color:
                                "#64748b",
                              fontSize:
                                "14px",
                              whiteSpace:
                                "nowrap",
                            }}
                          >
                            {
                              formatarTamanho(
                                video.tamanho
                              )
                            }{" "}
                            ↗
                          </span>
                        </a>
                      )
                    )}
                  </div>
                </div>
              )}

          </div>
        </div>
      )}

      {/* ======================================================
          FOTO AMPLIADA
      ====================================================== */}

      {fotoAmpliada && (
        <div
          onClick={() =>
            setFotoAmpliada(null)
          }
          style={{
            position:
              "fixed",
            inset: 0,
            zIndex:
              9999,
            background:
              "rgba(0,0,0,0.88)",
            display:
              "flex",
            alignItems:
              "center",
            justifyContent:
              "center",
            padding:
              "30px",
            cursor:
              "zoom-out",
          }}
        >
          <button
            type="button"
            onClick={() =>
              setFotoAmpliada(null)
            }
            style={{
              position:
                "fixed",
              top:
                "20px",
              right:
                "25px",
              width:
                "45px",
              height:
                "45px",
              borderRadius:
                "50%",
              border:
                "none",
              background:
                "#fff",
              color:
                "#111",
              fontSize:
                "25px",
              cursor:
                "pointer",
              zIndex:
                10000,
            }}
          >
            ×
          </button>

          <img
            src={
              fotoAmpliada.url
            }
            alt={
              fotoAmpliada.nome
            }
            onClick={(
              evento
            ) =>
              evento.stopPropagation()
            }
            style={{
              maxWidth:
                "95vw",
              maxHeight:
                "90vh",
              objectFit:
                "contain",
              borderRadius:
                "6px",
              boxShadow:
                "0 10px 40px rgba(0,0,0,0.5)",
              cursor:
                "default",
            }}
          />
          {fotoAmpliada._carregandoOriginal && (
            <div
              style={{
                position: "fixed",
                bottom: "24px",
                left: 0,
                right: 0,
                color: "#fff",
                textAlign: "center",
                fontSize: "14px",
                pointerEvents: "none",
              }}
            >
              Carregando foto em alta resolução…
            </div>
          )}
        </div>
      )}
    </div>
  );
}
