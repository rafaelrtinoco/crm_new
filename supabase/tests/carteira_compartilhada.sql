-- Carteira compartilhada (PRD §5.2): sem ela, o papel "usuario" só vê o
-- que é seu; gestor/dono sempre veem tudo; com carteira compartilhada
-- ligada, "usuario" também vê tudo da empresa.

begin;
select no_plan();

set search_path = public, extensions;

-- Empresa Beta já nasce com carteira_compartilhada = true (seed.sql).
-- Precisamos de um segundo usuário "comum" nela pra testar o efeito —
-- o único membro do seed é o dono.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000199',
  'authenticated', 'authenticated', 'usuario.teste@segurosbeta.test',
  crypt('facility123', gen_salt('bf')), now(), now(), now(),
  '{"provider":"email","providers":["email"]}', '{"nome":"Usuário Teste"}', false, '', '', '', ''
);

insert into public.empresa_membros (empresa_id, usuario_id, papel)
values ('b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000199', 'usuario');

-- ---------------------------------------------------------------------
-- Empresa Alfa (carteira_compartilhada = false): Carla (usuario) só
-- vê os contatos sob sua responsabilidade.
-- ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000103", "role": "authenticated"}';

select is(
  (select count(*) from public.contatos where empresa_id = 'a0000000-0000-0000-0000-000000000001'),
  3::bigint,
  'Carla (usuario, sem carteira compartilhada) vê só os 3 contatos dela'
);
select is(
  (select count(*) from public.contatos where id = 'a0000000-0000-0000-0000-000000000303'),
  0::bigint,
  'Carla não vê o contato que é do Gustavo (gestor)'
);

reset request.jwt.claims;

-- Gustavo (gestor, Alfa) vê todos os contatos da empresa, papel > carteira.
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000102", "role": "authenticated"}';
select is(
  (select count(*) from public.contatos where empresa_id = 'a0000000-0000-0000-0000-000000000001'),
  4::bigint,
  'Gustavo (gestor) vê todos os contatos da empresa, independente do responsável'
);

reset request.jwt.claims;

-- ---------------------------------------------------------------------
-- Empresa Beta (carteira_compartilhada = true): o usuário comum recém
-- criado, que não é responsável por nenhum contato, vê todos mesmo assim.
-- ---------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "b0000000-0000-0000-0000-000000000199", "role": "authenticated"}';
select is(
  (select count(*) from public.contatos where empresa_id = 'b0000000-0000-0000-0000-000000000001'),
  2::bigint,
  'usuario comum na empresa Beta vê todos os contatos por causa da carteira compartilhada'
);
select is(
  (select count(*) from public.contatos where empresa_id = 'a0000000-0000-0000-0000-000000000001'),
  0::bigint,
  'carteira compartilhada da Beta não vaza contatos da Alfa'
);

select * from finish();
rollback;
