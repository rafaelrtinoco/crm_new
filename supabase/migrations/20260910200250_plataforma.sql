-- Plataforma: convites de equipe e backoffice interno (PRD §5.3).

create table public.convites (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  email text not null,
  papel text not null check (papel in ('dono', 'gestor', 'usuario')),
  token uuid not null default gen_random_uuid(),
  expira_em timestamptz not null default (now() + interval '7 days'),
  status text not null default 'pendente' check (status in ('pendente', 'aceito', 'expirado', 'cancelado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  deleted_at timestamptz,
  unique (token)
);

-- Só um convite pendente por e-mail dentro da mesma empresa.
create unique index uq_convites_pendente on public.convites (empresa_id, email) where status = 'pendente';
create index idx_convites_empresa on public.convites (empresa_id);

create trigger trg_convites_updated_at
  before update on public.convites
  for each row execute function public.set_updated_at();

alter table public.convites enable row level security;

-- Só gestor+ convida e gerencia convites (PRD §5.2).
create policy "convites_gestor"
  on public.convites for all
  to authenticated
  using (public.tem_papel(empresa_id, 'gestor'))
  with check (public.tem_papel(empresa_id, 'gestor'));

-- ---------------------------------------------------------------------
-- plataforma_admins — backoffice interno (/admin). Não tem empresa_id
-- de propósito: é papel de plataforma, não de tenant. Provisionado só
-- via service_role; não há policy de escrita para `authenticated`.
-- ---------------------------------------------------------------------
create table public.plataforma_admins (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null unique references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

alter table public.plataforma_admins enable row level security;

create policy "plataforma_admins_select_proprio"
  on public.plataforma_admins for select
  to authenticated
  using (usuario_id = (select auth.uid()));
