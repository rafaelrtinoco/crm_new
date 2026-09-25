-- Notificações (PRD §6.14, recortado pra Fase 1): trigger de lead novo,
-- gerar_notificacoes_diarias() e isolamento entre empresas.
--
-- Checagens de "quantas/quais notificações existem" rodam como
-- superusuário (bypassa RLS) — é a única forma de pegar a verdade, já
-- que consultar como o usuário errado sempre retorna 0 linhas por causa
-- da própria RLS (falso-negativo mascarado, não prova nada). As
-- checagens de isolamento de verdade (o que cada usuário *enxerga*)
-- rodam como o usuário específico, de propósito.

begin;
select no_plan();

set search_path = public, extensions;

-- ---------------------------------------------------------------------
-- Lead novo COM responsável: notifica só o responsável.
-- ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000103", "email": "corretor@segurosalfa.test", "role": "authenticated"}';

with novo as (
  insert into public.contatos (empresa_id, nome, status, responsavel_id, created_by)
  values (
    'a0000000-0000-0000-0000-000000000001',
    'Lead Com Responsável',
    'lead',
    'a0000000-0000-0000-0000-000000000103',
    'a0000000-0000-0000-0000-000000000103'
  )
  returning id
)
select id as lead_com_responsavel_id into temporary leads_teste from novo;

reset role;

select is(
  (select count(*) from public.notificacoes
    where tipo = 'lead_novo'
      and destinatario_id = 'a0000000-0000-0000-0000-000000000103'
      and corpo like '%primeiro contato%'
      and url = '/contatos/' || (select lead_com_responsavel_id from leads_teste)),
  1::bigint,
  'lead novo com responsável notifica só o responsável'
);

-- ---------------------------------------------------------------------
-- Lead novo SEM responsável: notifica dono + gestor (Ana e Gustavo),
-- não o usuário comum (Carla). Insere como Gustavo (gestor) — Carla
-- (usuário comum) não passa no `with check` de contatos pra inserir
-- sem responsavel_id (pode_acessar_responsavel exige gestor+/carteira
-- compartilhada/ser o próprio responsável, e aqui não há responsável).
-- ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000102", "email": "gestor@segurosalfa.test", "role": "authenticated"}';

with novo as (
  insert into public.contatos (empresa_id, nome, status, created_by)
  values (
    'a0000000-0000-0000-0000-000000000001',
    'Lead Sem Responsável',
    'lead',
    'a0000000-0000-0000-0000-000000000102'
  )
  returning id
)
select id as lead_sem_responsavel_id into temporary leads_teste2 from novo;

reset role;

select is(
  (select count(*) from public.notificacoes n, leads_teste2 l
    where n.url = '/contatos/' || l.lead_sem_responsavel_id
      and n.tipo = 'lead_novo'),
  2::bigint,
  'lead novo sem responsável notifica dono + gestor (2 destinatários)'
);

select ok(
  exists (
    select 1 from public.notificacoes
    where tipo = 'lead_novo'
      and destinatario_id = 'a0000000-0000-0000-0000-000000000101'
      and titulo = 'Novo lead: Lead Sem Responsável'
  ),
  'dono (Ana) está entre os notificados'
);

select ok(
  not exists (
    select 1 from public.notificacoes
    where tipo = 'lead_novo'
      and destinatario_id = 'a0000000-0000-0000-0000-000000000103'
      and titulo = 'Novo lead: Lead Sem Responsável'
  ),
  'usuário comum (Carla) não é notificado quando não é o responsável (checado sem RLS, é a verdade de fato)'
);

-- ---------------------------------------------------------------------
-- Isolamento de verdade: como Carla, ela não enxerga a notificação
-- destinada à Ana (RLS por destinatário — notificação é pessoal, não
-- por papel, mesmo dentro da mesma empresa).
-- ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000103", "email": "corretor@segurosalfa.test", "role": "authenticated"}';

select is(
  (select count(*) from public.notificacoes
    where destinatario_id = 'a0000000-0000-0000-0000-000000000101'),
  0::bigint,
  'Carla não enxerga notificação destinada a outro membro (RLS por destinatário)'
);

-- ---------------------------------------------------------------------
-- push_subscriptions: só o dono vê/gerencia a própria inscrição.
-- ---------------------------------------------------------------------
insert into public.push_subscriptions (usuario_id, endpoint, p256dh, auth)
values (
  'a0000000-0000-0000-0000-000000000103',
  'https://push.example.test/carla',
  'p256dh-fake',
  'auth-fake'
);

select is(
  (select count(*) from public.push_subscriptions where usuario_id = 'a0000000-0000-0000-0000-000000000103'),
  1::bigint,
  'Carla consegue criar e ver a própria inscrição de push'
);

set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000102", "email": "gestor@segurosalfa.test", "role": "authenticated"}';

select is(
  (select count(*) from public.push_subscriptions where usuario_id = 'a0000000-0000-0000-0000-000000000103'),
  0::bigint,
  'Gustavo (outro usuário, mesma empresa) não enxerga a inscrição de push de Carla'
);

-- ---------------------------------------------------------------------
-- gerar_notificacoes_diarias(): roda como superusuário (é rotina de
-- sistema, authenticated não tem execução concedida de propósito).
-- Fixa p_agora nas 8h do fuso da empresa Alfa (America/Sao_Paulo, UTC-3)
-- pra não depender da hora real de quando o teste roda.
-- ---------------------------------------------------------------------
reset role;

-- Tarefa atrasada de Carla, com data absoluta fixada em relação ao
-- `p_agora` congelado abaixo (não a tarefa do seed, que usa
-- `current_date - interval '1 day'` — relativa ao dia real do `db:reset`,
-- então só ficava "atrasada" quando a sessão rodava em 2026-09-15; em
-- qualquer outro dia a tarefa nascia vencendo DEPOIS do `p_agora` fixo
-- abaixo e o follow-up vencido nunca era gerado. Teste próprio, sem
-- depender do seed, pra não recriar essa armadilha de novo).
insert into public.tarefas (empresa_id, contato_id, tipo, titulo, data_vencimento, responsavel_id)
values (
  'a0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000301',
  'whatsapp',
  'Confirmar renovação do seguro de vida (teste)',
  '2026-09-14',
  'a0000000-0000-0000-0000-000000000103'
);

do $$
begin
  perform public.gerar_notificacoes_diarias('2026-09-15 11:00:00+00'::timestamptz);
end;
$$;

select ok(
  exists (
    select 1 from public.notificacoes
    where tipo = 'resumo_diario'
      and destinatario_id = 'a0000000-0000-0000-0000-000000000103'
  ),
  'resumo diário gerado pra Carla no horário local configurado da empresa'
);

-- Tarefa atrasada inserida acima ("Confirmar renovação do seguro de
-- vida (teste)", vence 2026-09-14, sem concluida_em) — deve gerar
-- follow-up vencido.
select ok(
  exists (
    select 1 from public.notificacoes
    where tipo = 'follow_up_vencido'
      and destinatario_id = 'a0000000-0000-0000-0000-000000000103'
  ),
  'follow-up vencido gerado pra Carla (tem tarefa atrasada no seed)'
);

-- Rodar de novo no mesmo dia não duplica (idempotente).
do $$
begin
  perform public.gerar_notificacoes_diarias('2026-09-15 11:30:00+00'::timestamptz);
end;
$$;

select is(
  (select count(*) from public.notificacoes
    where tipo = 'resumo_diario' and destinatario_id = 'a0000000-0000-0000-0000-000000000103'),
  1::bigint,
  'rodar gerar_notificacoes_diarias duas vezes no mesmo dia não duplica o resumo'
);

select * from finish();
rollback;
