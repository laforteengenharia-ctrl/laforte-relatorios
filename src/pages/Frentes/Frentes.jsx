import { useEffect, useState } from "react";

import "./Frentes.css";

import { db } from "../../database/db";


export default function Frentes() {

  const [contratos, setContratos] = useState([]);

  const [contratoSelecionado, setContratoSelecionado] = useState("");

  const [frentes, setFrentes] = useState([]);

  const [nome, setNome] = useState("");

  const [editandoId, setEditandoId] = useState(null);


  async function carregarContratos() {

    const lista = await db.contratos.toArray();

    setContratos(lista);


    if (lista.length > 0 && !contratoSelecionado) {

      setContratoSelecionado(String(lista[0].id));

    }

  }


  async function carregarFrentes(contratoId) {

    if (!contratoId) {

      setFrentes([]);

      return;

    }


    const lista = await db.frentes
      .where("contratoId")
      .equals(Number(contratoId))
      .sortBy("ordem");


    setFrentes(lista);

  }


  useEffect(() => {

    carregarContratos();

  }, []);


  useEffect(() => {

    carregarFrentes(contratoSelecionado);

    setEditandoId(null);

    setNome("");

  }, [contratoSelecionado]);


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


    if (editandoId) {

      await db.frentes.update(

        editandoId,

        {
          nome: nome.trim(),
        }

      );

    } else {

      const ultimaFrente = frentes.length > 0
        ? frentes[frentes.length - 1]
        : null;


      const novaOrdem = ultimaFrente
        ? ultimaFrente.ordem + 1
        : 1;


      await db.frentes.add({

        contratoId: Number(contratoSelecionado),

        nome: nome.trim(),

        ordem: novaOrdem,

      });

    }


    setNome("");

    setEditandoId(null);


    await carregarFrentes(contratoSelecionado);

  }


  function iniciarEdicao(frente) {

    setEditandoId(frente.id);

    setNome(frente.nome);

  }


  function cancelarEdicao() {

    setEditandoId(null);

    setNome("");

  }


  async function excluirFrente(id) {

    const confirmar = window.confirm(

      "Deseja realmente excluir esta frente/obra?"

    );


    if (!confirmar) return;


    await db.frentes.delete(id);


    await reorganizarOrdem();

  }


  async function reorganizarOrdem() {

    const lista = await db.frentes
      .where("contratoId")
      .equals(Number(contratoSelecionado))
      .sortBy("ordem");


    for (let i = 0; i < lista.length; i++) {

      await db.frentes.update(

        lista[i].id,

        {
          ordem: i + 1,
        }

      );

    }


    await carregarFrentes(contratoSelecionado);

  }


  async function moverFrente(id, direcao) {

    const indice = frentes.findIndex(

      (frente) => frente.id === id

    );


    if (indice === -1) return;


    const novoIndice = indice + direcao;


    if (
      novoIndice < 0 ||
      novoIndice >= frentes.length
    ) {

      return;

    }


    const frenteAtual = frentes[indice];

    const frenteDestino = frentes[novoIndice];


    await db.frentes.update(

      frenteAtual.id,

      {
        ordem: frenteDestino.ordem,
      }

    );


    await db.frentes.update(

      frenteDestino.id,

      {
        ordem: frenteAtual.ordem,
      }

    );


    await carregarFrentes(contratoSelecionado);

  }


  return (

    <div className="frentes-page">


      <div className="frentes-topo">

        <div>

          <h1>Frentes / Obras</h1>

          <p>
            Cadastre as frentes ou obras vinculadas a cada contrato.
          </p>

        </div>

      </div>



      <div className="frentes-cadastro">


        <h2>Contrato</h2>


        {contratos.length === 0 ? (

          <div className="frentes-vazio">

            <p>
              Nenhum contrato cadastrado.
            </p>

            <p>
              Cadastre um contrato antes de criar uma frente/obra.
            </p>

          </div>

        ) : (

          <select

            value={contratoSelecionado}

            onChange={(e) =>
              setContratoSelecionado(e.target.value)
            }

          >

            {contratos.map((contrato) => (

              <option
                key={contrato.id}
                value={contrato.id}
              >

                {contrato.numero} - {contrato.nome}

              </option>

            ))}

          </select>

        )}


      </div>



      {contratos.length > 0 && (

        <div className="frentes-cadastro">


          <h2>

            {editandoId
              ? "Editar Frente / Obra"
              : "Nova Frente / Obra"}

          </h2>



          <form
            onSubmit={adicionarOuSalvarFrente}
          >


            <input

              type="text"

              placeholder="Ex.: ETA - Ingleses"

              value={nome}

              onChange={(e) =>
                setNome(e.target.value)
              }

            />


            <button type="submit">

              {editandoId
                ? "Salvar Alteração"
                : "+ Adicionar Frente / Obra"}

            </button>



            {editandoId && (

              <button

                type="button"

                onClick={cancelarEdicao}

              >

                Cancelar

              </button>

            )}


          </form>


        </div>

      )}



      <div className="lista-frentes">


        <h2>Frentes / Obras cadastradas</h2>


        {frentes.length === 0 ? (

          <div className="frentes-vazio">

            <p>
              Nenhuma frente/obra cadastrada para este contrato.
            </p>

          </div>

        ) : (

          <div className="frentes-grid">


            {frentes.map((frente, indice) => (

              <div

                className="frente-card"

                key={frente.id}

              >


                <div>

                  <span>
                    Frente / Obra {frente.ordem}
                  </span>

                  <h3>
                    {frente.nome}
                  </h3>

                </div>



                <div className="frente-acoes">


                  <button

                    type="button"

                    onClick={() =>
                      moverFrente(frente.id, -1)
                    }

                    disabled={indice === 0}

                    title="Subir"

                  >

                    ↑

                  </button>



                  <button

                    type="button"

                    onClick={() =>
                      moverFrente(frente.id, 1)
                    }

                    disabled={
                      indice === frentes.length - 1
                    }

                    title="Descer"

                  >

                    ↓

                  </button>



                  <button

                    type="button"

                    onClick={() =>
                      iniciarEdicao(frente)
                    }

                  >

                    Editar

                  </button>



                  <button

                    type="button"

                    onClick={() =>
                      excluirFrente(frente.id)
                    }

                  >

                    Excluir

                  </button>


                </div>


              </div>

            ))}


          </div>

        )}


      </div>


    </div>

  );

}