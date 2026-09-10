-- Templates de nicho: dado global (sem empresa_id), somente leitura para
-- usuários comuns (PRD §3.2, .claude/rules/Supabase.md). A função que aplica
-- o template na empresa (aplicar_template) é entregue na Fase 1B, junto do
-- onboarding — aqui só o catálogo de dados.

create table public.nicho_templates (
  id uuid primary key default gen_random_uuid(),
  nicho text not null unique,
  nome_exibicao text not null,
  vocabulario jsonb not null default '{}'::jsonb,
  campos_personalizados jsonb not null default '[]'::jsonb,
  vencimento_tipos jsonb not null default '[]'::jsonb,
  funis jsonb not null default '[]'::jsonb,
  motivos_perda jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  cadencias jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_nicho_templates_updated_at
  before update on public.nicho_templates
  for each row execute function public.set_updated_at();

alter table public.nicho_templates enable row level security;

-- Exceção deliberada à regra "nunca using (true)": esta tabela não tem
-- empresa_id por natureza — é catálogo global e somente leitura para
-- usuários comuns. Escrita só via migration/seed (service_role).
create policy "nicho_templates_select_authenticated"
  on public.nicho_templates for select
  to authenticated
  using (true);
