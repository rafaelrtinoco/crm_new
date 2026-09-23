-- Fase 3 recortada, módulo 3/5: captura de leads (PRD §6.10,
-- docs/fase3/SPEC-captura-leads.md). Três portas de entrada que não
-- existiam (hoje só há criação manual e importação em lote): formulário
-- embutível, página de captura pública com a marca da empresa, e
-- webhook genérico pra ferramentas de terceiro. As três convergem em
-- `receber_lead`, que resolve `responsavel_id` (fixo ou rodízio) e
-- insere o contato como `lead` — o alerta ao responsável já existe
-- (`notificar_lead_novo()`, trigger de 1D-5), nada novo precisa disso.
--
-- Correções aplicadas na implementação (spec original, 2026-09-16, já
-- tinha 2 correções de FK composta/nav aplicadas em 2026-09-23 antes
-- deste código — ver seção própria em SPEC-captura-leads.md — e mais
-- 3 encontradas só ao escrever as funções):
--
-- 1. `obter_pagina_captura_publica` vira `security definer`, não
--    `invoker` como o spec propunha. O spec assumia que não precisava
--    "bypassar nada", mas `anon` não tem NENHUMA policy de select em
--    `paginas_captura`/`empresas` (só `to authenticated`) — invoker
--    rodando como `anon` devolveria sempre zero linhas pra um visitante
--    de verdade. A função limita exposição pelas colunas que retorna
--    (nunca a linha inteira), não pela RLS.
-- 2. `obter_formulario_publico` é função nova, ausente do spec original.
--    A rota `/f/:empresaSlug/:formularioId` (formulário embutível) tinha
--    função pública equivalente esquecida — só `/p/...` (página
--    completa) tinha `obter_pagina_captura_publica`. Mesmo raciocínio
--    da correção 1: `security definer`, expõe só nome/campos.
-- 3. `token_hash` nunca exposto por REVOKE de coluna, não só por
--    convenção de view. O spec sugeria uma view `integracoes_publico`
--    "mesmo padrão de `membros_empresa`" — mas `membros_empresa` existe
--    pra JUNTAR duas tabelas sem FK direta, não pra esconder coluna; uma
--    view não impede consulta direta na tabela base se a RLS de select
--    permitir. Aqui a tabela em si nega SELECT da coluna via GRANT
--    column-level — vale mesmo contra uma query REST direta com
--    `select=token_hash`, não só contra quem usa a tela certa.
-- 4. CHECK novo: `distribuicao_tipo='fixo'` exige `responsavel_fixo_id`
--    preenchido, em `formularios` e `integracoes`. Sem isso, um
--    formulário configurado como "fixo" sem responsável escolhido
--    criaria leads silenciosamente sem ninguém dono — `receber_lead`
--    não tem como adivinhar; melhor rejeitar na configuração.
-- 5. `definir_slug_empresa` é função nova, ausente do spec. Achada só ao
--    testar manualmente: a única policy de UPDATE em `empresas`
--    (`empresas_update_dono`, de antes deste módulo) é `dono`-only —
--    um gestor não conseguiria configurar o `slug` da própria empresa
--    (UPDATE silenciosamente afeta zero linhas sob RLS, sem erro).
--    Em vez de afrouxar a policy de `empresas` inteira pra gestor+
--    (ela também cobre `vocabulario`/`carteira_compartilhada`, mais
--    sensíveis), uma função dedicada expõe só a escrita de `slug`.
-- 6. `submeter_formulario` passou a checar `deleted_at is null`, não só
--    `ativo` (achado no security-check). "Excluir" um formulário no
--    app é soft delete (`deleted_at`) — sem essa checagem, um
--    formulário excluído sumia da lista autenticada e do embed público
--    (`obter_formulario_publico` já filtrava certo), mas continuava
--    aceitando submissão pra quem já tivesse o `formulario_id` salvo,
--    criando lead mesmo depois de "excluído".
--
-- Nenhuma dessas muda o modelo de dados nem as decisões fechadas com
-- o usuário (webhook via RPC sem Edge Function; sem anti-spam nesta
-- fase) — são gaps de execução, mesmo espírito das correções dos
-- módulos 1/2/4.

alter table public.empresas add column slug text unique;

-- ---------------------------------------------------------------------
-- definir_slug_empresa — correção 5, ver header. security definer:
-- authenticated não tem UPDATE em `empresas` pra gestor (só dono).
-- ---------------------------------------------------------------------
create or replace function public.definir_slug_empresa(p_empresa_id uuid, p_slug text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.tem_papel(p_empresa_id, 'gestor') then
    raise exception 'Sem permissão para configurar esta empresa';
  end if;

  update public.empresas set slug = p_slug where id = p_empresa_id;
end;
$$;

revoke all on function public.definir_slug_empresa(uuid, text) from public;
grant execute on function public.definir_slug_empresa(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- formularios
-- ---------------------------------------------------------------------
create table public.formularios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  nome text not null,
  campos jsonb not null default '["nome","telefone","email"]'::jsonb,
  distribuicao_tipo text not null default 'rodizio' check (distribuicao_tipo in ('rodizio', 'fixo')),
  responsavel_fixo_id uuid,
  proximo_indice_rodizio integer not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  deleted_at timestamptz,
  constraint formularios_empresa_responsavel_fixo_id_fkey
    foreign key (empresa_id, responsavel_fixo_id) references public.empresa_membros (empresa_id, usuario_id),
  constraint formularios_distribuicao_fixo_tem_responsavel
    check (distribuicao_tipo <> 'fixo' or responsavel_fixo_id is not null),
  unique (empresa_id, id)
);

create index idx_formularios_empresa on public.formularios (empresa_id);

create trigger trg_formularios_updated_at
  before update on public.formularios
  for each row execute function public.set_updated_at();

alter table public.formularios enable row level security;

create policy "formularios_select_membro"
  on public.formularios for select
  to authenticated
  using (public.is_membro(empresa_id));

create policy "formularios_gestor_escreve"
  on public.formularios for all
  to authenticated
  using (public.tem_papel(empresa_id, 'gestor'))
  with check (public.tem_papel(empresa_id, 'gestor'));

-- ---------------------------------------------------------------------
-- paginas_captura
-- ---------------------------------------------------------------------
create table public.paginas_captura (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  slug text not null,
  titulo text not null,
  texto text,
  imagem_url text,
  formulario_id uuid,
  whatsapp_numero text,
  whatsapp_mensagem text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  deleted_at timestamptz,
  constraint paginas_captura_empresa_formulario_id_fkey
    foreign key (empresa_id, formulario_id) references public.formularios (empresa_id, id),
  unique (empresa_id, slug)
);

create index idx_paginas_captura_empresa on public.paginas_captura (empresa_id);

create trigger trg_paginas_captura_updated_at
  before update on public.paginas_captura
  for each row execute function public.set_updated_at();

alter table public.paginas_captura enable row level security;

create policy "paginas_captura_select_membro"
  on public.paginas_captura for select
  to authenticated
  using (public.is_membro(empresa_id));

create policy "paginas_captura_gestor_escreve"
  on public.paginas_captura for all
  to authenticated
  using (public.tem_papel(empresa_id, 'gestor'))
  with check (public.tem_papel(empresa_id, 'gestor'));

-- ---------------------------------------------------------------------
-- integracoes — token_hash nunca é legível por `authenticated`, nem
-- gestor (correção 3, ver header). Toda escrita passa por
-- criar_integracao/revogar_integracao (security definer) — sem policy
-- de insert/update/delete pra authenticated de propósito, o token não
-- pode nascer de um INSERT direto do cliente.
-- ---------------------------------------------------------------------
create table public.integracoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  tipo text not null check (tipo in ('webhook_generico')),
  nome text not null,
  token_hash text not null,
  distribuicao_tipo text not null default 'rodizio' check (distribuicao_tipo in ('rodizio', 'fixo')),
  responsavel_fixo_id uuid,
  proximo_indice_rodizio integer not null default 0,
  ativo boolean not null default true,
  ultimo_uso_em timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  revogado_em timestamptz,
  constraint integracoes_empresa_responsavel_fixo_id_fkey
    foreign key (empresa_id, responsavel_fixo_id) references public.empresa_membros (empresa_id, usuario_id),
  constraint integracoes_distribuicao_fixo_tem_responsavel
    check (distribuicao_tipo <> 'fixo' or responsavel_fixo_id is not null)
);

create index idx_integracoes_empresa on public.integracoes (empresa_id);
create index idx_integracoes_token_hash on public.integracoes (token_hash) where ativo and revogado_em is null;

alter table public.integracoes enable row level security;

create policy "integracoes_select_membro"
  on public.integracoes for select
  to authenticated
  using (public.is_membro(empresa_id));

revoke insert, update, delete on public.integracoes from authenticated;

-- Column-level: authenticated nunca lê token_hash, nem gestor — mesmo
-- via query REST direta com select=token_hash (não só "a tela não
-- mostra"). O revoke/grant de coluna é reforço além da RLS de linha.
revoke select on public.integracoes from authenticated;
grant select (
  id, empresa_id, tipo, nome, distribuicao_tipo, responsavel_fixo_id,
  proximo_indice_rodizio, ativo, ultimo_uso_em, created_at, created_by, revogado_em
) on public.integracoes to authenticated;

-- ---------------------------------------------------------------------
-- receber_lead — função interna compartilhada pelos dois pontos de
-- entrada autenticados-por-token abaixo. Resolve responsavel_id (fixo
-- ou o próximo do rodízio, a partir do índice que o chamador já leu) e
-- insere o contato. Não mexe em proximo_indice_rodizio — isso é
-- responsabilidade de quem chama (cada um sabe se está em formularios
-- ou integracoes).
-- ---------------------------------------------------------------------
create or replace function public.receber_lead(
  p_empresa_id uuid,
  p_nome text,
  p_telefone text,
  p_email text,
  p_origem text,
  p_utm jsonb,
  p_campos jsonb,
  p_distribuicao_tipo text,
  p_responsavel_fixo_id uuid,
  p_proximo_indice_rodizio integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total_membros integer;
  v_responsavel_id uuid;
  v_contato_id uuid;
begin
  if coalesce(p_nome, '') = '' then
    raise exception 'Nome é obrigatório';
  end if;

  if p_distribuicao_tipo = 'fixo' then
    v_responsavel_id := p_responsavel_fixo_id;
  else
    select count(*) into v_total_membros
    from public.empresa_membros
    where empresa_id = p_empresa_id and deleted_at is null;

    if v_total_membros > 0 then
      select usuario_id into v_responsavel_id
      from public.empresa_membros
      where empresa_id = p_empresa_id and deleted_at is null
      order by created_at, usuario_id
      offset (p_proximo_indice_rodizio % v_total_membros)
      limit 1;
    end if;
    -- v_total_membros = 0: v_responsavel_id fica null, notificar_lead_novo()
    -- já trata isso (avisa dono/gestor em vez de um responsável específico).
  end if;

  insert into public.contatos (
    empresa_id, nome, telefone, email, status, origem,
    utm_source, utm_medium, utm_campaign, utm_term, utm_content,
    campos, responsavel_id
  )
  values (
    p_empresa_id, p_nome, nullif(p_telefone, ''), nullif(p_email, ''), 'lead', p_origem,
    p_utm ->> 'utm_source', p_utm ->> 'utm_medium', p_utm ->> 'utm_campaign',
    p_utm ->> 'utm_term', p_utm ->> 'utm_content',
    coalesce(p_campos, '{}'::jsonb), v_responsavel_id
  )
  returning id into v_contato_id;

  return v_contato_id;
end;
$$;

revoke all on function public.receber_lead(uuid, text, text, text, text, jsonb, jsonb, text, uuid, integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- submeter_formulario — RPC pública (anon). `for update` no formulário
-- serializa dois envios concorrentes do mesmo formulário, pro rodízio
-- não pular/repetir índice sob corrida.
-- ---------------------------------------------------------------------
create or replace function public.submeter_formulario(
  p_formulario_id uuid,
  p_dados jsonb,
  p_utm jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_formulario public.formularios;
begin
  select * into v_formulario from public.formularios where id = p_formulario_id for update;
  if not found or not v_formulario.ativo or v_formulario.deleted_at is not null then
    raise exception 'Formulário não encontrado ou inativo';
  end if;

  perform public.receber_lead(
    v_formulario.empresa_id,
    p_dados ->> 'nome',
    p_dados ->> 'telefone',
    p_dados ->> 'email',
    'formulario',
    p_utm,
    p_dados - 'nome' - 'telefone' - 'email',
    v_formulario.distribuicao_tipo,
    v_formulario.responsavel_fixo_id,
    v_formulario.proximo_indice_rodizio
  );

  if v_formulario.distribuicao_tipo = 'rodizio' then
    update public.formularios
    set proximo_indice_rodizio = proximo_indice_rodizio + 1
    where id = p_formulario_id;
  end if;
end;
$$;

revoke all on function public.submeter_formulario(uuid, jsonb, jsonb) from public;
grant execute on function public.submeter_formulario(uuid, jsonb, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------
-- receber_lead_webhook — RPC pública (anon). Token errado/revogado é
-- 42501 explícito (não silêncio), é o único jeito de quem integrou
-- errado perceber o problema.
-- ---------------------------------------------------------------------
create or replace function public.receber_lead_webhook(
  p_token text,
  p_nome text,
  p_telefone text default null,
  p_email text default null,
  p_campos jsonb default '{}'::jsonb,
  p_utm jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_integracao public.integracoes;
  v_hash text;
begin
  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  select * into v_integracao
  from public.integracoes
  where token_hash = v_hash and tipo = 'webhook_generico' and ativo and revogado_em is null
  for update;

  if not found then
    raise exception 'Token inválido ou revogado' using errcode = '42501';
  end if;

  perform public.receber_lead(
    v_integracao.empresa_id, p_nome, p_telefone, p_email, 'webhook',
    p_utm, p_campos, v_integracao.distribuicao_tipo, v_integracao.responsavel_fixo_id,
    v_integracao.proximo_indice_rodizio
  );

  update public.integracoes
  set ultimo_uso_em = now(),
      proximo_indice_rodizio = case
        when distribuicao_tipo = 'rodizio' then proximo_indice_rodizio + 1
        else proximo_indice_rodizio
      end
  where id = v_integracao.id;
end;
$$;

revoke all on function public.receber_lead_webhook(text, text, text, text, jsonb, jsonb) from public;
grant execute on function public.receber_lead_webhook(text, text, text, text, jsonb, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------
-- criar_integracao / revogar_integracao — únicos caminhos de escrita
-- em `integracoes`. O token em claro só existe no retorno de
-- criar_integracao — depois disso, só o hash.
-- ---------------------------------------------------------------------
create or replace function public.criar_integracao(
  p_empresa_id uuid,
  p_nome text,
  p_distribuicao_tipo text default 'rodizio',
  p_responsavel_fixo_id uuid default null
)
returns table (id uuid, token text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
  v_id uuid;
begin
  if not public.tem_papel(p_empresa_id, 'gestor') then
    raise exception 'Sem permissão para criar integração';
  end if;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  insert into public.integracoes (
    empresa_id, tipo, nome, token_hash, distribuicao_tipo, responsavel_fixo_id, created_by
  )
  values (
    p_empresa_id, 'webhook_generico', p_nome, encode(extensions.digest(v_token, 'sha256'), 'hex'),
    p_distribuicao_tipo, p_responsavel_fixo_id, (select auth.uid())
  )
  returning integracoes.id into v_id;

  return query select v_id, v_token;
end;
$$;

revoke all on function public.criar_integracao(uuid, text, text, uuid) from public;
grant execute on function public.criar_integracao(uuid, text, text, uuid) to authenticated;

create or replace function public.revogar_integracao(p_integracao_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa_id uuid;
begin
  select empresa_id into v_empresa_id from public.integracoes where id = p_integracao_id;
  if not found then
    raise exception 'Integração não encontrada';
  end if;
  if not public.tem_papel(v_empresa_id, 'gestor') then
    raise exception 'Sem permissão para revogar esta integração';
  end if;

  update public.integracoes set ativo = false, revogado_em = now() where id = p_integracao_id;
end;
$$;

revoke all on function public.revogar_integracao(uuid) from public;
grant execute on function public.revogar_integracao(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- obter_pagina_captura_publica / obter_formulario_publico — únicas
-- janelas de leitura pública (anon) pro núcleo. security definer de
-- propósito (correções 1/2, ver header) — a limitação de exposição é
-- pelas colunas retornadas, nunca a linha inteira de tabela nenhuma.
-- ---------------------------------------------------------------------
create or replace function public.obter_pagina_captura_publica(p_empresa_slug text, p_pagina_slug text)
returns table (
  formulario_id uuid,
  titulo text,
  texto text,
  imagem_url text,
  whatsapp_numero text,
  whatsapp_mensagem text,
  empresa_nome text,
  empresa_logo_url text,
  empresa_cor_primaria text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    pc.formulario_id, pc.titulo, pc.texto, pc.imagem_url, pc.whatsapp_numero, pc.whatsapp_mensagem,
    e.nome, e.logo_url, e.cor_primaria
  from public.paginas_captura pc
  join public.empresas e on e.id = pc.empresa_id
  where e.slug = p_empresa_slug and pc.slug = p_pagina_slug and pc.ativo and pc.deleted_at is null;
$$;

revoke all on function public.obter_pagina_captura_publica(text, text) from public;
grant execute on function public.obter_pagina_captura_publica(text, text) to anon, authenticated;

create or replace function public.obter_formulario_publico(p_formulario_id uuid)
returns table (nome text, campos jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select f.nome, f.campos
  from public.formularios f
  where f.id = p_formulario_id and f.ativo and f.deleted_at is null;
$$;

revoke all on function public.obter_formulario_publico(uuid) from public;
grant execute on function public.obter_formulario_publico(uuid) to anon, authenticated;
