import { useEffect, useState } from "react";

import "./Contratos.css";

import Modal from "../../components/Modal/Modal";
import ContratoForm from "../../components/ContratoForm/ContratoForm";

import { db } from "../../database/db";


export default function Contratos() {

  const [modalAberto, setModalAberto] = useState(false);


  const [contratos, setContratos] = useState([]);


  const [contrato, setContrato] = useState({
    numero: "",
    nome: "",
    cliente: "",
    cidade: "",
    uf: "SC",
    status: "Ativo",
  });



  async function carregarContratos() {

    const lista = await db.contratos.toArray();

    setContratos(lista);

  }



  useEffect(() => {

    carregarContratos();

  }, []);




  function atualizarCampo(campo, valor) {

    setContrato({

      ...contrato,

      [campo]: valor,

    });

  }




  async function salvarContrato(evento) {

    evento.preventDefault();


    if (
      !contrato.numero ||
      !contrato.nome ||
      !contrato.cliente
    ) {

      alert(
        "Preencha Número do Contrato, Nome da Obra e Cliente."
      );

      return;

    }



    await db.contratos.add(contrato);



    await carregarContratos();



    setContrato({

      numero: "",
      nome: "",
      cliente: "",
      cidade: "",
      uf: "SC",
      status: "Ativo",

    });



    setModalAberto(false);


  }





  return (

    <div className="contratos-page">


      <div className="topo">

        <div>

          <h1>Contratos</h1>

          <p>
            Gerencie todos os contratos cadastrados.
          </p>

        </div>



        <button

          className="novo-btn"

          onClick={() => setModalAberto(true)}

        >

          + Novo Contrato

        </button>


      </div>




      <div className="pesquisa">

        <input

          type="text"

          placeholder="Pesquisar contrato..."

        />

      </div>





      <table className="tabela">


        <thead>

          <tr>

            <th>Nº Contrato</th>

            <th>Nome da Obra</th>

            <th>Cliente</th>

            <th>Status</th>

            <th>Ações</th>

          </tr>

        </thead>



        <tbody>


          {
            contratos.length === 0 ? (

              <tr>

                <td
                  colSpan="5"
                  className="vazio"
                >

                  Nenhum contrato cadastrado.

                </td>

              </tr>


            ) : (


              contratos.map((item) => (

                <tr key={item.id}>

                  <td>{item.numero}</td>

                  <td>{item.nome}</td>

                  <td>{item.cliente}</td>

                  <td>{item.status}</td>

                  <td>

                    <button>
                      Editar
                    </button>

                  </td>

                </tr>

              ))


            )
          }



        </tbody>


      </table>






      <Modal

        aberto={modalAberto}

        titulo="Novo Contrato"

        onClose={() => setModalAberto(false)}

      >


        <ContratoForm

          contrato={contrato}

          atualizarCampo={atualizarCampo}

          onCancelar={() => setModalAberto(false)}

          onSalvar={salvarContrato}

        />


      </Modal>



    </div>

  );

}