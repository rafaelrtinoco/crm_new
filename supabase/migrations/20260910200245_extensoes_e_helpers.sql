-- Fundação: extensões, tenant mínimo (empresas, empresa_membros) e as
-- funções de isolamento multiempresa. Toda RLS do projeto depende delas.
-- Ver docs/decisoes/0001-isolamento-multiempresa.md.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- Trigger genérico de updated_at, reusado por todas as tabelas do projeto.
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- empresas — o tenant. Não tem empresa_id (ela É o tenant).
-- ---------------------------------------------------------------------
create table public.empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  nicho text not null,
  fuso text not null default 'America/Sao_Paulo',
  horario_comercial jsonb not null default '{"seg_sex": ["08:00", "18:00"], "sab": null, "dom": null}'::jsonb,
  carteira_compartilhada boolean not null default false,
  vocabulario jsonb not null default '{}'::jsonb,
  logo_url text,
  cor_primaria text,
  trial_termina_em date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  deleted_at timestamptz
);

create index idx_empresas_nicho on public.empresas (nicho);

create trigger trg_empresas_updated_at
  before update on public.empresas
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- empresa_membros — usuário ↔ empresa ↔ papel.
-- ---------------------------------------------------------------------
create table public.empresa_membros (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  usuario_id uuid not null references auth.users (id) on delete cascade,
  papel text not null check (papel in ('dono', 'gestor', 'usuario')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  deleted_at timestamptz,
  unique (empresa_id, usuario_id)
);

create index idx_empresa_membros_empresa on public.empresa_membros (empresa_id);
create index idx_empresa_membros_usuario on public.empresa_membros (usuario_id);

create trigger trg_empresa_membros_updated_at
  before update on public.empresa_membros
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Funções de isolamento. SECURITY DEFINER é indispensável aqui: uma
-- policy de empresa_membros que consultasse empresa_membros direto
-- recairia em "infinite recursion detected in policy". Rodando como
-- o dono da função (que não sofre RLS), a consulta interna não dispara
-- a política de novo. Por isso: stable, search_path fixo vazio e
-- execução restrita a authenticated.
-- ---------------------------------------------------------------------
create or replace function public.is_membro(p_empresa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.empresa_membros m
    where m.empresa_id = p_empresa_id
      and m.usuario_id = (select auth.uid())
      and m.deleted_at is null
  );
$$;

revoke all on function public.is_membro(uuid) from public;
grant execute on function public.is_membro(uuid) to authenticated;

create or replace function public.tem_papel(p_empresa_id uuid, p_papel text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.empresa_membros m
    where m.empresa_id = p_empresa_id
      and m.usuario_id = (select auth.uid())
      and m.deleted_at is null
      and case p_papel
            when 'usuario' then m.papel in ('usuario', 'gestor', 'dono')
            when 'gestor' then m.papel in ('gestor', 'dono')
            when 'dono' then m.papel = 'dono'
            else false
          end
  );
$$;

revoke all on function public.tem_papel(uuid, text) from public;
grant execute on function public.tem_papel(uuid, text) to authenticated;

create or replace function public.carteira_compartilhada(p_empresa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select e.carteira_compartilhada from public.empresas e where e.id = p_empresa_id),
    false
  );
$$;

revoke all on function public.carteira_compartilhada(uuid) from public;
grant execute on function public.carteira_compartilhada(uuid) to authenticated;

-- Predicado padrão de acesso a registros com "responsável" (contatos,
-- vencimentos, negócios, tarefas — PRD §5.2): gestor/dono vê tudo,
-- carteira compartilhada abre para todo mundo, senão só o responsável.
create or replace function public.pode_acessar_responsavel(p_empresa_id uuid, p_responsavel_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_membro(p_empresa_id)
     and (
       public.tem_papel(p_empresa_id, 'gestor')
       or public.carteira_compartilhada(p_empresa_id)
       or p_responsavel_id = (select auth.uid())
     );
$$;

revoke all on function public.pode_acessar_responsavel(uuid, uuid) from public;
grant execute on function public.pode_acessar_responsavel(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- RLS de empresas e empresa_membros.
-- Não há policy de INSERT em empresas nesta migration: a criação da
-- empresa + primeiro membro "dono" é um caso de bootstrap (não existe
-- membro ainda para autorizar a si mesmo) e será resolvida por uma
-- função SECURITY DEFINER de onboarding na Fase 1B.
-- ---------------------------------------------------------------------
alter table public.empresas enable row level security;

create policy "empresas_select_membro"
  on public.empresas for select
  to authenticated
  using (public.is_membro(id));

create policy "empresas_update_dono"
  on public.empresas for update
  to authenticated
  using (public.tem_papel(id, 'dono'))
  with check (public.tem_papel(id, 'dono'));

alter table public.empresa_membros enable row level security;

create policy "empresa_membros_select_membro"
  on public.empresa_membros for select
  to authenticated
  using (public.is_membro(empresa_id));

create policy "empresa_membros_gestor_escreve"
  on public.empresa_membros for all
  to authenticated
  using (public.tem_papel(empresa_id, 'gestor'))
  with check (public.tem_papel(empresa_id, 'gestor'));
