-- Funis de venda (PRD §6.5): entrou_na_etapa_em reage à troca de etapa,
-- marcar_negocio_ganho/marcar_negocio_perdido e o isolamento entre empresas.

begin;
select no_plan();

set search_path = public, extensions;

-- Gestor (não corretor) porque os negócios de teste têm responsáveis
-- variados (Carla e Ricardo) — pode_acessar_responsavel só libera pra
-- quem não é dono do negócio se for gestor+ ou carteira compartilhada.
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000102", "email": "gestor@segurosalfa.test", "role": "authenticated"}';

-- ---------------------------------------------------------------------
-- entrou_na_etapa_em: reseta quando a etapa muda, não mexe no resto.
-- ---------------------------------------------------------------------

-- "Sem retorno após 3 tentativas" (Ricardo) — update que não toca etapa_id.
with antes as (
  select entrou_na_etapa_em from public.negocios
  where proximo_passo_acao = 'Sem retorno após 3 tentativas'
),
depois as (
  update public.negocios set valor_estimado = 900.00
  where proximo_passo_acao = 'Sem retorno após 3 tentativas'
  returning entrou_na_etapa_em
)
select is(
  (select entrou_na_etapa_em from depois),
  (select entrou_na_etapa_em from antes),
  'update que não muda etapa_id não mexe em entrou_na_etapa_em'
);

-- "Follow-up da proposta enviada" (Fernanda) — move de etapa, deve resetar.
with movido as (
  update public.negocios set etapa_id = 'a0000000-0000-0000-0000-000000000215'
  where proximo_passo_acao = 'Follow-up da proposta enviada'
  returning entrou_na_etapa_em
)
select ok(
  (select entrou_na_etapa_em from movido) > now() - interval '5 seconds',
  'mudar etapa_id reseta entrou_na_etapa_em pra agora'
);

-- ---------------------------------------------------------------------
-- marcar_negocio_ganho: fecha o negócio e promove o contato a cliente.
-- ---------------------------------------------------------------------

do $$
begin
  perform public.marcar_negocio_ganho(
    (select id from public.negocios where proximo_passo_acao = 'Ligar para apresentar cotação')
  );
end;
$$;

select is(
  (select status from public.negocios where proximo_passo_acao = 'Ligar para apresentar cotação'),
  'ganho',
  'marcar_negocio_ganho fecha o negócio como ganho'
);

select is(
  (select status from public.contatos where id = 'a0000000-0000-0000-0000-000000000302'),
  'cliente',
  'marcar_negocio_ganho promove o contato (Marina) a cliente'
);

-- ---------------------------------------------------------------------
-- marcar_negocio_perdido: motivo + reativar_em cria tarefa futura.
-- ---------------------------------------------------------------------

do $$
begin
  perform public.marcar_negocio_perdido(
    (select id from public.negocios where proximo_passo_acao = 'Follow-up da proposta enviada'),
    'a0000000-0000-0000-0000-000000000221',
    current_date + 30
  );
end;
$$;

select is(
  (select status from public.negocios where proximo_passo_acao = 'Follow-up da proposta enviada'),
  'perdido',
  'marcar_negocio_perdido fecha o negócio como perdido'
);

select is(
  (select motivo_perda_id from public.negocios where proximo_passo_acao = 'Follow-up da proposta enviada'),
  'a0000000-0000-0000-0000-000000000221'::uuid,
  'marcar_negocio_perdido grava o motivo informado'
);

select is(
  (
    select count(*) from public.tarefas
    where contato_id = 'a0000000-0000-0000-0000-000000000304'
      and data_vencimento = current_date + 30
      and tipo = 'outro'
  ),
  1::bigint,
  'reativar_em cria a tarefa futura de reativação'
);

-- Perdido sem motivo é barrado pelo check negocios_perdido_tem_motivo,
-- independentemente de como se tenta escrever (aqui: update direto).
select throws_ok(
  $$
    update public.negocios set status = 'perdido', motivo_perda_id = null
    where proximo_passo_acao = 'Renovação fechada — gerar vencimento'
  $$,
  '23514',
  null,
  'não permite marcar perdido sem motivo (check negocios_perdido_tem_motivo)'
);

-- ---------------------------------------------------------------------
-- Isolamento: Carla (Alfa) não alcança negócio da Beta.
-- ---------------------------------------------------------------------

select throws_ok(
  $$ select public.marcar_negocio_ganho(
    (select id from public.negocios where proximo_passo_acao = 'Enviar cotação por WhatsApp')
  ) $$,
  'P0001',
  'Negócio não encontrado',
  'não consegue marcar como ganho um negócio de outra empresa (nem enxerga pra existir)'
);

select throws_ok(
  $$ select public.marcar_negocio_perdido(
    (select id from public.negocios where proximo_passo_acao = 'Enviar cotação por WhatsApp'),
    'a0000000-0000-0000-0000-000000000221',
    null
  ) $$,
  'P0001',
  'Negócio não encontrado',
  'não consegue marcar como perdido um negócio de outra empresa (nem enxerga pra existir)'
);

select * from finish();
rollback;
