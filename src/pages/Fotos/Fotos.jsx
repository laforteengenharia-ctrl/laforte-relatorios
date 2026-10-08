import {
  useEffect,
  useRef,
  useState,
} from "react";

const GOOGLE_DRIVE_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbykcDwsViBK50fZmdSBW1_f9_K7Blz5TPuZICdvLO-LUFsMxG6-5A94A4f1yqe1QufB5Q/exec";

// ============================================================
// COMPONENTE DE FOTO
// ============================================================

function FotoDrive({
  arquivo,
  onAbrir,
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

        const url =
          `${GOOGLE_DRIVE_SCRIPT_URL}` +
          `?acao=imagem` +
          `&arquivo_id=${encodeURIComponent(
            arquivo.id
          )}`;

        const resposta = await fetch(url);

        if (!resposta.ok) {
          throw new Error(
            `HTTP ${resposta.status}`
          );
        }

        const dados = await resposta.json();

        if (
          !dados.ok ||
          !dados.base64
        ) {
          throw new Error(
            dados.erro ||
              "Imagem não disponível."
          );
        }

        if (cancelado) {
          return;
        }

        const urlImagem =
          `data:${dados.tipo};base64,${dados.base64}`;

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
  }, [arquivo.id]);

  return (
    <button
      ref={elementoRef}
      type="button"
      onClick={() => {
        if (imagem) {
          onAbrir({
            ...arquivo,
            url: imagem,
          });
        }
      }}
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

      const url =
        `${GOOGLE_DRIVE_SCRIPT_URL}` +
        `?drive_pasta_id=${encodeURIComponent(
          pastaFotosId
        )}` +
        `&acao=listar_medicoes`;

      const resposta =
        await fetch(url);

      if (!resposta.ok) {
        throw new Error(
          `Erro ao consultar o Google Drive. HTTP ${resposta.status}.`
        );
      }

      const dados =
        await resposta.json();

      if (!dados.ok) {
        throw new Error(
          dados.erro ||
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

      const url =
        `${GOOGLE_DRIVE_SCRIPT_URL}` +
        `?drive_pasta_id=${encodeURIComponent(
          frenteSelecionada.drive_pasta_id
        )}` +
        `&medicao=${encodeURIComponent(
          medicao.numero
        )}`;

      const resposta =
        await fetch(url);

      if (!resposta.ok) {
        throw new Error(
          `Erro ao consultar as fotos. HTTP ${resposta.status}.`
        );
      }

      const dados =
        await resposta.json();

      if (!dados.ok) {
        throw new Error(
          dados.erro ||
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
    <div
      style={{
        minHeight: "100%",
        padding: "30px",
        background: "#f5f7fb",
      }}
    >

      {/* CABEÇALHO */}

      <div
        style={{
          maxWidth:
            "1200px",
          margin:
            "0 auto 25px",
        }}
      >
        <button
          type="button"
          onClick={voltar}
          style={{
            padding:
              "10px 18px",
            border:
              "1px solid #999",
            borderRadius:
              "4px",
            background:
              "#fff",
            cursor:
              "pointer",
            fontSize:
              "16px",
          }}
        >
          ←{" "}
          {medicaoSelecionada
            ? "Voltar para medições"
            : "Voltar para obra"}
        </button>

        <div
          style={{
            textAlign:
              "center",
            marginTop:
              "35px",
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize:
                "54px",
              color:
                "#05050b",
            }}
          >
            📷 Fotos
          </h1>

          <div
            style={{
              fontSize:
                "23px",
              color:
                "#58729a",
              marginTop:
                "2px",
            }}
          >
            {
              frenteSelecionada.nome
            }
          </div>

          <div
            style={{
              fontSize:
                "20px",
              color:
                "#58729a",
              marginTop:
                "12px",
            }}
          >
            Contrato{" "}
            {
              contratoSelecionado.numero
            }{" "}
            —{" "}
            {
              contratoSelecionado.nome
            }
          </div>
        </div>
      </div>

      {/* ======================================================
          LISTA DE MEDIÇÕES
      ====================================================== */}

      {!medicaoSelecionada && (
        <div
          style={{
            maxWidth:
              "1100px",
            margin:
              "0 auto",
            background:
              "#fff",
            border:
              "1px solid #dbe3ef",
            borderRadius:
              "16px",
            padding:
              "35px",
            boxShadow:
              "0 2px 8px rgba(0,0,0,0.04)",
          }}
        >
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
              marginBottom:
                "28px",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize:
                  "30px",
              }}
            >
              📁 Medições
            </h2>

            <div
              style={{
                background:
                  "#eef5ff",
                color:
                  "#1756d1",
                borderRadius:
                  "30px",
                padding:
                  "12px 18px",
                fontWeight:
                  "600",
              }}
            >
              {
                medicoes.length
              }{" "}
              {medicoes.length ===
              1
                ? "medição"
                : "medições"}
            </div>
          </div>

          <p
            style={{
              textAlign:
                "center",
              color:
                "#58729a",
              fontSize:
                "20px",
              marginBottom:
                "35px",
            }}
          >
            Medições encontradas
            na pasta Fotos
            desta obra.
          </p>

          {carregandoMedicoes && (
            <div
              style={{
                textAlign:
                  "center",
                padding:
                  "35px",
                color:
                  "#58729a",
                fontSize:
                  "18px",
              }}
            >
              ⏳ Carregando
              medições do
              Google Drive...
            </div>
          )}

          {!carregandoMedicoes &&
            erroMedicoes && (
              <div
                style={{
                  padding:
                    "18px",
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
                  erroMedicoes
                }
              </div>
            )}

          {!carregandoMedicoes &&
            !erroMedicoes &&
            medicoes.length ===
              0 && (
              <div
                style={{
                  textAlign:
                    "center",
                  padding:
                    "40px",
                  color:
                    "#64748b",
                  fontSize:
                    "18px",
                }}
              >
                Nenhuma medição
                foi encontrada
                na pasta Fotos
                desta obra.
              </div>
            )}

          {!carregandoMedicoes &&
            !erroMedicoes &&
            medicoes.length >
              0 && (
              <div
                style={{
                  display:
                    "flex",
                  flexDirection:
                    "column",
                  gap:
                    "15px",
                }}
              >
                {medicoes.map(
                  (medicao) => (
                    <div
                      key={
                        medicao.id
                      }
                      style={{
                        border:
                          "1px solid #dbe3ef",
                        borderRadius:
                          "14px",
                        padding:
                          "22px 25px",
                        background:
                          "#f8fafc",
                        display:
                          "flex",
                        alignItems:
                          "center",
                        justifyContent:
                          "space-between",
                        gap:
                          "20px",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize:
                              "22px",
                            fontWeight:
                              "700",
                            color:
                              "#111827",
                          }}
                        >
                          📁 Medição{" "}
                          {String(
                            medicao.numero
                          ).padStart(
                            2,
                            "0"
                          )}
                        </div>

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
                          {
                            medicao.nome
                          }
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          abrirFotos(
                            medicao
                          )
                        }
                        style={{
                          padding:
                            "12px 20px",
                          border:
                            "1px solid #cbd5e1",
                          borderRadius:
                            "9px",
                          background:
                            "#fff",
                          cursor:
                            "pointer",
                          fontSize:
                            "16px",
                          fontWeight:
                            "600",
                          whiteSpace:
                            "nowrap",
                        }}
                      >
                        📷 Ver fotos
                      </button>
                    </div>
                  )
                )}
              </div>
            )}
        </div>
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
        </div>
      )}
    </div>
  );
}