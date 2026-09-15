-- Onboarding (1B): perfis, aceitar_convite e criar_empresa_com_onboarding.
-- Setup como superuser (bypassa RLS); asserções como os usuários de teste
-- via `set local role authenticated` + `request.jwt.claims`.

begin;
select no_plan();

set search_path = public, extensions;

-- ---------------------------------------------------------------------
-- Setup: convite pendente, expirado e cancelado na empresa Alfa; dois
-- usuários novos (um com o e-mail certo pro convite, outro com e-mail
-- diferente) e um terceiro usuário sem empresa nenhuma ainda.
-- ---------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'novofuncionario@segurosalfa.test', crypt('facility123', gen_salt('bf')), now(), now(), now(), '{}', '{"nome":"Novo Funcionário"}', false, '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'pessoa.errada@example.test', crypt('facility123', gen_salt('bf')), now(), now(), now(), '{}', '{"nome":"Pessoa Errada"}', false, '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'fundador@nova-empresa.test', crypt('facility123', gen_salt('bf')), now(), now(), now(), '{}', '{"nome":"Fundador Novo"}', false, '', '', '', '');

insert into public.convites (id, empresa_id, email, papel, token, status, created_by) values
  ('d0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000001', 'novofuncionario@segurosalfa.test', 'usuario', 'd0000000-0000-0000-0000-000000000111', 'pendente', 'a0000000-0000-0000-0000-000000000102'),
  ('d0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000001', 'expirado@segurosalfa.test', 'usuario', 'd0000000-0000-0000-0000-000000000112', 'pendente', 'a0000000-0000-0000-0000-000000000102'),
  ('d0000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000001', 'cancelado@segurosalfa.test', 'usuario', 'd0000000-0000-0000-0000-000000000113', 'cancelado', 'a0000000-0000-0000-0000-000000000102');

update public.convites set expira_em = now() - interval '1 day' where id = 'd0000000-0000-0000-0000-000000000012';

-- ---------------------------------------------------------------------
-- perfis: criados automaticamente pelo trigger em auth.users (dispara
-- inclusive nos inserts do seed.sql e nos de cima).
-- ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000103", "email": "corretor@segurosalfa.test", "role": "authenticated"}';

select is((select count(*) from public.perfis where id = 'a0000000-0000-0000-0000-000000000103'), 1::bigint, 'usuário sempre vê o próprio perfil');
select is((select count(*) from public.perfis where id = 'a0000000-0000-0000-0000-000000000102'), 1::bigint, 'vê perfil de colega da mesma empresa (Gustavo, gestor da Alfa)');
select is((select count(*) from public.perfis where id = 'b0000000-0000-0000-0000-000000000101'), 0::bigint, 'não vê perfil de quem só está na empresa Beta');

reset request.jwt.claims;

-- ---------------------------------------------------------------------
-- aceitar_convite
-- ---------------------------------------------------------------------

-- E-mail errado: convite é da Alfa pra "novofuncionario@...", mas quem
-- está logado é "pessoa.errada@...".
set local request.jwt.claims = '{"sub": "d0000000-0000-0000-0000-000000000002", "email": "pessoa.errada@example.test", "role": "authenticated"}';
select throws_ok(
  $$ select public.aceitar_convite('d0000000-0000-0000-0000-000000000111') $$,
  'P0001',
  'Este convite foi enviado para outro e-mail',
  'e-mail que não bate com o convite é rejeitado'
);

reset request.jwt.claims;
set local request.jwt.claims = '{"sub": "d0000000-0000-0000-0000-000000000001", "email": "novofuncionario@segurosalfa.test", "role": "authenticated"}';

select throws_ok(
  $$ select public.aceitar_convite('d0000000-0000-0000-0000-000000000112') $$,
  'P0001',
  'Convite inválido, expirado ou já utilizado',
  'convite expirado é rejeitado'
);
select throws_ok(
  $$ select public.aceitar_convite('00000000-0000-0000-0000-000000000000') $$,
  'P0001',
  'Convite inválido, expirado ou já utilizado',
  'token inexistente é rejeitado'
);

select is(
  public.aceitar_convite('d0000000-0000-0000-0000-000000000111'),
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'aceitar convite válido retorna o id da empresa'
);
select is(
  (select papel from public.empresa_membros where empresa_id = 'a0000000-0000-0000-0000-000000000001' and usuario_id = 'd0000000-0000-0000-0000-000000000001'),
  'usuario',
  'aceite cria empresa_membros com o papel do convite'
);

-- Checa o status como o gestor que convidou: quem acabou de aceitar tem
-- papel 'usuario' e não enxerga convites (RLS de 1A: só gestor+ vê).
reset request.jwt.claims;
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000102", "email": "gestor@segurosalfa.test", "role": "authenticated"}';
select is(
  (select status from public.convites where id = 'd0000000-0000-0000-0000-000000000011'),
  'aceito',
  'aceite marca o convite como aceito'
);
reset request.jwt.claims;
set local request.jwt.claims = '{"sub": "d0000000-0000-0000-0000-000000000001", "email": "novofuncionario@segurosalfa.test", "role": "authenticated"}';

select throws_ok(
  $$ select public.aceitar_convite('d0000000-0000-0000-0000-000000000111') $$,
  'P0001',
  'Convite inválido, expirado ou já utilizado',
  'aceitar o mesmo token duas vezes falha na segunda (não está mais pendente)'
);

reset request.jwt.claims;

-- ---------------------------------------------------------------------
-- criar_empresa_com_onboarding
-- ---------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "d0000000-0000-0000-0000-000000000003", "email": "fundador@nova-empresa.test", "role": "authenticated"}';

select throws_ok(
  $$ select public.criar_empresa_com_onboarding('Nova Corretora', 'corretora', false) $$,
  'P0001',
  'É preciso aceitar os Termos de Uso e a Política de Privacidade',
  'sem aceitar os termos, não cria empresa'
);

select is(
  (select count(*) from public.empresa_membros where usuario_id = 'd0000000-0000-0000-0000-000000000003'),
  0::bigint,
  'nenhuma empresa foi criada na tentativa sem aceite'
);

select isnt(
  public.criar_empresa_com_onboarding('Nova Corretora', 'corretora', true),
  null,
  'criar empresa com aceite dos termos retorna um id'
);

select is(
  (select papel from public.empresa_membros where usuario_id = 'd0000000-0000-0000-0000-000000000003'),
  'dono',
  'quem cria a empresa vira dono'
);

select is(
  (
    select count(*) from public.vencimento_tipos vt
    join public.empresa_membros em on em.empresa_id = vt.empresa_id
    where em.usuario_id = 'd0000000-0000-0000-0000-000000000003' and em.papel = 'dono'
  ),
  9::bigint,
  'aplicar_template populou os 9 tipos de vencimento da corretora'
);
select is(
  (
    select count(*) from public.funis f
    join public.empresa_membros em on em.empresa_id = f.empresa_id
    where em.usuario_id = 'd0000000-0000-0000-0000-000000000003' and em.papel = 'dono'
  ),
  2::bigint,
  'aplicar_template populou os 2 funis (venda nova + renovação)'
);
select is(
  (
    select count(*) from public.etapas e
    join public.funis f on f.id = e.funil_id
    join public.empresa_membros em on em.empresa_id = f.empresa_id
    where em.usuario_id = 'd0000000-0000-0000-0000-000000000003' and em.papel = 'dono'
  ),
  12::bigint,
  'aplicar_template populou as 12 etapas (7 + 5) dos dois funis'
);
-- Achado de revisão adversarial: aplicar_template criava as etapas
-- "Ganho"/"Perdido"/"Renovado"/"Não renovado" sempre com `tipo =
-- 'normal'` (default) — o trigger que sincroniza status por etapa nunca
-- tinha uma etapa especial de verdade pra agir. Prova que agora tem.
select is(
  (
    select e.tipo from public.etapas e
    join public.funis f on f.id = e.funil_id
    join public.empresa_membros em on em.empresa_id = f.empresa_id
    where em.usuario_id = 'd0000000-0000-0000-0000-000000000003'
      and f.tipo = 'venda_nova' and e.nome = 'Ganho'
  ),
  'ganho',
  'aplicar_template marca a etapa "Ganho" do funil de venda nova com tipo=ganho'
);
select is(
  (
    select e.tipo from public.etapas e
    join public.funis f on f.id = e.funil_id
    join public.empresa_membros em on em.empresa_id = f.empresa_id
    where em.usuario_id = 'd0000000-0000-0000-0000-000000000003'
      and f.tipo = 'venda_nova' and e.nome = 'Perdido'
  ),
  'perdido',
  'aplicar_template marca a etapa "Perdido" do funil de venda nova com tipo=perdido'
);
select is(
  (
    select e.tipo from public.etapas e
    join public.funis f on f.id = e.funil_id
    join public.empresa_membros em on em.empresa_id = f.empresa_id
    where em.usuario_id = 'd0000000-0000-0000-0000-000000000003'
      and f.tipo = 'renovacao' and e.nome = 'Renovado'
  ),
  'ganho',
  'aplicar_template marca a etapa "Renovado" do funil de renovação com tipo=ganho'
);
select is(
  (
    select count(*) from public.etapas e
    join public.funis f on f.id = e.funil_id
    join public.empresa_membros em on em.empresa_id = f.empresa_id
    where em.usuario_id = 'd0000000-0000-0000-0000-000000000003' and e.tipo = 'normal'
  ),
  8::bigint,
  'as demais 8 etapas (12 - 2 pares de etapa especial) continuam tipo=normal'
);
select is(
  (
    select count(*) from public.motivos_perda mp
    join public.empresa_membros em on em.empresa_id = mp.empresa_id
    where em.usuario_id = 'd0000000-0000-0000-0000-000000000003' and em.papel = 'dono'
  ),
  5::bigint,
  'aplicar_template populou os 5 motivos de perda'
);
select is(
  (
    select count(*) from public.audit_log al
    join public.empresa_membros em on em.empresa_id = al.empresa_id
    where em.usuario_id = 'd0000000-0000-0000-0000-000000000003' and em.papel = 'dono' and al.acao = 'aceite_termos'
  ),
  1::bigint,
  'aceite dos termos fica registrado no audit_log'
);

-- Isolamento: a empresa nova não vaza pra quem já existia, e vice-versa.
select is(
  (select count(*) from public.contatos where empresa_id in (select empresa_id from public.empresa_membros where usuario_id = 'd0000000-0000-0000-0000-000000000003')),
  0::bigint,
  'a empresa recém-criada não vê os contatos do seed (Alfa/Beta)'
);

reset request.jwt.claims;
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000103", "email": "corretor@segurosalfa.test", "role": "authenticated"}';

select is(
  (
    select count(*) from public.funis f
    join public.empresa_membros em on em.empresa_id = f.empresa_id
    where em.usuario_id = 'd0000000-0000-0000-0000-000000000003'
  ),
  0::bigint,
  'Carla (Alfa) não vê os funis da empresa recém-criada por outro dono'
);

select * from finish();
rollback;
