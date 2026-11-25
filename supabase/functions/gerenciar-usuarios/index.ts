import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
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

    // Verifica usuário logado
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

    // Somente administradores podem gerenciar usuários
    // Usa app_metadata (só alterável pelo servidor com a service role key),
    // nunca user_metadata (que o próprio usuário logado pode editar sozinho
    // via supabase.auth.updateUser(), o que permitiria autopromoção a admin).
    const perfilAtual =
      user.app_metadata?.perfil || "usuario";

    if (perfilAtual !== "admin") {
      return new Response(
        JSON.stringify({
          error:
            "Você não possui permissão para gerenciar usuários.",
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

    // Cliente administrativo
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();

    const acao = body.acao;

    // =====================================================
    // LISTAR USUÁRIOS
    // =====================================================

    if (acao === "listar") {
      const usuarios = [];

      let pagina = 1;
      const porPagina = 1000;

      while (true) {
        const {
          data,
          error,
        } = await supabaseAdmin.auth.admin.listUsers({
          page: pagina,
          perPage: porPagina,
        });

        if (error) {
          throw error;
        }

        if (data?.users) {
          usuarios.push(...data.users);
        }

        if (
          !data?.users ||
          data.users.length < porPagina
        ) {
          break;
        }

        pagina++;
      }

      const resultado = usuarios.map((usuario) => ({
        id: usuario.id,
        nome:
          usuario.user_metadata?.nome ||
          "",
        email:
          usuario.email ||
          "",
        perfil:
          usuario.app_metadata?.perfil ||
          "usuario",
        criado_em:
          usuario.created_at,
        ultimo_login:
          usuario.last_sign_in_at || null,
        confirmado:
          !!usuario.email_confirmed_at,
      }));

      return new Response(
        JSON.stringify({
          sucesso: true,
          usuarios: resultado,
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // =====================================================
    // EDITAR USUÁRIO
    // =====================================================

    if (acao === "editar") {
      const {
        id,
        nome,
        email,
        perfil,
        senha,
      } = body;

      if (!id) {
        return new Response(
          JSON.stringify({
            error: "ID do usuário não informado.",
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

      if (!nome || !email) {
        return new Response(
          JSON.stringify({
            error:
              "Nome e e-mail são obrigatórios.",
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

      if (senha && senha.length < 6) {
        return new Response(
          JSON.stringify({
            error:
              "A senha deve possuir pelo menos 6 caracteres.",
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

      const dadosAtualizacao: any = {
        email: email.trim().toLowerCase(),
        user_metadata: {
          nome: nome.trim(),
        },

        // perfil fica em app_metadata (não editável pelo próprio usuário)
        app_metadata: {
          perfil: perfil || "usuario",
        },
      };

      if (senha && senha.trim()) {
        dadosAtualizacao.password = senha;
      }

      const {
        data,
        error,
      } =
        await supabaseAdmin.auth.admin.updateUserById(
          id,
          dadosAtualizacao
        );

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
          mensagem:
            "Usuário atualizado com sucesso.",
          usuario: {
            id: data.user?.id,
            nome:
              data.user?.user_metadata?.nome ||
              "",
            email:
              data.user?.email ||
              "",
            perfil:
              data.user?.app_metadata?.perfil ||
              "usuario",
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
    }

    // =====================================================
    // EXCLUIR USUÁRIO
    // =====================================================

    if (acao === "excluir") {
      const { id } = body;

      if (!id) {
        return new Response(
          JSON.stringify({
            error: "ID do usuário não informado.",
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

      // Impede excluir a própria conta
      if (id === user.id) {
        return new Response(
          JSON.stringify({
            error:
              "Você não pode excluir o próprio usuário.",
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

      const { error } =
        await supabaseAdmin.auth.admin.deleteUser(id);

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
          mensagem:
            "Usuário excluído com sucesso.",
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    return new Response(
      JSON.stringify({
        error: "Ação não reconhecida.",
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );

  } catch (error) {
    console.error(
      "Erro na função gerenciar-usuarios:",
      error
    );

    return new Response(
      JSON.stringify({
        error:
          "Erro interno ao gerenciar usuários.",
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