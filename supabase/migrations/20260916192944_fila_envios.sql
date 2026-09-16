-- Fase 3 recortada, módulo 1/5: fila de envios (PRD §6.8/§6.9,
-- docs/fase3/SPEC-fila-envios.md). Fundação única por onde toda mensagem
-- (e-mail ou WhatsApp) sai do sistema — campanhas (módulo 4) e, mais
-- tarde, automações/réguas (Fase 2) só escrevem aqui, nunca chamam um
-- provider direto.
--
-- ADR 0005: o worker roda inteiro em Postgres (pg_cron chamando uma
-- função plpgsql), sem Edge Function nem pg_net, enquanto
-- EmailProvider/WhatsAppProvider forem mock (mock_enviar_mensagem é o
-- único ponto que a Fase 2 troca por uma chamada real).
--
-- Checagens de "conta ativa"/"limite do plano" (Mensageria.md, itens
-- 1-2) ficam de fora — billing é Fase 4, as tabelas não existem ainda.
-- A ordem abaixo já nasce pronta pra recebê-las na frente da cadeia.

-- ---------------------------------------------------------------------
-- fila_envios
-- ---------------------------------------------------------------------
create table public.fila_envios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  contato_id uuid not null,
  canal text not null check (canal in ('email', 'whatsapp')),
  finalidade text not null check (finalidade in ('atendimento', 'marketing')),
  origem_tipo text not null check (origem_tipo in ('campanha')), -- cresce quando automação/cadência existirem (Fase 2)
  origem_id uuid not null, -- polimórfico por origem_tipo; sem FK física de propósito
  chave_idempotencia text not null,
  assunto text, -- só e-mail
  conteudo text not null, -- já resolvido (variáveis substituídas antes de enfileirar)
  status text not null default 'pendente' check (status in ('pendente', 'bloqueada', 'enviada', 'falhou')),
  motivo_bloqueio text, -- preenchido quando bloqueada/falhou
  agendado_para timestamptz not null default now(),
  processado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  constraint fila_envios_empresa_contato_id_fkey
    foreign key (empresa_id, contato_id) references public.contatos (empresa_id, id) on delete cascade,
  unique (empresa_id, chave_idempotencia)
);

-- Índice pra leitura com RLS (por empresa) e um separado pro worker, que
-- varre TODAS as empresas de uma vez e não filtra por empresa_id — um
-- índice composto começando por empresa_id não ajudaria essa consulta.
create index idx_fila_envios_empresa on public.fila_envios (empresa_id);
create index idx_fila_envios_worker on public.fila_envios (status, agendado_para) where status = 'pendente';
create index idx_fila_envios_contato on public.fila_envios (contato_id);

create trigger trg_fila_envios_updated_at
  before update on public.fila_envios
  for each row execute function public.set_updated_at();

alter table public.fila_envios enable row level security;

-- Só leitura direta pra authenticated — toda escrita passa por
-- enfileirar_envio/processar_fila_envios (security definer, abaixo).
-- Mesmo critério de acesso de `consentimentos`: gestor+, carteira
-- compartilhada, ou o próprio responsável pelo contato.
create policy "fila_envios_select"
  on public.fila_envios for select
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

-- Reforço explícito (mesmo padrão de soft_delete_e_dedup.sql): sem
-- nenhuma policy de insert/update/delete acima, a RLS já bloqueia — o
-- revoke é defesa em profundidade, não motivo de segunda checagem.
revoke insert, update, delete on public.fila_envios from authenticated;

-- ---------------------------------------------------------------------
-- Helpers de horário comercial — extraídos e testáveis sozinhos, é a
-- lógica mais propensa a erro do módulo (fuso + jsonb + virada de dia).
-- security definer pelo mesmo motivo de is_membro/tem_papel: leem
-- `empresas` sem depender de quem está chamando ter acesso de membro
-- (o worker roda como sistema, não como um usuário logado).
-- ---------------------------------------------------------------------
create or replace function public.dentro_horario_comercial(p_empresa_id uuid, p_momento timestamptz)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_fuso text;
  v_horario jsonb;
  v_local timestamp;
  v_dia_semana int;
  v_chave text;
  v_janela jsonb;
begin
  select fuso, horario_comercial into v_fuso, v_horario
  from public.empresas
  where id = p_empresa_id;

  if not found then
    return false;
  end if;

  v_local := p_momento at time zone v_fuso;
  v_dia_semana := extract(isodow from v_local); -- 1=segunda .. 7=domingo

  v_chave := case
    when v_dia_semana between 1 and 5 then 'seg_sex'
    when v_dia_semana = 6 then 'sab'
    else 'dom'
  end;

  v_janela := v_horario -> v_chave;

  if v_janela is null or jsonb_typeof(v_janela) <> 'array' then
    return false; -- dia fechado (null) ou configuração ausente
  end if;

  return v_local::time >= (v_janela ->> 0)::time and v_local::time < (v_janela ->> 1)::time;
end;
$$;

revoke all on function public.dentro_horario_comercial(uuid, timestamptz) from public, authenticated;

create or replace function public.proximo_horario_comercial(p_empresa_id uuid, p_momento timestamptz)
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_fuso text;
  v_horario jsonb;
  v_cursor timestamp;
  v_dia_semana int;
  v_chave text;
  v_janela jsonb;
  v_candidato timestamp;
  v_i int;
begin
  select fuso, horario_comercial into v_fuso, v_horario
  from public.empresas
  where id = p_empresa_id;

  if not found then
    return null;
  end if;

  v_cursor := p_momento at time zone v_fuso;

  -- Guarda contra laço infinito quando a empresa fecha todos os dias:
  -- checa hoje + 7 dias e desiste.
  for v_i in 0..7 loop
    v_dia_semana := extract(isodow from (v_cursor::date + v_i));
    v_chave := case
      when v_dia_semana between 1 and 5 then 'seg_sex'
      when v_dia_semana = 6 then 'sab'
      else 'dom'
    end;
    v_janela := v_horario -> v_chave;

    if v_janela is not null and jsonb_typeof(v_janela) = 'array' then
      v_candidato := (v_cursor::date + v_i) + (v_janela ->> 0)::time;
      if v_candidato > v_cursor then
        return v_candidato at time zone v_fuso;
      end if;
    end if;
  end loop;

  return null;
end;
$$;

revoke all on function public.proximo_horario_comercial(uuid, timestamptz) from public, authenticated;

-- ---------------------------------------------------------------------
-- enfileirar_envio — único ponto de escrita normal na fila. security
-- definer porque a tabela não tem policy de insert pra authenticated;
-- a autorização é checada explicitamente no corpo (mesmo padrão de
-- excluir_registro em soft_delete_e_dedup.sql).
-- ---------------------------------------------------------------------
create or replace function public.enfileirar_envio(
  p_contato_id uuid,
  p_canal text,
  p_finalidade text,
  p_origem_tipo text,
  p_origem_id uuid,
  p_chave_idempotencia text,
  p_conteudo text,
  p_assunto text default null,
  p_agendado_para timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa_id uuid;
  v_responsavel_id uuid;
  v_id uuid;
begin
  select empresa_id, responsavel_id into v_empresa_id, v_responsavel_id
  from public.contatos
  where id = p_contato_id and deleted_at is null;

  if not found then
    raise exception 'Contato não encontrado';
  end if;

  if not public.pode_acessar_responsavel(v_empresa_id, v_responsavel_id) then
    raise exception 'Sem permissão para enviar mensagem a este contato';
  end if;

  insert into public.fila_envios (
    empresa_id, contato_id, canal, finalidade, origem_tipo, origem_id,
    chave_idempotencia, assunto, conteudo, agendado_para, created_by
  )
  values (
    v_empresa_id, p_contato_id, p_canal, p_finalidade, p_origem_tipo, p_origem_id,
    p_chave_idempotencia, p_assunto, p_conteudo, p_agendado_para, (select auth.uid())
  )
  on conflict (empresa_id, chave_idempotencia) do nothing
  returning id into v_id;

  -- Idempotência de verdade: conflito não é erro, devolve o id que já existia.
  if v_id is null then
    select id into v_id
    from public.fila_envios
    where empresa_id = v_empresa_id and chave_idempotencia = p_chave_idempotencia;
  end if;

  return v_id;
end;
$$;

revoke all on function public.enfileirar_envio(uuid, text, text, text, uuid, text, text, text, timestamptz) from public;
grant execute on function public.enfileirar_envio(uuid, text, text, text, uuid, text, text, text, timestamptz) to authenticated;

-- ---------------------------------------------------------------------
-- mock_enviar_mensagem — interna, não exposta via RPC pública. Único
-- ponto que a Fase 2 troca por uma chamada real ao EmailProvider/
-- WhatsAppProvider (ver ADR 0005 e supabase/functions/_shared/providers/tipos.ts).
-- Nesta fase, sempre sucesso — nenhuma mensagem real sai.
-- ---------------------------------------------------------------------
create or replace function public.mock_enviar_mensagem(p_canal text, p_conteudo text)
returns boolean
language plpgsql
set search_path = ''
as $$
begin
  return true;
end;
$$;

revoke all on function public.mock_enviar_mensagem(text, text) from public, authenticated;

-- ---------------------------------------------------------------------
-- processar_fila_envios — o worker. security definer + revoke de
-- authenticated: rotina de sistema, só o pg_cron chama (mesmo padrão de
-- gerar_notificacoes_diarias). Processa em lote (p_limite, padrão 200)
-- pra não segurar uma transação longa numa campanha grande — e já
-- entrega o "limite de velocidade" que o PRD §6.9 pede, de graça.
--
-- p_agora existe só pra viabilizar teste determinístico (mesmo padrão
-- de gerar_notificacoes_diarias) — o cron nunca passa esse argumento.
-- ---------------------------------------------------------------------
create or replace function public.processar_fila_envios(
  p_agora timestamptz default now(),
  p_limite integer default 200
)
returns table (enviadas bigint, bloqueadas bigint, reagendadas bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_linha record;
  v_contato record;
  v_concedido boolean;
  v_dentro boolean;
  v_proxima timestamptz;
  v_enviadas bigint := 0;
  v_bloqueadas bigint := 0;
  v_reagendadas bigint := 0;
begin
  for v_linha in
    select *
    from public.fila_envios
    where status = 'pendente' and agendado_para <= p_agora
    order by agendado_para
    limit p_limite
    for update skip locked
  loop
    begin
      -- 0. TODO (Fase 4): conta ativa / limite de envios do plano entram
      -- aqui, antes de qualquer outra checagem.

      -- 1. contato precisa existir e não ter sido excluído (o worker é
      -- security definer, não passa pela RLS de contatos sozinho).
      select id, deleted_at, telefone, email into v_contato
      from public.contatos
      where id = v_linha.contato_id;

      if not found or v_contato.deleted_at is not null then
        update public.fila_envios
        set status = 'bloqueada', motivo_bloqueio = 'contato_excluido', processado_em = p_agora
        where id = v_linha.id;
        v_bloqueadas := v_bloqueadas + 1;
        continue;
      end if;

      -- 2. contato precisa ter endereço no canal (mesma regra de
      -- "variável sem valor bloqueia o envio", Mensageria.md).
      if v_linha.canal = 'email' and coalesce(v_contato.email, '') = '' then
        update public.fila_envios
        set status = 'bloqueada', motivo_bloqueio = 'sem_endereco_email', processado_em = p_agora
        where id = v_linha.id;
        v_bloqueadas := v_bloqueadas + 1;
        continue;
      end if;

      if v_linha.canal = 'whatsapp' and coalesce(v_contato.telefone, '') = '' then
        update public.fila_envios
        set status = 'bloqueada', motivo_bloqueio = 'sem_endereco_whatsapp', processado_em = p_agora
        where id = v_linha.id;
        v_bloqueadas := v_bloqueadas + 1;
        continue;
      end if;

      -- 3. consentimento / opt-out. Marketing exige registro concedido;
      -- atendimento passa salvo opt-out explícito (PRD §6.9).
      select concedido into v_concedido
      from public.consentimentos
      where empresa_id = v_linha.empresa_id
        and contato_id = v_linha.contato_id
        and finalidade = v_linha.finalidade
      order by registrado_em desc
      limit 1;

      if v_linha.finalidade = 'marketing' then
        if not found then
          update public.fila_envios
          set status = 'bloqueada', motivo_bloqueio = 'sem_consentimento_marketing', processado_em = p_agora
          where id = v_linha.id;
          v_bloqueadas := v_bloqueadas + 1;
          continue;
        elsif not v_concedido then
          update public.fila_envios
          set status = 'bloqueada', motivo_bloqueio = 'optout', processado_em = p_agora
          where id = v_linha.id;
          v_bloqueadas := v_bloqueadas + 1;
          continue;
        end if;
      else
        if found and not v_concedido then
          update public.fila_envios
          set status = 'bloqueada', motivo_bloqueio = 'optout', processado_em = p_agora
          where id = v_linha.id;
          v_bloqueadas := v_bloqueadas + 1;
          continue;
        end if;
      end if;

      -- 4. horário comercial. Fora dele NÃO bloqueia — reagenda pra
      -- dentro da próxima janela e mantém pendente. Vem depois de
      -- consentimento/endereço de propósito: mensagem permanentemente
      -- bloqueada não deve ser reagendada em loop.
      v_dentro := public.dentro_horario_comercial(v_linha.empresa_id, p_agora);
      if not v_dentro then
        v_proxima := public.proximo_horario_comercial(v_linha.empresa_id, p_agora);
        if v_proxima is null then
          update public.fila_envios
          set status = 'bloqueada', motivo_bloqueio = 'sem_horario_comercial', processado_em = p_agora
          where id = v_linha.id;
          v_bloqueadas := v_bloqueadas + 1;
        else
          update public.fila_envios
          set agendado_para = v_proxima
          where id = v_linha.id;
          v_reagendadas := v_reagendadas + 1;
        end if;
        continue;
      end if;

      -- 5. janela de 24h do WhatsApp — TODO (Fase 2): sem inbox real
      -- ainda (ADR 0004), não há como saber se o contato respondeu nas
      -- últimas 24h. Passa direto por enquanto, documentado aqui, não
      -- implementado a fingir.

      -- 6. envio (mock — ver mock_enviar_mensagem acima).
      perform public.mock_enviar_mensagem(v_linha.canal, v_linha.conteudo);

      update public.fila_envios
      set status = 'enviada', processado_em = p_agora
      where id = v_linha.id;
      v_enviadas := v_enviadas + 1;
    exception
      when others then
        -- Uma linha com erro inesperado não derruba o lote inteiro —
        -- fica marcada pra investigação, o resto continua processando.
        update public.fila_envios
        set status = 'falhou', motivo_bloqueio = sqlerrm, processado_em = p_agora
        where id = v_linha.id;
        v_bloqueadas := v_bloqueadas + 1;
    end;
  end loop;

  return query select v_enviadas, v_bloqueadas, v_reagendadas;
end;
$$;

revoke all on function public.processar_fila_envios(timestamptz, integer) from public, authenticated;

select cron.schedule(
  'processar-fila-envios',
  '* * * * *',
  $$select public.processar_fila_envios();$$
);
