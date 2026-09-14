-- importacao_erros_insert_membro (1C-3): membro insere erro de
-- importação na própria empresa; ninguém de fora consegue.

begin;
select no_plan();

set search_path = public, extensions;

insert into public.importacoes (id, empresa_id, arquivo_nome, created_by) values
  ('e0000000-0000-0000-0000-000000000201', 'a0000000-0000-0000-0000-000000000001', 'clientes.csv', 'a0000000-0000-0000-0000-000000000101');

set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000103", "email": "corretor@segurosalfa.test", "role": "authenticated"}';

with erro as (
  insert into public.importacao_erros (empresa_id, importacao_id, linha, erro)
  values ('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000201', 3, 'CPF inválido')
  returning id
)
select is((select count(*) from erro), 1::bigint, 'membro insere erro de importação na própria empresa');

select throws_ok(
  $$
    insert into public.importacao_erros (empresa_id, importacao_id, linha, erro)
    values ('b0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000201', 1, 'tentativa alheia')
  $$,
  '42501',
  null,
  'não consegue inserir erro de importação em outra empresa'
);

select * from finish();
rollback;
