import "./ContratoForm.css";

export default function ContratoForm({
  contrato,
  atualizarCampo,
  onCancelar,
  onSalvar
}) {

  return (
    <form
      className="form-contrato"
      onSubmit={onSalvar}
    >

      <div className="campo">
        <label>Número do Contrato</label>

        <input
          type="text"
          placeholder="Ex.: 25/2026"
          value={contrato.numero}
          onChange={(e) =>
            atualizarCampo("numero", e.target.value)
          }
        />

      </div>


      <div className="campo">
        <label>Nome da Obra</label>

        <input
          type="text"
          value={contrato.nome}
          onChange={(e) =>
            atualizarCampo("nome", e.target.value)
          }
        />

      </div>


      <div className="campo">
        <label>Cliente</label>

        <input
          type="text"
          value={contrato.cliente}
          onChange={(e) =>
            atualizarCampo("cliente", e.target.value)
          }
        />

      </div>


      <div className="linha">

        <div className="campo">
          <label>Cidade</label>

          <input
            type="text"
            value={contrato.cidade}
            onChange={(e) =>
              atualizarCampo("cidade", e.target.value)
            }
          />

        </div>


        <div className="campo">
          <label>UF</label>

          <select
            value={contrato.uf}
            onChange={(e) =>
              atualizarCampo("uf", e.target.value)
            }
          >

            <option>SC</option>
            <option>PR</option>
            <option>RS</option>

          </select>

        </div>

      </div>


      <div className="campo">

        <label>Status</label>

        <select
          value={contrato.status}
          onChange={(e) =>
            atualizarCampo("status", e.target.value)
          }
        >

          <option>Ativo</option>
          <option>Encerrado</option>

        </select>

      </div>


      <div className="botoes-modal">

        <button
          type="button"
          onClick={onCancelar}
        >
          Cancelar
        </button>


        <button
          type="submit"
          className="salvar"
        >
          Salvar
        </button>

      </div>


    </form>
  );
}