import { supabase } from "./supabase";

// =====================================================
// TOKEN DE SESSÃO PARA O APPS SCRIPT (PROXY DO DRIVE)
// =====================================================
// O Apps Script não tem acesso a cabeçalhos HTTP (doGet/doPost não expõem
// headers), então o token precisa ir como parâmetro de URL (GET) ou campo
// do corpo (POST), do mesmo jeito que os demais parâmetros já são enviados.
// O Apps Script valida esse token chamando a API de autenticação do
// Supabase antes de executar qualquer ação.

export async function obterTokenDrive() {
  const { data, error } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (error || !token) {
    throw new Error("Sua sessão expirou. Faça login novamente para continuar.");
  }
  return token;
}
