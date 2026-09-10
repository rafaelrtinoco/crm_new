-- Núcleo do produto: contatos, vencimentos, funis e tarefas (PRD §6.2-6.6).
--
-- Duas famílias de RLS neste arquivo:
--   1) Registros com responsável (contatos, vencimentos, negócios, tarefas):
--      `pode_acessar_responsavel(empresa_id, responsavel_id)` — gestor/dono
--      vê tudo, carteira compartilhada abre pra todo mundo, senão só quem
--      é responsável. Mesmo predicado para leitura e escrita.
--   2) Configuração compartilhada (tags, funis, etapas, tipos de
--      vencimento, motivos de perda, campos personalizados): qualquer
--      membro lê, só gestor+ escreve — muda o funil da empresa inteira.

-- ---------------------------------------------------------------------
-- contatos
-- ---------------------------------------------------------------------
create table public.contatos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  nome text not null,
  status text not null default 'lead' check (status in ('lead', 'cliente', 'inativo')),
  temperatura text check (temperatura in ('quente', 'morno', 'frio')),
  origem text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  telefone text,
  email text,
  cpf_cnpj text,
  nascimento date,
  endereco jsonb,
  campos jsonb not null default '{}'::jsonb,
  responsavel_id uuid references auth.users (id),
  ultimo_contato_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  deleted_at timestamptz
);

create index idx_contatos_empresa on public.contatos (empresa_id);
create index idx_contatos_empresa_status on public.contatos (empresa_id, status);
create index idx_contatos_empresa_responsavel on public.contatos (empresa_id, responsavel_id);
create index idx_contatos_empresa_telefone on public.contatos (empresa_id, telefone);
create index idx_contatos_empresa_cpf_cnpj on public.contatos (empresa_id, cpf_cnpj);

create trigger trg_contatos_updated_at
  before update on public.contatos
  for each row execute function public.set_updated_at();

alter table public.contatos enable row level security;

create policy "contatos_por_responsavel"
  on public.contatos for all
  to authenticated
  using (public.pode_acessar_responsavel(empresa_id, responsavel_id))
  with check (public.pode_acessar_responsavel(empresa_id, responsavel_id));

-- ---------------------------------------------------------------------
-- campos_personalizados
-- ---------------------------------------------------------------------
create table public.campos_personalizados (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  entidade text not null check (entidade in ('contato', 'vencimento')),
  chave text not null,
  rotulo text not null,
  tipo text not null check (tipo in ('texto', 'numero', 'data', 'selecao', 'booleano')),
  opcoes jsonb,
  obrigatorio boolean not null default false,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  deleted_at timestamptz,
  unique (empresa_id, entidade, chave)
);

create index idx_campos_personalizados_empresa on public.campos_personalizados (empresa_id);

create trigger trg_campos_personalizados_updated_at
  before update on public.campos_personalizados
  for each row execute function public.set_updated_at();

alter table public.campos_personalizados enable row level security;

create policy "campos_personalizados_select_membro"
  on public.campos_personalizados for select
  to authenticated
  using (public.is_membro(empresa_id));

create policy "campos_personalizados_gestor_escreve"
  on public.campos_personalizados for all
  to authenticated
  using (public.tem_papel(empresa_id, 'gestor'))
  with check (public.tem_papel(empresa_id, 'gestor'));

-- ---------------------------------------------------------------------
-- tags — baixo risco, qualquer membro cria e usa no dia a dia.
-- ---------------------------------------------------------------------
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  nome text not null,
  cor text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  deleted_at timestamptz,
  unique (empresa_id, nome)
);

create index idx_tags_empresa on public.tags (empresa_id);

create trigger trg_tags_updated_at
  before update on public.tags
  for each row execute function public.set_updated_at();

alter table public.tags enable row level security;

create policy "tags_membro"
  on public.tags for all
  to authenticated
  using (public.is_membro(empresa_id))
  with check (public.is_membro(empresa_id));

-- ---------------------------------------------------------------------
-- contato_tags — acesso espelha o do contato (join table).
-- ---------------------------------------------------------------------
create table public.contato_tags (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  contato_id uuid not null references public.contatos (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  unique (contato_id, tag_id)
);

create index idx_contato_tags_empresa on public.contato_tags (empresa_id);
create index idx_contato_tags_contato on public.contato_tags (contato_id);
create index idx_contato_tags_tag on public.contato_tags (tag_id);

alter table public.contato_tags enable row level security;

create policy "contato_tags_via_contato"
  on public.contato_tags for all
  to authenticated
  using (
    exists (
      select 1 from public.contatos c
      where c.id = contato_id
        and public.pode_acessar_responsavel(c.empresa_id, c.responsavel_id)
    )
  )
  with check (
    exists (
      select 1 from public.contatos c
      where c.id = contato_id
        and public.pode_acessar_responsavel(c.empresa_id, c.responsavel_id)
    )
  );

-- ---------------------------------------------------------------------
-- vencimento_tipos
-- ---------------------------------------------------------------------
create table public.vencimento_tipos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  nome text not null,
  recorrencia_padrao text not null default 'anual' check (recorrencia_padrao in ('unica', 'mensal', 'anual', 'personalizada')),
  regua_sugerida jsonb not null default '[]'::jsonb,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  deleted_at timestamptz,
  unique (empresa_id, nome)
);

create index idx_vencimento_tipos_empresa on public.vencimento_tipos (empresa_id);

create trigger trg_vencimento_tipos_updated_at
  before update on public.vencimento_tipos
  for each row execute function public.set_updated_at();

alter table public.vencimento_tipos enable row level security;

create policy "vencimento_tipos_select_membro"
  on public.vencimento_tipos for select
  to authenticated
  using (public.is_membro(empresa_id));

create policy "vencimento_tipos_gestor_escreve"
  on public.vencimento_tipos for all
  to authenticated
  using (public.tem_papel(empresa_id, 'gestor'))
  with check (public.tem_papel(empresa_id, 'gestor'));

-- ---------------------------------------------------------------------
-- vencimentos — data de calendário (`date`), nunca timestamptz.
-- ---------------------------------------------------------------------
create table public.vencimentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  contato_id uuid not null references public.contatos (id) on delete cascade,
  vencimento_tipo_id uuid references public.vencimento_tipos (id),
  descricao text,
  data_vencimento date not null,
  valor numeric(12, 2),
  recorrencia text not null default 'anual' check (recorrencia in ('unica', 'mensal', 'anual', 'personalizada')),
  status text not null default 'pendente' check (
    status in ('pendente', 'em_regua', 'cliente_respondeu', 'em_negociacao', 'renovado', 'nao_renovado', 'cancelado')
  ),
  responsavel_id uuid references auth.users (id),
  campos jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  deleted_at timestamptz
);

create index idx_vencimentos_empresa on public.vencimentos (empresa_id);
create index idx_vencimentos_empresa_data on public.vencimentos (empresa_id, data_vencimento);
create index idx_vencimentos_empresa_status on public.vencimentos (empresa_id, status);
create index idx_vencimentos_contato on public.vencimentos (contato_id);

create trigger trg_vencimentos_updated_at
  before update on public.vencimentos
  for each row execute function public.set_updated_at();

alter table public.vencimentos enable row level security;

create policy "vencimentos_por_responsavel"
  on public.vencimentos for all
  to authenticated
  using (public.pode_acessar_responsavel(empresa_id, responsavel_id))
  with check (public.pode_acessar_responsavel(empresa_id, responsavel_id));

-- ---------------------------------------------------------------------
-- funis / etapas / motivos_perda
-- ---------------------------------------------------------------------
create table public.funis (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  nome text not null,
  tipo text not null default 'personalizado' check (tipo in ('venda_nova', 'renovacao', 'personalizado')),
  ordem integer not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  deleted_at timestamptz,
  unique (empresa_id, nome)
);

create index idx_funis_empresa on public.funis (empresa_id);

create trigger trg_funis_updated_at
  before update on public.funis
  for each row execute function public.set_updated_at();

alter table public.funis enable row level security;

create policy "funis_select_membro"
  on public.funis for select
  to authenticated
  using (public.is_membro(empresa_id));

create policy "funis_gestor_escreve"
  on public.funis for all
  to authenticated
  using (public.tem_papel(empresa_id, 'gestor'))
  with check (public.tem_papel(empresa_id, 'gestor'));

create table public.etapas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  funil_id uuid not null references public.funis (id) on delete cascade,
  nome text not null,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  deleted_at timestamptz,
  unique (funil_id, nome)
);

create index idx_etapas_empresa on public.etapas (empresa_id);
create index idx_etapas_funil on public.etapas (funil_id);

create trigger trg_etapas_updated_at
  before update on public.etapas
  for each row execute function public.set_updated_at();

alter table public.etapas enable row level security;

create policy "etapas_select_membro"
  on public.etapas for select
  to authenticated
  using (public.is_membro(empresa_id));

create policy "etapas_gestor_escreve"
  on public.etapas for all
  to authenticated
  using (public.tem_papel(empresa_id, 'gestor'))
  with check (public.tem_papel(empresa_id, 'gestor'));

create table public.motivos_perda (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  nome text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  deleted_at timestamptz,
  unique (empresa_id, nome)
);

create index idx_motivos_perda_empresa on public.motivos_perda (empresa_id);

create trigger trg_motivos_perda_updated_at
  before update on public.motivos_perda
  for each row execute function public.set_updated_at();

alter table public.motivos_perda enable row level security;

create policy "motivos_perda_select_membro"
  on public.motivos_perda for select
  to authenticated
  using (public.is_membro(empresa_id));

create policy "motivos_perda_gestor_escreve"
  on public.motivos_perda for all
  to authenticated
  using (public.tem_papel(empresa_id, 'gestor'))
  with check (public.tem_papel(empresa_id, 'gestor'));

-- ---------------------------------------------------------------------
-- negocios — próximo passo é obrigatório (PRD §6.5); perdido exige motivo.
-- ---------------------------------------------------------------------
create table public.negocios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  contato_id uuid not null references public.contatos (id) on delete cascade,
  funil_id uuid not null references public.funis (id),
  etapa_id uuid not null references public.etapas (id),
  valor_estimado numeric(12, 2),
  responsavel_id uuid references auth.users (id),
  previsao_fechamento date,
  proximo_passo_em date not null,
  proximo_passo_acao text not null,
  status text not null default 'aberto' check (status in ('aberto', 'ganho', 'perdido')),
  motivo_perda_id uuid references public.motivos_perda (id),
  reativar_em date,
  entrou_na_etapa_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  deleted_at timestamptz,
  constraint negocios_perdido_tem_motivo check (status <> 'perdido' or motivo_perda_id is not null)
);

create index idx_negocios_empresa on public.negocios (empresa_id);
create index idx_negocios_empresa_funil_etapa on public.negocios (empresa_id, funil_id, etapa_id);
create index idx_negocios_empresa_responsavel on public.negocios (empresa_id, responsavel_id);
create index idx_negocios_contato on public.negocios (contato_id);
create index idx_negocios_empresa_proximo_passo on public.negocios (empresa_id, proximo_passo_em);

create trigger trg_negocios_updated_at
  before update on public.negocios
  for each row execute function public.set_updated_at();

alter table public.negocios enable row level security;

create policy "negocios_por_responsavel"
  on public.negocios for all
  to authenticated
  using (public.pode_acessar_responsavel(empresa_id, responsavel_id))
  with check (public.pode_acessar_responsavel(empresa_id, responsavel_id));

-- ---------------------------------------------------------------------
-- atividades — timeline append-only (sem update/delete).
-- ---------------------------------------------------------------------
create table public.atividades (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  contato_id uuid references public.contatos (id) on delete cascade,
  negocio_id uuid references public.negocios (id) on delete cascade,
  tipo text not null check (
    tipo in ('mensagem', 'email', 'nota', 'ligacao', 'tarefa', 'mudanca_etapa', 'vencimento', 'resposta_campanha')
  ),
  conteudo jsonb not null default '{}'::jsonb,
  responsavel_id uuid references auth.users (id),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

create index idx_atividades_empresa on public.atividades (empresa_id);
create index idx_atividades_contato on public.atividades (contato_id);
create index idx_atividades_negocio on public.atividades (negocio_id);
create index idx_atividades_empresa_created on public.atividades (empresa_id, created_at desc);

alter table public.atividades enable row level security;

create policy "atividades_select"
  on public.atividades for select
  to authenticated
  using (
    public.is_membro(empresa_id)
    and (
      public.tem_papel(empresa_id, 'gestor')
      or public.carteira_compartilhada(empresa_id)
      or responsavel_id = (select auth.uid())
      or exists (
        select 1 from public.contatos c
        where c.id = contato_id and c.responsavel_id = (select auth.uid())
      )
    )
  );

create policy "atividades_insert"
  on public.atividades for insert
  to authenticated
  with check (
    public.is_membro(empresa_id)
    and (
      public.tem_papel(empresa_id, 'gestor')
      or responsavel_id = (select auth.uid())
      or exists (
        select 1 from public.contatos c
        where c.id = contato_id and c.responsavel_id = (select auth.uid())
      )
    )
  );

-- ---------------------------------------------------------------------
-- tarefas
-- ---------------------------------------------------------------------
create table public.tarefas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  contato_id uuid references public.contatos (id) on delete cascade,
  negocio_id uuid references public.negocios (id) on delete cascade,
  tipo text not null check (tipo in ('ligar', 'whatsapp', 'email', 'reuniao', 'outro')),
  titulo text not null,
  data_vencimento date not null,
  responsavel_id uuid references auth.users (id),
  concluida_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  deleted_at timestamptz
);

create index idx_tarefas_empresa on public.tarefas (empresa_id);
create index idx_tarefas_empresa_responsavel on public.tarefas (empresa_id, responsavel_id);
create index idx_tarefas_empresa_data on public.tarefas (empresa_id, data_vencimento);
create index idx_tarefas_contato on public.tarefas (contato_id);
create index idx_tarefas_negocio on public.tarefas (negocio_id);

create trigger trg_tarefas_updated_at
  before update on public.tarefas
  for each row execute function public.set_updated_at();

alter table public.tarefas enable row level security;

create policy "tarefas_por_responsavel"
  on public.tarefas for all
  to authenticated
  using (public.pode_acessar_responsavel(empresa_id, responsavel_id))
  with check (public.pode_acessar_responsavel(empresa_id, responsavel_id));
