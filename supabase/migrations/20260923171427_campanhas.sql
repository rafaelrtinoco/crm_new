-- Fase 3 recortada, módulo 4/5: campanhas (PRD §6.9, docs/fase3/SPEC-campanhas.md).
-- Disparo de mensagens em massa (e-mail ou WhatsApp) pra um segmento salvo,
-- com prévia, agendamento e métricas. Consumidor de `fila-envios` (todo
-- envio sai por `enfileirar_envio`, nunca grava direto em `fila_envios`) e
-- de `segmentos` (todo público-alvo vem de `avaliar_segmento`/
-- `prever_contato_segmento`) — nenhuma das duas é alterada aqui.
--
-- Correções aplicadas na implementação (spec original em SPEC-campanhas.md
-- não previa):
--
-- 1. Impersonação no disparo agendado. `disparar_campanhas_agendadas` roda
--    via pg_cron, sem JWT/sessão — mas `enfileirar_envio` (fila-envios)
--    autoriza cada contato chamando `pode_acessar_responsavel`, que lê
--    `auth.uid()`. Sem sessão, `auth.uid()` é null e TODO disparo agendado
--    falharia com "sem permissão". Em vez de mexer em `enfileirar_envio`
--    (módulo já entregue e testado), `disparar_campanhas_agendadas`
--    impersona — só durante a chamada, via `set_config('request.jwt.claims', ...)`
--    — quem criou a campanha: essa pessoa já precisou ser gestor+ pra criá-la
--    (RLS de `campanhas`), então é a autorização correta pro disparo que ela
--    mesma agendou.
-- 2. `campanha_envios.fila_envios_id` virou NULLABLE (spec original pedia
--    NOT NULL, "1:1"). Necessário pro caso "variável sem valor bloqueia só
--    aquele contato" (spec, Boundaries): esse bloqueio acontece ANTES de
--    chamar `enfileirar_envio` (o conteúdo nem existe resolvido ainda), não
--    depois — não há linha de `fila_envios` pra apontar. Adicionado
--    `motivo_bloqueio` na própria tabela pra esse caso, com CHECK garantindo
--    exatamente um dos dois preenchido (`fila_envios_id` OU `motivo_bloqueio`,
--    nunca os dois nem nenhum).
-- 3. `disparar_campanha` processa cada contato num bloco `exception when
--    others` próprio (mesmo padrão de `processar_fila_envios`): um erro num
--    contato (ex.: `enfileirar_envio` rejeitar por falta de permissão, no
--    caso raro do criador ter saído da empresa) vira uma linha bloqueada
--    em `campanha_envios`, não aborta a campanha inteira.
-- 4. `cron.schedule('processar-fila-envios', ...)` é re-registrado (mesmo
--    nome — `cron.schedule` faz upsert), já que a migration original de
--    fila-envios não pode ser editada. Ordem: `disparar_campanhas_agendadas`
--    primeiro (pra mensagens recém-enfileiradas entrarem na mesma passada de
--    `processar_fila_envios`), depois o worker, depois `atualizar_status_campanhas`.
-- 5. Variáveis de template ficam num vocabulário fechado
--    (`nome`, `primeiro_nome`, `email`, `telefone`, resolvidos de
--    `contatos`) — o PRD não especifica a lista; refletido também num CHECK
--    em `templates_mensagem.variaveis`, mesmo padrão de
--    `validar_criterios_segmento` em segmentos.
-- 6. `fila_envios` ganha `unique (empresa_id, id)`. A migration original
--    (módulo 1/5) não previu FK composta apontando pra ela — só
--    `campanhas` (módulo 4/5) precisa disso agora, então entra aqui, não
--    lá (não se edita migration já aplicada).

alter table public.fila_envios add constraint uq_fila_envios_empresa_id unique (empresa_id, id);

-- ---------------------------------------------------------------------
-- validar_variaveis_campanha — vocabulário fechado de variáveis
-- suportadas em `templates_mensagem.variaveis` (ver correção 5 acima).
-- ---------------------------------------------------------------------
create or replace function public.validar_variaveis_campanha(p_variaveis jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    bool_and(valor in ('nome', 'primeiro_nome', 'email', 'telefone')),
    true
  )
  from jsonb_array_elements_text(coalesce(p_variaveis, '[]'::jsonb)) as valor;
$$;

-- ---------------------------------------------------------------------
-- templates_mensagem
-- ---------------------------------------------------------------------
create table public.templates_mensagem (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  nome text not null,
  canal text not null check (canal in ('whatsapp', 'email')),
  conteudo text not null, -- com {{variavel}}; pra email, corpo-base fora do editor de blocos (ver campanhas.blocos)
  variaveis jsonb not null default '[]'::jsonb
    check (public.validar_variaveis_campanha(variaveis)),
  status text not null default 'rascunho' check (status in ('rascunho', 'aprovado')), -- 'aprovado' simula aprovação Meta no mock
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  deleted_at timestamptz,
  unique (empresa_id, id) -- alvo de FK composta (ADR 0003)
);

create index idx_templates_mensagem_empresa on public.templates_mensagem (empresa_id);

create trigger trg_templates_mensagem_updated_at
  before update on public.templates_mensagem
  for each row execute function public.set_updated_at();

alter table public.templates_mensagem enable row level security;

-- Padrão "configuração compartilhada" (igual segmentos/funis): qualquer
-- membro lê, só gestor+ escreve — sem deleted_at is null na policy (mesma
-- armadilha de auto-bloqueio de soft_delete_e_dedup.sql); filtro fica no
-- cliente.
create policy "templates_mensagem_select_membro"
  on public.templates_mensagem for select
  to authenticated
  using (public.is_membro(empresa_id));

create policy "templates_mensagem_gestor_escreve"
  on public.templates_mensagem for all
  to authenticated
  using (public.tem_papel(empresa_id, 'gestor'))
  with check (public.tem_papel(empresa_id, 'gestor'));

-- ---------------------------------------------------------------------
-- campanhas
-- ---------------------------------------------------------------------
create table public.campanhas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  nome text not null,
  canal text not null check (canal in ('whatsapp', 'email')),
  segmento_id uuid not null,
  template_id uuid, -- obrigatório se canal='whatsapp'
  assunto text, -- só email
  blocos jsonb not null default '[]'::jsonb, -- só email: [{tipo:'texto'|'imagem', conteudo:'...'}]
  status text not null default 'rascunho' check (
    status in ('rascunho', 'agendada', 'enviando', 'concluida', 'cancelada')
  ),
  agendado_para timestamptz, -- null = dispara na confirmação, sem esperar cron
  disparada_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  deleted_at timestamptz,
  constraint campanhas_empresa_segmento_id_fkey
    foreign key (empresa_id, segmento_id) references public.segmentos (empresa_id, id),
  constraint campanhas_empresa_template_id_fkey
    foreign key (empresa_id, template_id) references public.templates_mensagem (empresa_id, id),
  unique (empresa_id, id), -- alvo de FK composta (relatorios-origem, módulo seguinte)
  check (canal <> 'whatsapp' or template_id is not null)
);

create index idx_campanhas_empresa on public.campanhas (empresa_id);
create index idx_campanhas_empresa_status on public.campanhas (empresa_id, status);

create trigger trg_campanhas_updated_at
  before update on public.campanhas
  for each row execute function public.set_updated_at();

alter table public.campanhas enable row level security;

create policy "campanhas_select_membro"
  on public.campanhas for select
  to authenticated
  using (public.is_membro(empresa_id));

-- Disparar campanha em massa é ação de risco equivalente a mudar
-- configuração da empresa inteira — mesmo grupo de acesso de segmentos.
--
-- INSERT é policy própria (não "for all"), exigindo created_by = quem
-- está inserindo (padrão de importacoes_insert_proprio, importacoes.sql)
-- — correção pós security-check: `created_by` aqui não é só rótulo de
-- auditoria como em outras tabelas, é a identidade que
-- disparar_campanhas_agendadas impersona pra disparar sem sessão (ver
-- comentário da função, abaixo). Sem essa checagem, um gestor poderia
-- inserir uma campanha com `created_by` de OUTRO gestor da mesma
-- empresa; inofensivo entre dois gestores da mesma empresa (mesmo nível
-- de acesso), mas rompe a garantia de "quem agendou é quem autoriza" e
-- não tem motivo legítimo pra existir.
create policy "campanhas_insert_proprio"
  on public.campanhas for insert
  to authenticated
  with check (public.tem_papel(empresa_id, 'gestor') and created_by = (select auth.uid()));

create policy "campanhas_update_gestor"
  on public.campanhas for update
  to authenticated
  using (public.tem_papel(empresa_id, 'gestor'))
  with check (public.tem_papel(empresa_id, 'gestor'));

create policy "campanhas_delete_gestor"
  on public.campanhas for delete
  to authenticated
  using (public.tem_papel(empresa_id, 'gestor'));

-- ---------------------------------------------------------------------
-- campanha_envios — uma linha por contato alcançado por uma campanha.
-- `fila_envios_id` nulo + `motivo_bloqueio` preenchido = bloqueado antes
-- de enfileirar (variável sem valor); `fila_envios_id` preenchido = a
-- linha de fila correspondente é quem carrega o status/motivo pós-fila
-- (consentimento, opt-out, horário comercial etc. — ver correção 2).
-- ---------------------------------------------------------------------
create table public.campanha_envios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  campanha_id uuid not null,
  contato_id uuid not null,
  fila_envios_id uuid,
  motivo_bloqueio text,
  created_at timestamptz not null default now(),
  constraint campanha_envios_empresa_campanha_id_fkey
    foreign key (empresa_id, campanha_id) references public.campanhas (empresa_id, id) on delete cascade,
  constraint campanha_envios_empresa_contato_id_fkey
    foreign key (empresa_id, contato_id) references public.contatos (empresa_id, id) on delete cascade,
  constraint campanha_envios_empresa_fila_envios_id_fkey
    foreign key (empresa_id, fila_envios_id) references public.fila_envios (empresa_id, id) on delete cascade,
  unique (empresa_id, campanha_id, contato_id),
  unique (empresa_id, fila_envios_id),
  check ((fila_envios_id is null) <> (motivo_bloqueio is null))
);

create index idx_campanha_envios_empresa on public.campanha_envios (empresa_id);
create index idx_campanha_envios_campanha on public.campanha_envios (empresa_id, campanha_id);

alter table public.campanha_envios enable row level security;

-- Mesmo critério de acesso de fila_envios/consentimentos: gestor+,
-- carteira compartilhada, ou o próprio responsável pelo contato.
create policy "campanha_envios_select"
  on public.campanha_envios for select
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

-- Insert só por quem pode disparar campanha (gestor+); disparar_campanha
-- roda como o chamador (security invoker) ou, no caminho agendado, como
-- o criador impersonado (correção 1) — sempre gestor+ nos dois casos.
create policy "campanha_envios_insert_gestor"
  on public.campanha_envios for insert
  to authenticated
  with check (public.tem_papel(empresa_id, 'gestor'));

-- Append-only: nenhuma policy de update/delete acima já bloqueia via RLS;
-- revoke é defesa em profundidade (mesmo padrão de fila_envios).
revoke update, delete on public.campanha_envios from authenticated;

-- ---------------------------------------------------------------------
-- renderizar_blocos_campanha — junta os blocos de e-mail (texto/imagem)
-- num texto simples, na ordem em que aparecem no jsonb.
-- ---------------------------------------------------------------------
create or replace function public.renderizar_blocos_campanha(p_blocos jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select string_agg(
    case bloco ->> 'tipo'
      when 'texto' then bloco ->> 'conteudo'
      when 'imagem' then '[imagem] ' || coalesce(bloco ->> 'conteudo', '')
      else ''
    end,
    E'\n\n'
    order by ordinalidade
  )
  from jsonb_array_elements(coalesce(p_blocos, '[]'::jsonb)) with ordinality as t (bloco, ordinalidade);
$$;

-- ---------------------------------------------------------------------
-- resolver_variaveis_campanha — substitui {{variavel}} pelo dado real do
-- contato (vocabulário fechado: nome, primeiro_nome, email, telefone —
-- correção 5). Variável desconhecida OU sem valor faz a função devolver
-- null inteiro, sinal pra quem chama bloquear só aquele contato (Mensageria.md:
-- "Variável sem valor bloqueia o envio — nunca mandar 'Olá {{primeiro_nome}}'").
-- security invoker: só lê a linha de `contatos` que a RLS de quem chama
-- já permite.
-- ---------------------------------------------------------------------
create or replace function public.resolver_variaveis_campanha(p_contato_id uuid, p_texto text)
returns text
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_contato public.contatos;
  v_resultado text := p_texto;
  v_token text;
  v_valor text;
begin
  if p_texto is null then
    return null;
  end if;

  select * into v_contato from public.contatos where id = p_contato_id;
  if not found then
    return null;
  end if;

  for v_token in
    select distinct m[1]
    from regexp_matches(p_texto, '\{\{\s*([a-z_]+)\s*\}\}', 'g') as m
  loop
    v_valor := case v_token
      when 'nome' then v_contato.nome
      when 'primeiro_nome' then split_part(v_contato.nome, ' ', 1)
      when 'email' then v_contato.email
      when 'telefone' then v_contato.telefone
      else null
    end;

    if coalesce(v_valor, '') = '' then
      return null;
    end if;

    -- Escapa barra invertida antes de usar como substituição: sem isso,
    -- um nome/e-mail de contato que contenha "\1" (raro, mas legítimo
    -- de digitar) seria interpretado por regexp_replace como
    -- backreference em vez de texto literal (achado no security-check).
    v_resultado := regexp_replace(
      v_resultado,
      '\{\{\s*' || v_token || '\s*\}\}',
      replace(v_valor, '\', '\\'),
      'g'
    );
  end loop;

  return v_resultado;
end;
$$;

revoke all on function public.resolver_variaveis_campanha(uuid, text) from public;
grant execute on function public.resolver_variaveis_campanha(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- disparar_campanha — security invoker: quem chama precisa poder
-- escrever a campanha, então já é gestor+ pela RLS (ou, no caminho
-- agendado, o criador impersonado — correção 1).
-- ---------------------------------------------------------------------
create or replace function public.disparar_campanha(p_campanha_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_campanha public.campanhas;
  v_template public.templates_mensagem;
  v_contato_id uuid;
  v_texto_base text;
  v_conteudo text;
  v_assunto text;
  v_fila_id uuid;
  v_linhas_atualizadas int;
begin
  select * into v_campanha from public.campanhas where id = p_campanha_id;
  if not found then
    raise exception 'Campanha não encontrada';
  end if;

  if v_campanha.status not in ('rascunho', 'agendada') then
    raise exception 'Campanha em status "%" não pode ser disparada', v_campanha.status;
  end if;

  if v_campanha.canal = 'whatsapp' then
    select * into v_template from public.templates_mensagem where id = v_campanha.template_id;
    if not found or v_template.status <> 'aprovado' then
      raise exception 'Campanha de WhatsApp exige um template aprovado';
    end if;
    v_texto_base := v_template.conteudo;
  else
    v_texto_base := public.renderizar_blocos_campanha(v_campanha.blocos);
  end if;

  update public.campanhas
  set status = 'enviando', disparada_em = now()
  where id = p_campanha_id;
  get diagnostics v_linhas_atualizadas = row_count;
  if v_linhas_atualizadas = 0 then
    raise exception 'Sem permissão para disparar esta campanha';
  end if;

  for v_contato_id in select * from public.avaliar_segmento(v_campanha.segmento_id)
  loop
    begin
      v_conteudo := public.resolver_variaveis_campanha(v_contato_id, v_texto_base);
      v_assunto := case
        when v_campanha.canal = 'email' and v_campanha.assunto is not null
          then public.resolver_variaveis_campanha(v_contato_id, v_campanha.assunto)
        else null
      end;

      if v_conteudo is null or (v_campanha.canal = 'email' and v_campanha.assunto is not null and v_assunto is null) then
        insert into public.campanha_envios (empresa_id, campanha_id, contato_id, motivo_bloqueio)
        values (v_campanha.empresa_id, p_campanha_id, v_contato_id, 'variavel_sem_valor')
        on conflict (empresa_id, campanha_id, contato_id) do nothing;
        continue;
      end if;

      v_fila_id := public.enfileirar_envio(
        v_contato_id,
        v_campanha.canal,
        'marketing',
        'campanha',
        p_campanha_id,
        'campanha:' || p_campanha_id || ':contato:' || v_contato_id,
        v_conteudo,
        v_assunto,
        coalesce(v_campanha.agendado_para, now())
      );

      insert into public.campanha_envios (empresa_id, campanha_id, contato_id, fila_envios_id)
      values (v_campanha.empresa_id, p_campanha_id, v_contato_id, v_fila_id)
      on conflict (empresa_id, campanha_id, contato_id) do nothing;
    exception
      when others then
        -- Um contato com erro (ex.: enfileirar_envio rejeitar por falta
        -- de permissão) não derruba a campanha inteira (correção 3).
        insert into public.campanha_envios (empresa_id, campanha_id, contato_id, motivo_bloqueio)
        values (v_campanha.empresa_id, p_campanha_id, v_contato_id, sqlerrm)
        on conflict (empresa_id, campanha_id, contato_id) do nothing;
    end;
  end loop;
end;
$$;

revoke all on function public.disparar_campanha(uuid) from public;
grant execute on function public.disparar_campanha(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- disparar_campanhas_agendadas — chamada pelo cron (mesmo agendamento de
-- processar_fila_envios, ADR 0005). security definer + revoke de
-- authenticated: rotina de sistema. Ver correção 1 sobre a impersonação.
-- ---------------------------------------------------------------------
create or replace function public.disparar_campanhas_agendadas(p_agora timestamptz default now())
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campanha record;
begin
  for v_campanha in
    select id, created_by
    from public.campanhas
    where status = 'agendada' and agendado_para <= p_agora
  loop
    perform set_config(
      'request.jwt.claims',
      json_build_object('sub', v_campanha.created_by, 'role', 'authenticated')::text,
      true
    );
    begin
      perform public.disparar_campanha(v_campanha.id);
    exception
      when others then
        -- Uma campanha com erro (ex.: quem criou saiu da empresa) não
        -- derruba as outras agendadas no mesmo lote.
        null;
    end;
  end loop;
end;
$$;

revoke all on function public.disparar_campanhas_agendadas(timestamptz) from public, authenticated;

-- ---------------------------------------------------------------------
-- atualizar_status_campanhas — campanha em 'enviando' sem nenhuma linha
-- de fila_envios ainda 'pendente' vira 'concluida'. Chamada em seguida a
-- processar_fila_envios() no mesmo cron.schedule (correção 4).
-- ---------------------------------------------------------------------
create or replace function public.atualizar_status_campanhas()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.campanhas
  set status = 'concluida'
  where status = 'enviando'
    and not exists (
      select 1
      from public.campanha_envios ce
      join public.fila_envios f on f.id = ce.fila_envios_id
      where ce.campanha_id = campanhas.id
        and f.status = 'pendente'
    );
$$;

revoke all on function public.atualizar_status_campanhas() from public, authenticated;

-- ---------------------------------------------------------------------
-- metricas_campanha — security invoker (mesma RLS de campanha_envios/
-- fila_envios protege o que quem chama pode ver). entregues/lidos
-- sempre 0: limitação do mock herdada de fila-envios (spec, Assunção 4).
-- ---------------------------------------------------------------------
create or replace function public.metricas_campanha(p_campanha_id uuid)
returns table (
  enviados bigint,
  entregues bigint,
  lidos bigint,
  bloqueados bigint,
  optouts bigint,
  negocios_gerados bigint
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not exists (select 1 from public.campanhas where id = p_campanha_id) then
    raise exception 'Campanha não encontrada';
  end if;

  return query
  select
    count(*) filter (where f.status = 'enviada')::bigint as enviados,
    0::bigint as entregues,
    0::bigint as lidos,
    (
      count(*) filter (where ce.motivo_bloqueio is not null)
      + count(*) filter (where f.status = 'bloqueada' and coalesce(f.motivo_bloqueio, '') <> 'optout')
      + count(*) filter (where f.status = 'falhou')
    )::bigint as bloqueados,
    count(*) filter (where f.status = 'bloqueada' and f.motivo_bloqueio = 'optout')::bigint as optouts,
    (
      select count(distinct n.id)
      from public.negocios n
      join public.campanha_envios ce2 on ce2.contato_id = n.contato_id
      join public.fila_envios f2 on f2.id = ce2.fila_envios_id
      where ce2.campanha_id = p_campanha_id
        and f2.processado_em is not null
        and n.created_at between f2.processado_em and f2.processado_em + interval '30 days'
    )::bigint as negocios_gerados
  from public.campanha_envios ce
  left join public.fila_envios f on f.id = ce.fila_envios_id
  where ce.campanha_id = p_campanha_id;
end;
$$;

revoke all on function public.metricas_campanha(uuid) from public;
grant execute on function public.metricas_campanha(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- preview_campanha — prévia com dado real de um contato do segmento
-- (prever_contato_segmento, módulo segmentos), sem gravar nada. Segmento
-- vazio devolve zero linhas (prever_contato_segmento::contatos nulo).
-- ---------------------------------------------------------------------
create or replace function public.preview_campanha(p_campanha_id uuid)
returns table (contato_id uuid, conteudo_resolvido text)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_campanha public.campanhas;
  v_template public.templates_mensagem;
  v_contato public.contatos;
  v_texto_base text;
begin
  select * into v_campanha from public.campanhas where id = p_campanha_id;
  if not found then
    raise exception 'Campanha não encontrada';
  end if;

  v_contato := public.prever_contato_segmento(v_campanha.segmento_id);
  if v_contato is null then
    return;
  end if;

  if v_campanha.canal = 'whatsapp' then
    select * into v_template from public.templates_mensagem where id = v_campanha.template_id;
    v_texto_base := v_template.conteudo;
  else
    v_texto_base := coalesce(v_campanha.assunto || E'\n\n', '') || public.renderizar_blocos_campanha(v_campanha.blocos);
  end if;

  return query select v_contato.id, public.resolver_variaveis_campanha(v_contato.id, v_texto_base);
end;
$$;

revoke all on function public.preview_campanha(uuid) from public;
grant execute on function public.preview_campanha(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Re-registra o job existente (mesmo nome — cron.schedule faz upsert),
-- porque a migration original de fila-envios não pode ser editada
-- (correção 4). disparar_campanhas_agendadas roda primeiro, pra
-- mensagens recém-enfileiradas entrarem na mesma passada do worker.
-- ---------------------------------------------------------------------
select cron.schedule(
  'processar-fila-envios',
  '* * * * *',
  $$select public.disparar_campanhas_agendadas(); select public.processar_fila_envios(); select public.atualizar_status_campanhas();$$
);
