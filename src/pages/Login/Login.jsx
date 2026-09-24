import { useState } from "react";
import { supabase } from "../../services/supabase";
import "./Login.css";

export default function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [recuperando, setRecuperando] = useState(false);

  async function entrar(evento) {
    evento.preventDefault();

    setErro("");
    setMensagem("");
    setCarregando(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    });

    if (error) {
      setErro("E-mail ou senha incorretos.");
      setCarregando(false);
      return;
    }

    setCarregando(false);
  }

  async function esqueciSenha() {
    setErro("");
    setMensagem("");

    const emailInformado = email.trim();

    if (!emailInformado) {
      setErro("Digite seu e-mail antes de solicitar a redefinição da senha.");
      return;
    }

    setRecuperando(true);

    const { error } = await supabase.auth.resetPasswordForEmail(
      emailInformado,
      {
        redirectTo: `${window.location.origin}/recuperar-senha`,
      }
    );

    if (error) {
  console.error("ERRO SUPABASE RECUPERAÇÃO:", error);

  setErro(`Erro: ${error.message}`);

  setRecuperando(false);
  return;
}
      
        
      
      
      
    

    setMensagem(
      "E-mail de recuperação enviado. Verifique sua caixa de entrada."
    );

    setRecuperando(false);
  }

  return (
    <div className="login-page">
      <div className="login-card">

        <div className="login-logo">
          LF
        </div>

        <h1>LA FORTE</h1>

        <p className="login-subtitulo">
          Relatórios de Obras
        </p>

        <form onSubmit={entrar}>

          <label>E-mail</label>

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            autoComplete="email"
            required
          />

          <label>Senha</label>

          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Digite sua senha"
            autoComplete="current-password"
            required
          />

          {erro && (
            <div className="login-erro">
              {erro}
            </div>
          )}

          {mensagem && (
            <div className="login-sucesso">
              {mensagem}
            </div>
          )}

          <button
            type="submit"
            disabled={carregando || recuperando}
          >
            {carregando ? "Entrando..." : "Entrar"}
          </button>

          <button
            type="button"
            className="login-esqueci"
            onClick={esqueciSenha}
            disabled={carregando || recuperando}
          >
            {recuperando
              ? "Enviando..."
              : "Esqueci minha senha"}
          </button>

        </form>

      </div>
    </div>
  );
}