-- Redesenho do núcleo: etapas marcadas como `tipo = 'ganho'`/`'perdido'`
-- sincronizam o status do negócio sozinhas — fecha o gap em que arrastar
-- um card pra última coluna do kanban não tinha nenhum efeito no status
-- (PRD §6.5: "Ganho: marca o contato como cliente"). O seed local não
-- cria essas etapas especiais (só a criação real via `aplicar_template`
-- cria); este teste simula o cenário com etapas ad hoc.

begin;
select no_plan();

set search_path = public, extensions;

set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000102", "email": "gestor@segurosalfa.test", "role": "authenticated"}';

insert into public.etapas (id, empresa_id, funil_id, nome, ordem, tipo) values
  ('a0000000-0000-0000-0000-000000000216', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000201', 'Ganho', 6, 'ganho'),
  ('a0000000-0000-0000-0000-000000000217', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000201', 'Perdido', 7, 'perdido');

-- No máximo uma etapa de cada tipo especial por funil.
select throws_ok(
  $$
    insert into public.etapas (empresa_id, funil_id, nome, ordem, tipo)
    values ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000201', 'Ganho duplicado', 8, 'ganho')
  $$,
  '23505',
  null,
  'só pode existir uma etapa tipo=ganho por funil'
);

-- ---------------------------------------------------------------------
-- Arrastar o card pra etapa Ganho marca o negócio como ganho sozinho.
-- ---------------------------------------------------------------------
update public.negocios set etapa_id = 'a0000000-0000-0000-0000-000000000216'
where proximo_passo_acao = 'Ligar para apresentar cotação';

select is(
  (select status from public.negocios where etapa_id = 'a0000000-0000-0000-0000-000000000216'),
  'ganho',
  'mover o card pra etapa tipo=ganho marca o negócio como ganho sozinho'
);

select is(
  (select status from public.contatos where id = 'a0000000-0000-0000-0000-000000000302'),
  'cliente',
  'e promove o contato (Marina) a cliente'
);

select is(
  (
    select count(*) from public.atividades
    where negocio_id = (select id from public.negocios where etapa_id = 'a0000000-0000-0000-0000-000000000216')
      and tipo = 'mudanca_etapa'
  ),
  2::bigint, -- uma pela mudança de etapa em si, outra pelo evento "ganho"
  'gera as duas atividades — mudança de etapa e o evento de ganho'
);

-- ---------------------------------------------------------------------
-- Arrastar pra etapa Perdido sem motivo é barrado com mensagem clara,
-- em vez da constraint genérica negocios_perdido_tem_motivo.
-- ---------------------------------------------------------------------
select throws_ok(
  $$
    update public.negocios set etapa_id = 'a0000000-0000-0000-0000-000000000217'
    where proximo_passo_acao = 'Follow-up da proposta enviada'
  $$,
  'P0001',
  'Etapa de perda exige um motivo — use "Marcar como perdido" em vez de arrastar o card.',
  'arrastar pra etapa perdido sem motivo é barrado com mensagem clara'
);

-- Motivo junto na mesma escrita: funciona.
update public.negocios
set etapa_id = 'a0000000-0000-0000-0000-000000000217', motivo_perda_id = 'a0000000-0000-0000-0000-000000000221'
where proximo_passo_acao = 'Follow-up da proposta enviada';

select is(
  (select status from public.negocios where etapa_id = 'a0000000-0000-0000-0000-000000000217'),
  'perdido',
  'mover pra etapa perdido com motivo junto marca o negócio como perdido'
);

-- ---------------------------------------------------------------------
-- marcar_negocio_ganho também move o card pra etapa especial, quando
-- existe uma no funil — fecha o gap na outra direção.
-- ---------------------------------------------------------------------
do $$
begin
  perform public.marcar_negocio_ganho(
    (select id from public.negocios where proximo_passo_acao = 'Renovação fechada — gerar vencimento')
  );
end;
$$;

select is(
  (select etapa_id from public.negocios where proximo_passo_acao = 'Renovação fechada — gerar vencimento'),
  'a0000000-0000-0000-0000-000000000216'::uuid,
  'marcar_negocio_ganho move o card pra etapa tipo=ganho quando ela existe'
);

select * from finish();
rollback;
