# Análise do sistema de relatório fotográfico — La Forte Engenharia

Data: 18/11/2026

## Resumo

O sistema (app React/Vite + Supabase + Google Apps Script como proxy do Drive) já resolve bem o problema principal: selecionar fotos por frente/medição, gerar um Word formatado automaticamente e publicar a cópia direto no Drive do contrato. As regras de layout que ajustamos nas últimas sessões (bordas, formatos por página) deixaram o relatório no padrão que vocês precisavam.

Dito isso, na revisão do código encontrei alguns pontos que valem atenção — um deles de segurança (prioridade alta) e os demais de manutenção/confiabilidade, que ajudam a evitar que bugs como os que fomos corrigindo nas últimas semanas continuem aparecendo só depois que alguém gera um relatório real e nota o erro.

## 1. Segurança — o link do Google Apps Script não tem nenhuma autenticação (prioridade alta)

O `GOOGLE_DRIVE_SCRIPT_URL` (a URL do Apps Script que serve fotos, grava o Word no Drive e mexe na planilha de custos) está hardcoded no código do app e é chamado diretamente do navegador, sem token nem verificação de quem está pedindo. Isso significa que **qualquer pessoa que descubra essa URL** (ela aparece no código-fonte público do site e em qualquer requisição de rede) consegue, sem fazer login:

- listar e baixar fotos de qualquer medição de qualquer contrato (`acao=imagem`, `listar_medicoes`);
- sobrescrever o arquivo Word do relatório de qualquer contrato (`doPost` com `acao=salvar_relatorio_word`);
- adicionar ou excluir lançamentos na planilha de custos de qualquer frente (`acao=salvar_custo` / `excluir_custo`).

Por comparação: a parte de usuários (`Usuarios.jsx`) faz isso certo — exige sessão do Supabase e manda o token no header antes de chamar a Edge Function. O Apps Script não segue o mesmo padrão.

Vale destacar que o endpoint de imagem já tem uma proteção parcial boa (confere se o arquivo pedido realmente pertence à pasta da medição informada, então não dá para listar arquivos arbitrários do Drive só sabendo o ID). Mas isso não resolve o problema de qualquer um poder consultar fotos/custos de contratos que não são dele, ou sobrescrever um relatório, só tendo a URL.

**Sugestão prática**: adicionar um segredo compartilhado (um token fixo gerado por vocês, verificado no início de `doGet`/`doPost` antes de qualquer ação) ou, melhor, passar o `access_token` da sessão do Supabase e validar no Apps Script via chamada à API do Supabase — do jeito que já é feito em `Usuarios.jsx`.

## 2. Confiabilidade — outras páginas têm o mesmo bug de rede que corrigimos no relatório

O "Failed to fetch" que corrigimos há pouco no `Medicoes.jsx` (chamada de rede sem nova tentativa em caso de falha momentânea) **ainda existe, sem correção, em `Fotos.jsx` e `CustosFrente.jsx`** — ambos usam `fetch()` direto, sem a função `fetchComRetentativa` que já existe e funciona bem no `Medicoes.jsx`. Ou seja, é provável que apareçam os mesmos erros intermitentes ao navegar fotos de uma frente ou sincronizar custos, só que ainda não foram reportados.

**Sugestão prática**: mover `fetchComRetentativa` para um arquivo compartilhado (`src/utils/` ou `src/services/`) e usá-la nas três telas, em vez de ter a mesma lógica (e o mesmo bug) implementada separadamente em cada uma.

## 3. Manutenibilidade — a lógica de layout das fotos está duplicada (Word x PDF)

`gerarRelatorioWord.js` e a função `gerarRelatorioFotografico()` dentro de `Medicoes.jsx` reimplementam, cada uma à sua maneira, a mesma coisa: classificação do formato da foto (vertical/horizontal/panorâmica), cálculo de tamanho de exibição e o agrupamento em linhas/páginas. É exatamente por isso que, nas últimas correções desta sessão, cada ajuste de regra (borda, quantidade por página, foto horizontal maior) teve que ser feito duas vezes, em dois arquivos — com risco real de um ficar desatualizado em relação ao outro.

**Sugestão prática**: extrair essa lógica (formatos, `FOTOS_POR_LINHA`, `ALTURA_LINHA_CM`, agrupamento em linhas/páginas) para um módulo único (`src/utils/layoutFotos.js`), usado tanto pelo gerador de Word quanto pelo de PDF/HTML. Isso é a mudança de maior impacto a médio prazo — devem ter sido 5 rodadas de ida e volta nesta conversa que seriam só uma se a regra existisse em um único lugar.

## 4. Código morto — Dexie/IndexedDB (`src/database/db.js`) não é mais usado

O arquivo configura um banco local (IndexedDB via Dexie) com tabelas `contratos`, `frentes`, `medicoes`, `fotos`, `legendas`, `auditoria` — mas nenhuma outra parte do código importa esse `db`. Hoje tudo passa pelo Supabase. Isso sugere que foi uma versão anterior do app (antes de usar Supabase) e ficou esquecido.

**Sugestão prática**: remover o arquivo e a dependência `dexie` do `package.json` (reduz o tamanho do build sem efeito nenhum na funcionalidade), a menos que haja um plano de voltar a usar armazenamento local — nesse caso vale documentar isso no código.

## 5. Outros pontos menores

- **URL do Apps Script duplicada em pelo menos 4 arquivos** (`Medicoes.jsx`, `Fotos.jsx`, `CustosFrente.jsx`, e provavelmente `Frentes.jsx`/`Contratos.jsx`). Se um dia precisar trocar a implantação do script, dá trabalho achar todos os lugares. Vale uma constante única em `src/services/` ou uma variável de ambiente (`VITE_GOOGLE_DRIVE_SCRIPT_URL`), do mesmo jeito que já fazem com `VITE_SUPABASE_URL`.
- **`README.md` tem marcadores de conflito de merge não resolvidos** (`<<<<<<< HEAD` ... `>>>>>>> ...`). Não afeta o app rodando, mas é sinal de que um merge ficou pela metade — vale limpar.
- **Sem testes automatizados nem CI.** Dado o histórico desta conversa (vários rounds de bugs visuais só descobertos depois que alguém gerou um relatório real), mesmo um teste simples que gera um Word/PDF de amostra e confere a contagem de fotos por página já teria pego pelo menos 2 dos bugs que corrigimos manualmente.
- **`Medicoes.jsx` está com mais de 2600 linhas**, misturando CRUD de medições, navegação de fotos do Drive, geração de Word e geração de PDF num único componente. Não é urgente, mas divide bem em componentes/hooks menores quando for mexer de novo por aqui.

## O que já está bem feito

- O proxy de imagem no Apps Script valida que o arquivo pedido pertence à pasta da medição certa — isso evita que alguém explore IDs de arquivo aleatórios do Drive da empresa.
- `Usuarios.jsx`/`Login.jsx` seguem o padrão correto de autenticação (sessão Supabase + token no header da Edge Function).
- A sincronização do Word agora tem reintentos e confirmação em duas etapas (upload + confirmação via GET com `sync_token`), o que deixou a gravação no Drive bem mais confiável do que uma chamada única.
- A regra de layout fixo por formato de foto (vertical/horizontal/panorâmica) resolveu um problema real de inconsistência visual nos relatórios, e o Apps Script já usa um `script_version` para detectar quando o front e o backend estão dessincronizados — um bom hábito que vale manter conforme o sistema cresce.

## Prioridade sugerida

1. Proteger o endpoint do Apps Script com algum tipo de verificação de sessão/token (segurança).
2. Unificar a lógica de layout de fotos num módulo só, usado por Word e PDF (evita a maior fonte de retrabalho que vimos nesta conversa).
3. Levar `fetchComRetentativa` para um lugar compartilhado e aplicar em `Fotos.jsx`/`CustosFrente.jsx`.
4. Limpeza: remover `db.js`/Dexie não usados, resolver o README, centralizar a URL do Apps Script.
