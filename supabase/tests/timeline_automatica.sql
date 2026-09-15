-- Redesenho do núcleo: a timeline (`atividades`) deixa de depender do
-- frontend lembrar de escrevê-la — o banco registra sozinho ao mover
-- etapa, concluir tarefa e renovar vencimento. `contato_id`/`empresa_id`
-- são derivados automaticamente a partir do negócio/vencimento/tarefa
-- vinculado, e validados quando vêm preenchidos com valor divergente.

begin;
select no_plan();

set search_path = public, extensions;

set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000102", "email": "gestor@segurosalfa.test", "role": "authenticated"}';

-- ---------------------------------------------------------------------
-- mover_negocio_etapa: uma chamada só, timeline sozinha.
-- ---------------------------------------------------------------------
do $$
begin
  perform public.mover_negocio_etapa(
    (select id from public.negocios where proximo_passo_acao = 'Ligar para apresentar cotação'),
    'a0000000-0000-0000-0000-000000000213',
    current_date + 3,
    'Enviar proposta'
  );
end;
$$;

select is(
  (select etapa_id from public.negocios where proximo_passo_acao = 'Enviar proposta'),
  'a0000000-0000-0000-0000-000000000213'::uuid,
  'mover_negocio_etapa move a etapa numa chamada só'
);

select is(
  (
    select count(*) from public.atividades
    where negocio_id = (select id from public.negocios where proximo_passo_acao = 'Enviar proposta')
      and tipo = 'mudanca_etapa'
  ),
  1::bigint,
  'mover_negocio_etapa gera a atividade de mudança de etapa sozinho'
);

select is(
  (
    select contato_id from public.atividades
    where negocio_id = (select id from public.negocios where proximo_passo_acao = 'Enviar proposta')
      and tipo = 'mudanca_etapa'
  ),
  'a0000000-0000-0000-0000-000000000302'::uuid, -- Marina
  'a atividade automática já vem com contato_id derivado do negócio'
);

-- Timeline é append-only: ninguém altera nem apaga, nem gestor.
select throws_ok(
  $$ update public.atividades set tipo = 'nota' where negocio_id = (select id from public.negocios where proximo_passo_acao = 'Enviar proposta') $$,
  '42501',
  null,
  'não consegue alterar uma atividade (revoke update)'
);

select throws_ok(
  $$ delete from public.atividades where negocio_id = (select id from public.negocios where proximo_passo_acao = 'Enviar proposta') $$,
  '42501',
  null,
  'não consegue apagar uma atividade (revoke delete)'
);

-- ---------------------------------------------------------------------
-- derivar_contexto_atividade: preenche contato_id a partir do negócio
-- quando vem vazio; rejeita quando vem preenchido e não bate.
-- ---------------------------------------------------------------------
with nova as (
  insert into public.atividades (empresa_id, negocio_id, tipo, responsavel_id, created_by, conteudo)
  values (
    'a0000000-0000-0000-0000-000000000001',
    (select id from public.negocios where proximo_passo_acao = 'Enviar proposta'),
    'nota', 'a0000000-0000-0000-0000-000000000102', 'a0000000-0000-0000-0000-000000000102',
    '{"texto": "sem contato_id explícito"}'::jsonb
  )
  returning contato_id
)
select is(
  (select contato_id from nova),
  'a0000000-0000-0000-0000-000000000302'::uuid,
  'inserir atividade só com negocio_id deriva o contato_id automaticamente'
);

select throws_ok(
  $$
    insert into public.atividades (empresa_id, negocio_id, contato_id, tipo, responsavel_id, created_by)
    values (
      'a0000000-0000-0000-0000-000000000001',
      (select id from public.negocios where proximo_passo_acao = 'Enviar proposta'),
      'a0000000-0000-0000-0000-000000000304', -- Fernanda: contato errado, o negócio é da Marina
      'nota', 'a0000000-0000-0000-0000-000000000102', 'a0000000-0000-0000-0000-000000000102'
    )
  $$,
  'P0001',
  'Atividade aponta para um contato diferente do contato do negócio',
  'não aceita contato_id divergente do contato_id real do negócio vinculado'
);

-- ---------------------------------------------------------------------
-- derivar_contexto_tarefa: mesma ideia, pra tarefas ligadas a negócio.
-- ---------------------------------------------------------------------
with nova as (
  insert into public.tarefas (empresa_id, negocio_id, tipo, titulo, data_vencimento, responsavel_id)
  values (
    'a0000000-0000-0000-0000-000000000001',
    (select id from public.negocios where proximo_passo_acao = 'Enviar proposta'),
    'ligar', 'Follow-up automático', current_date + 1, 'a0000000-0000-0000-0000-000000000102'
  )
  returning contato_id
)
select is(
  (select contato_id from nova),
  'a0000000-0000-0000-0000-000000000302'::uuid,
  'tarefa com negocio_id deriva o contato_id automaticamente'
);

select throws_ok(
  $$
    insert into public.tarefas (empresa_id, negocio_id, contato_id, tipo, titulo, data_vencimento, responsavel_id)
    values (
      'a0000000-0000-0000-0000-000000000001',
      (select id from public.negocios where proximo_passo_acao = 'Enviar proposta'),
      'a0000000-0000-0000-0000-000000000304',
      'ligar', 'Tarefa com contato divergente', current_date + 1, 'a0000000-0000-0000-0000-000000000102'
    )
  $$,
  'P0001',
  'Tarefa aponta para um contato diferente do contato do negócio',
  'não aceita tarefa com contato_id divergente do contato_id real do negócio vinculado'
);

-- ---------------------------------------------------------------------
-- Concluir tarefa gera atividade sozinha.
-- ---------------------------------------------------------------------
update public.tarefas set concluida_em = now()
where titulo = 'Ligar para Marina sobre cotação';

select is(
  (
    select count(*) from public.atividades
    where tarefa_id = (select id from public.tarefas where titulo = 'Ligar para Marina sobre cotação')
      and tipo = 'tarefa'
  ),
  1::bigint,
  'concluir uma tarefa gera atividade automaticamente'
);

-- ---------------------------------------------------------------------
-- renovar_vencimento encadeia o anterior e gera atividade sozinha.
-- ---------------------------------------------------------------------
select public.renovar_vencimento(
  (select id from public.vencimentos where descricao = 'Seguro auto — Honda Civic' and vencimento_anterior_id is null),
  current_date + 365,
  null,
  null
);

select is(
  (
    select count(*) from public.vencimentos
    where vencimento_anterior_id = (select id from public.vencimentos where descricao = 'Seguro auto — Honda Civic' and vencimento_anterior_id is null)
  ),
  1::bigint,
  'renovar_vencimento encadeia o novo vencimento ao anterior'
);

select is(
  (
    select count(*) from public.atividades a
    join public.vencimentos v on v.id = a.vencimento_id
    where v.vencimento_anterior_id = (select id from public.vencimentos where descricao = 'Seguro auto — Honda Civic' and vencimento_anterior_id is null)
      and a.tipo = 'vencimento'
  ),
  1::bigint,
  'renovar_vencimento gera atividade de renovação automaticamente'
);

select * from finish();
rollback;
