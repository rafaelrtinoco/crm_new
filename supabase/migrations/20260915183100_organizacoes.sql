-- Redesenho do núcleo (parte 2/6): organizações — a pessoa jurídica
-- cliente (ex.: a empresa que contratou o seguro empresarial), distinta
-- de `empresas` (que é o tenant/assinante do Facility). Um contato pode
-- continuar avulso (pessoa física, maioria no nicho de corretores) ou
-- pertencer a uma organização. Mesmo padrão de `contatos`: dono do
-- registro é `responsavel_id`, RLS via `pode_acessar_responsavel`.
create table public.organizacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  nome text not null,
  cnpj text,
  telefone text,
  site text,
  endereco jsonb,
  campos jsonb not null default '{}'::jsonb,
  responsavel_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  deleted_at timestamptz,
  constraint uq_organizacoes_empresa_id unique (empresa_id, id),
  constraint organizacoes_empresa_responsavel_id_fkey
    foreign key (empresa_id, responsavel_id) references public.empresa_membros (empresa_id, usuario_id)
);

create index idx_organizacoes_empresa on public.organizacoes (empresa_id);
create index idx_organizacoes_empresa_responsavel on public.organizacoes (empresa_id, responsavel_id);
create index idx_organizacoes_empresa_cnpj on public.organizacoes (empresa_id, cnpj);

create trigger trg_organizacoes_updated_at
  before update on public.organizacoes
  for each row execute function public.set_updated_at();

alter table public.organizacoes enable row level security;

-- Policy simples aqui (igual ao padrão de `contatos` até agora); a
-- migration de soft delete substitui por 4 policies separadas
-- (select/insert/update/delete) — não dá pra colocar `deleted_at is
-- null` só no USING de uma FOR ALL e chamar de resolvido: o Postgres
-- reaplica a USING da policy de SELECT contra a linha nova em todo
-- UPDATE, então a própria escrita do soft delete se autobloquearia.
-- Ver o comentário longo em `soft_delete_e_dedup.sql`.
create policy "organizacoes_por_responsavel"
  on public.organizacoes for all
  to authenticated
  using (public.pode_acessar_responsavel(empresa_id, responsavel_id))
  with check (public.pode_acessar_responsavel(empresa_id, responsavel_id));

-- ---------------------------------------------------------------------
-- Contato e negócio passam a poder pertencer a uma organização. Nullable:
-- pessoa física avulsa continua um contato sem organização nenhuma.
-- ---------------------------------------------------------------------
alter table public.contatos add column organizacao_id uuid;
alter table public.contatos
  add constraint contatos_empresa_organizacao_id_fkey
    foreign key (empresa_id, organizacao_id) references public.organizacoes (empresa_id, id);
create index idx_contatos_empresa_organizacao on public.contatos (empresa_id, organizacao_id);

alter table public.negocios add column organizacao_id uuid;
alter table public.negocios
  add constraint negocios_empresa_organizacao_id_fkey
    foreign key (empresa_id, organizacao_id) references public.organizacoes (empresa_id, id);
create index idx_negocios_empresa_organizacao on public.negocios (empresa_id, organizacao_id);

-- Campos personalizados agora também cabem em organizações e negócios
-- (antes só contato/vencimento — PRD não pedia, mas é o gap natural pra
-- um CRM B2B: nem todo campo específico do nicho é sobre a pessoa).
alter table public.campos_personalizados drop constraint campos_personalizados_entidade_check;
alter table public.campos_personalizados
  add constraint campos_personalizados_entidade_check
    check (entidade in ('contato', 'vencimento', 'organizacao', 'negocio'));
