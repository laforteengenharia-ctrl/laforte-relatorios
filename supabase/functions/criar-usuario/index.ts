import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {

  // Permite requisições OPTIONS do navegador
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }


  try {

    // Cliente usando a chave pública para identificar quem está fazendo a requisição
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: {
            Authorization:
              req.headers.get("Authorization") ?? "",
          },
        },
      }
    );


    // Verifica se existe usuário logado
    const {
      data: { user },
      error: usuarioError,
    } = await supabase.auth.getUser();


    if (usuarioError || !user) {

      return new Response(
        JSON.stringify({
          error: "Usuário não autenticado.",
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );

    }


    // Somente administradores podem criar novos usuários
    const perfilAtual =
      user.user_metadata?.perfil || "usuario";

    if (perfilAtual !== "admin") {

      return new Response(
        JSON.stringify({
          error:
            "Você não possui permissão para criar usuários.",
        }),
        {
          status: 403,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );

    }


    // Dados enviados pelo sistema
    const {
      nome,
      email,
      senha,
      perfil,
    } = await req.json();


    // Validações
    if (!nome || !email || !senha) {

      return new Response(
        JSON.stringify({
          error: "Nome, e-mail e senha são obrigatórios.",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );

    }


    if (senha.length < 6) {

      return new Response(
        JSON.stringify({
          error: "A senha deve possuir pelo menos 6 caracteres.",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );

    }


    // Cliente administrativo
    // A SERVICE_ROLE_KEY fica SOMENTE no servidor.
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );


    // Cria o usuário no Supabase Auth
    const {
      data,
      error,
    } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password: senha,
      email_confirm: true,

      user_metadata: {
        nome: nome.trim(),
        perfil: perfil || "usuario",
      },
    });


    if (error) {

      return new Response(
        JSON.stringify({
          error: error.message,
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );

    }


    return new Response(
      JSON.stringify({
        sucesso: true,
        mensagem: "Usuário criado com sucesso.",
        usuario: {
          id: data.user?.id,
          email: data.user?.email,
          nome: data.user?.user_metadata?.nome,
          perfil: data.user?.user_metadata?.perfil,
        },
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );


  } catch (error) {

    console.error(error);


    return new Response(
      JSON.stringify({
        error: "Erro interno ao criar usuário.",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );

  }

});