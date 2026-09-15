-- 1D-5: notificações (central no app + push) — PRD §6.14, recortado pra
-- Fase 1: só os gatilhos que não dependem de WhatsApp (lead novo,
-- follow-up vencido, resumo diário da tela "Hoje"). Gatilhos dependentes
-- de WhatsApp (resposta a lembrete, mensagem recebida) entram na Fase 2,
-- reaproveitando esta mesma tabela.

-- pg_cron e pg_net gerenciam os próprios schemas (`cron`/`net`), não
-- fica sob `extensions` como pgcrypto.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ---------------------------------------------------------------------
-- push_subscriptions — 1:1 com o dispositivo/navegador do usuário, não é
-- dado de empresa (mesmo raciocínio de `perfis`: um usuário pode
-- pertencer a mais de uma empresa, a inscrição de push é dele, não dela).
-- ---------------------------------------------------------------------
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (usuario_id, endpoint)
);

create index idx_push_subscriptions_usuario on public.push_subscriptions (usuario_id);

create trigger trg_push_subscriptions_updated_at
  before update on public.push_subscriptions
  for each row execute function public.set_updated_at();

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions_dono"
  on public.push_subscriptions for all
  to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- notificacoes — dado de empresa. Só criada por funções security
-- definer: quem dispara o evento nem sempre é o destinatário (ex.:
-- corretor cria um lead, a notificação é pro gestor).
-- ---------------------------------------------------------------------
create table public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  destinatario_id uuid not null references auth.users (id) on delete cascade,
  tipo text not null check (tipo in ('lead_novo', 'follow_up_vencido', 'resumo_diario')),
  titulo text not null,
  corpo text not null,
  url text,
  lida_em timestamptz,
  enviada_push_em timestamptz,
  created_at timestamptz not null default now()
);

create index idx_notificacoes_destinatario on public.notificacoes (destinatario_id, created_at desc);
create index idx_notificacoes_empresa on public.notificacoes (empresa_id);
create index idx_notificacoes_pendentes on public.notificacoes (enviada_push_em) where enviada_push_em is null;

alter table public.notificacoes enable row level security;

-- Só o destinatário lê as próprias notificações (nunca as de outro
-- membro da empresa, mesmo sendo gestor — notificação é pessoal).
create policy "notificacoes_select_destinatario"
  on public.notificacoes for select
  to authenticated
  using (public.is_membro(empresa_id) and destinatario_id = (select auth.uid()));

-- Update só pra marcar como lida (o cliente nunca insere/apaga direto).
create policy "notificacoes_update_destinatario"
  on public.notificacoes for update
  to authenticated
  using (destinatario_id = (select auth.uid()))
  with check (destinatario_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- Gatilho: lead novo (PRD §6.2, item 1). Notifica o responsável, ou
-- todo gestor/dono da empresa se o lead ainda não tiver responsável.
-- ---------------------------------------------------------------------
create or replace function public.notificar_lead_novo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.responsavel_id is not null then
    insert into public.notificacoes (empresa_id, destinatario_id, tipo, titulo, corpo, url)
    values (
      new.empresa_id,
      new.responsavel_id,
      'lead_novo',
      'Novo lead: ' || new.nome,
      'Um novo lead entrou no sistema. Faça o primeiro contato.',
      '/contatos/' || new.id
    );
  else
    insert into public.notificacoes (empresa_id, destinatario_id, tipo, titulo, corpo, url)
    select
      new.empresa_id,
      em.usuario_id,
      'lead_novo',
      'Novo lead: ' || new.nome,
      'Um novo lead entrou no sistema. Faça o primeiro contato.',
      '/contatos/' || new.id
    from public.empresa_membros em
    where em.empresa_id = new.empresa_id and em.papel in ('dono', 'gestor');
  end if;

  return new;
end;
$$;

revoke all on function public.notificar_lead_novo() from public;

create trigger trg_contatos_notificar_lead_novo
  after insert on public.contatos
  for each row
  when (new.status = 'lead')
  execute function public.notificar_lead_novo();

-- ---------------------------------------------------------------------
-- Follow-up vencido + resumo diário (PRD §6.2/§6.14). Agendada de hora
-- em hora; só age nas empresas cuja hora local (fuso da empresa) bate
-- com o horário configurado — evita mandar tudo às 8h UTC pra empresas
-- em fusos diferentes. Idempotente: não duplica notificação do mesmo
-- tipo já criada hoje pro mesmo usuário.
-- ---------------------------------------------------------------------
-- p_agora existe só pra viabilizar teste determinístico (pgTAP não tem
-- como "congelar" now() dentro da função) — em produção o cron nunca
-- passa esse argumento, usa o default (agora de verdade).
create or replace function public.gerar_notificacoes_diarias(p_agora timestamptz default now())
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa record;
  v_hoje date;
  v_membro record;
  v_atrasadas bigint;
begin
  for v_empresa in
    select id, fuso from public.empresas where deleted_at is null
  loop
    if extract(hour from (p_agora at time zone v_empresa.fuso)) <> 8 then
      continue;
    end if;

    v_hoje := (p_agora at time zone v_empresa.fuso)::date;

    for v_membro in
      select usuario_id from public.empresa_membros where empresa_id = v_empresa.id
    loop
      if not exists (
        select 1 from public.notificacoes
        where empresa_id = v_empresa.id
          and destinatario_id = v_membro.usuario_id
          and tipo = 'resumo_diario'
          and created_at::date = v_hoje
      ) then
        insert into public.notificacoes (empresa_id, destinatario_id, tipo, titulo, corpo, url)
        values (
          v_empresa.id,
          v_membro.usuario_id,
          'resumo_diario',
          'Resumo do dia',
          'Confira as ações de hoje na tela "Hoje".',
          '/'
        );
      end if;

      select count(*) into v_atrasadas
      from public.tarefas
      where empresa_id = v_empresa.id
        and responsavel_id = v_membro.usuario_id
        and concluida_em is null
        and deleted_at is null
        and data_vencimento < v_hoje;

      if v_atrasadas > 0 and not exists (
        select 1 from public.notificacoes
        where empresa_id = v_empresa.id
          and destinatario_id = v_membro.usuario_id
          and tipo = 'follow_up_vencido'
          and created_at::date = v_hoje
      ) then
        insert into public.notificacoes (empresa_id, destinatario_id, tipo, titulo, corpo, url)
        values (
          v_empresa.id,
          v_membro.usuario_id,
          'follow_up_vencido',
          v_atrasadas || ' tarefa(s) atrasada(s)',
          'Você tem follow-ups atrasados. Confira a lista de tarefas.',
          '/tarefas'
        );
      end if;
    end loop;
  end loop;
end;
$$;

-- Só o pg_cron chama isso (roda como o dono do job, não como usuário
-- comum) — não concede execução a `authenticated`, é rotina de sistema,
-- não uma ação que um membro da empresa deveria disparar à vontade.
revoke all on function public.gerar_notificacoes_diarias(timestamptz) from public, authenticated;

select cron.schedule(
  'gerar-notificacoes-diarias',
  '0 * * * *',
  $$select public.gerar_notificacoes_diarias();$$
);
