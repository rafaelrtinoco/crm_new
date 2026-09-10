-- Importação guiada de planilha (PRD §6.1). O worker de processamento em
-- si (mapeamento, dedup, relatório de erro linha a linha) é da Fase 1C —
-- aqui só o schema que registra o job e os erros.

create table public.importacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  arquivo_nome text not null,
  mapeamento_colunas jsonb not null default '{}'::jsonb,
  status text not null default 'processando' check (status in ('processando', 'concluida', 'concluida_com_erros', 'falhou')),
  total_linhas integer not null default 0,
  total_importadas integer not null default 0,
  total_erros integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

create index idx_importacoes_empresa on public.importacoes (empresa_id);

create trigger trg_importacoes_updated_at
  before update on public.importacoes
  for each row execute function public.set_updated_at();

alter table public.importacoes enable row level security;

create policy "importacoes_select_membro"
  on public.importacoes for select
  to authenticated
  using (public.is_membro(empresa_id));

create policy "importacoes_insert_proprio"
  on public.importacoes for insert
  to authenticated
  with check (public.is_membro(empresa_id) and created_by = (select auth.uid()));

create policy "importacoes_update_gestor_ou_dono"
  on public.importacoes for update
  to authenticated
  using (public.tem_papel(empresa_id, 'gestor') or created_by = (select auth.uid()))
  with check (public.tem_papel(empresa_id, 'gestor') or created_by = (select auth.uid()));

create table public.importacao_erros (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  importacao_id uuid not null references public.importacoes (id) on delete cascade,
  linha integer not null,
  erro text not null,
  dados_originais jsonb,
  created_at timestamptz not null default now()
);

create index idx_importacao_erros_empresa on public.importacao_erros (empresa_id);
create index idx_importacao_erros_importacao on public.importacao_erros (importacao_id);

alter table public.importacao_erros enable row level security;

-- Populado pelo worker de importação (service_role, Fase 1C); só leitura
-- para `authenticated` nesta migration.
create policy "importacao_erros_select_membro"
  on public.importacao_erros for select
  to authenticated
  using (public.is_membro(empresa_id));
