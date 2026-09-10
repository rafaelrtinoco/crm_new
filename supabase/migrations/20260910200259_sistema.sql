-- Sistema: consentimento LGPD por contato e log de auditoria (PRD §5.4).

create table public.consentimentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  contato_id uuid not null references public.contatos (id) on delete cascade,
  finalidade text not null check (finalidade in ('atendimento', 'marketing')),
  concedido boolean not null,
  canal text not null,
  origem text,
  registrado_em timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

create index idx_consentimentos_empresa on public.consentimentos (empresa_id);
create index idx_consentimentos_contato on public.consentimentos (contato_id);
create index idx_consentimentos_contato_finalidade on public.consentimentos (empresa_id, contato_id, finalidade);

-- Histórico append-only: o estado atual é a linha mais recente por
-- contato + finalidade. Sem update/delete — o worker de envio (Fase 2)
-- sempre olha a última linha.
alter table public.consentimentos enable row level security;

create policy "consentimentos_select"
  on public.consentimentos for select
  to authenticated
  using (
    public.is_membro(empresa_id)
    and (
      public.tem_papel(empresa_id, 'gestor')
      or public.carteira_compartilhada(empresa_id)
      or exists (
        select 1 from public.contatos c
        where c.id = contato_id and c.responsavel_id = (select auth.uid())
      )
    )
  );

create policy "consentimentos_insert"
  on public.consentimentos for insert
  to authenticated
  with check (
    public.is_membro(empresa_id)
    and exists (
      select 1 from public.contatos c
      where c.id = contato_id
        and public.pode_acessar_responsavel(c.empresa_id, c.responsavel_id)
    )
  );

-- ---------------------------------------------------------------------
-- audit_log — ações sensíveis (exportações, exclusões em massa, acessos
-- de suporte). Append-only por natureza: revoke explícito de
-- update/delete além do RLS, para reforçar em auditoria de segurança.
-- Inserção normal é via service_role (Edge Functions); não há policy
-- de insert para `authenticated` nesta migration.
-- ---------------------------------------------------------------------
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas (id) on delete cascade,
  usuario_id uuid references auth.users (id),
  acao text not null,
  entidade text not null,
  entidade_id uuid,
  detalhes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_audit_log_empresa on public.audit_log (empresa_id);
create index idx_audit_log_empresa_created on public.audit_log (empresa_id, created_at desc);

alter table public.audit_log enable row level security;

revoke update, delete on public.audit_log from authenticated;

create policy "audit_log_select_gestor"
  on public.audit_log for select
  to authenticated
  using (empresa_id is not null and public.tem_papel(empresa_id, 'gestor'));
