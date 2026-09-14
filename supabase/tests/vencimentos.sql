-- renovar_vencimento (PRD §6.4): fecha o vencimento atual como
-- 'renovado' e cria o próximo já 'pendente', na mesma transação.

begin;
select no_plan();

set search_path = public, extensions;

set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000103", "email": "corretor@segurosalfa.test", "role": "authenticated"}';

-- "Seguro auto — Honda Civic" é do seed: contato 301, responsável Carla (103).
-- DO block só pra descartar o retorno sem jogar uma linha de resultado
-- solta no stream de saída (quebraria o parser de TAP do pg_prove).
do $$
begin
  perform public.renovar_vencimento(
    (select id from public.vencimentos where descricao = 'Seguro auto — Honda Civic'),
    current_date + 365,
    2600.00,
    null
  );
end;
$$;

-- Depois da renovação existem duas linhas com essa descrição (a
-- função copia descricao pro novo vencimento, de propósito) — usa o
-- valor original (2400.00, do seed.sql) pra mirar só na linha antiga.
select is(
  (select status from public.vencimentos where descricao = 'Seguro auto — Honda Civic' and valor = 2400.00),
  'renovado',
  'vencimento original vira status renovado'
);

select is(
  (select count(*) from public.vencimentos where valor = 2600.00 and status = 'pendente'),
  1::bigint,
  'vencimento novo nasce pendente com o valor informado'
);

select is(
  (select data_vencimento from public.vencimentos where valor = 2600.00 and status = 'pendente'),
  (current_date + 365)::date,
  'vencimento novo usa a data informada'
);

select is(
  (select contato_id from public.vencimentos where valor = 2600.00 and status = 'pendente'),
  'a0000000-0000-0000-0000-000000000301'::uuid,
  'vencimento novo mantém o mesmo contato do original'
);

-- Isolamento: Carla (Alfa) não consegue renovar um vencimento da Beta.
select throws_ok(
  $$
    select public.renovar_vencimento(
      (select id from public.vencimentos where descricao = 'Seguro auto — Onix'),
      current_date + 365,
      null,
      null
    )
  $$,
  'P0001',
  'Vencimento não encontrado',
  'não consegue renovar vencimento de outra empresa (nem enxerga pra existir)'
);

select * from finish();
rollback;
