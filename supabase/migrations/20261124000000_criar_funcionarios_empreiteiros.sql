-- Cadastro de funcionários e empreiteiros (tela "Configurações"), usado para
-- agilizar o lançamento de custos de "Mão de obra" em Custos da frente.

create table if not exists public.funcionarios (
  id bigint generated always as identity primary key,
  nome text not null,
  cpf text,
  funcao text,
  salario numeric(12,2),
  custo_empresa numeric(12,2),
  observacoes text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.empreiteiros (
  id bigint generated always as identity primary key,
  nome text not null,
  funcao text,
  salario numeric(12,2),
  valor_diarista numeric(12,2),
  valor_quinzena numeric(12,2),
  observacoes text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.funcionarios enable row level security;
alter table public.empreiteiros enable row level security;

-- Mesmo padrão já usado no restante do sistema: qualquer usuário autenticado
-- tem acesso total (sem distinção de perfil para os dados em si).
create policy "funcionarios_select_authenticated" on public.funcionarios
  for select to authenticated using (true);
create policy "funcionarios_insert_authenticated" on public.funcionarios
  for insert to authenticated with check (true);
create policy "funcionarios_update_authenticated" on public.funcionarios
  for update to authenticated using (true) with check (true);
create policy "funcionarios_delete_authenticated" on public.funcionarios
  for delete to authenticated using (true);

create policy "empreiteiros_select_authenticated" on public.empreiteiros
  for select to authenticated using (true);
create policy "empreiteiros_insert_authenticated" on public.empreiteiros
  for insert to authenticated with check (true);
create policy "empreiteiros_update_authenticated" on public.empreiteiros
  for update to authenticated using (true) with check (true);
create policy "empreiteiros_delete_authenticated" on public.empreiteiros
  for delete to authenticated using (true);
