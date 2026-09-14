-- plataforma_admins não tem empresa_id (é papel de plataforma, não de
-- tenant — ver migration 20260910200250_plataforma.sql). O isolamento
-- aqui é por linha própria, não por empresa.

begin;
select no_plan();

set search_path = public, extensions;

insert into public.plataforma_admins (id, usuario_id)
values ('f0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000101');

set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000101", "role": "authenticated"}';

select is((select count(*) from public.plataforma_admins), 1::bigint, 'admin vê a própria linha em plataforma_admins');

reset request.jwt.claims;
set local request.jwt.claims = '{"sub": "b0000000-0000-0000-0000-000000000101", "role": "authenticated"}';

select is((select count(*) from public.plataforma_admins), 0::bigint, 'usuário comum não vê a linha de admin de outra pessoa');

select throws_ok(
  $$ insert into public.plataforma_admins (usuario_id) values ('b0000000-0000-0000-0000-000000000101') $$,
  '42501',
  null,
  'usuário comum não consegue se autopromover a admin de plataforma'
);

select * from finish();
rollback;
