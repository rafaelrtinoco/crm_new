-- Configurações da empresa — fatia 3 (Equipe). PRD §6.15/§5.2.
-- Ver docs/configuracoes/SPEC-configuracoes-equipe.md.

begin;
select no_plan();

set search_path = public, extensions;

-- ---------------------------------------------------------------------
-- Setup: um usuário extra ("Removido"), pra testar o ciclo
-- remover→reconvidar→reativar sem mexer nos três membros fixos do seed
-- (Ana dono, Gustavo gestor, Carla usuario, todos da Alfa).
-- ---------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000', 'e0000000-0000-0000-0000-000000000001',
  'authenticated', 'authenticated', 'removido@segurosalfa.test',
  crypt('facility123', gen_salt('bf')), now(), now(), now(),
  '{}', '{"nome":"Removido Depois"}', false, '', '', '', ''
);

insert into public.empresa_membros (empresa_id, usuario_id, papel, created_by)
values (
  'a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001',
  'usuario', 'a0000000-0000-0000-0000-000000000102'
);

-- ---------------------------------------------------------------------
-- Gestor (Gustavo) não escala privilégio: não promove ninguém a dono,
-- não mexe na linha do dono (Ana) de jeito nenhum.
-- ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000102", "email": "gestor@segurosalfa.test", "role": "authenticated"}';

select throws_ok(
  $$update public.empresa_membros set papel = 'dono'
    where empresa_id = 'a0000000-0000-0000-0000-000000000001' and usuario_id = 'a0000000-0000-0000-0000-000000000103'$$,
  'P0001',
  'Só o dono da empresa pode promover outro dono',
  'gestor não promove usuário comum a dono'
);

select throws_ok(
  $$update public.empresa_membros set papel = 'gestor'
    where empresa_id = 'a0000000-0000-0000-0000-000000000001' and usuario_id = 'a0000000-0000-0000-0000-000000000101'$$,
  'P0001',
  'Só o dono da empresa pode alterar outro dono',
  'gestor não demove o dono atual'
);

select throws_ok(
  $$update public.empresa_membros set deleted_at = now()
    where empresa_id = 'a0000000-0000-0000-0000-000000000001' and usuario_id = 'a0000000-0000-0000-0000-000000000101'$$,
  'P0001',
  'Só o dono da empresa pode alterar outro dono',
  'gestor não remove o dono atual'
);

-- ---------------------------------------------------------------------
-- Gestor continua livre pra mexer entre usuario/gestor normalmente —
-- prova que a guarda nova não quebrou o caminho que já funcionava.
-- ---------------------------------------------------------------------
select lives_ok(
  $$update public.empresa_membros set papel = 'gestor'
    where empresa_id = 'a0000000-0000-0000-0000-000000000001' and usuario_id = 'a0000000-0000-0000-0000-000000000103'$$,
  'gestor promove usuário comum a gestor normalmente'
);

select lives_ok(
  $$update public.empresa_membros set papel = 'usuario'
    where empresa_id = 'a0000000-0000-0000-0000-000000000001' and usuario_id = 'a0000000-0000-0000-0000-000000000103'$$,
  'gestor demove de volta pra usuário normalmente'
);

select lives_ok(
  $$update public.empresa_membros set deleted_at = now()
    where empresa_id = 'a0000000-0000-0000-0000-000000000001' and usuario_id = 'e0000000-0000-0000-0000-000000000001'$$,
  'gestor remove um membro não-dono normalmente'
);

-- ---------------------------------------------------------------------
-- Convites: só dono cria convite pra outro dono.
-- ---------------------------------------------------------------------
select throws_ok(
  $$insert into public.convites (empresa_id, email, papel, created_by)
    values ('a0000000-0000-0000-0000-000000000001', 'novo-dono@segurosalfa.test', 'dono', 'a0000000-0000-0000-0000-000000000102')$$,
  'P0001',
  'Só o dono da empresa pode convidar outro dono',
  'gestor não cria convite de dono'
);

-- Achado do security-check: um `before insert` sozinho não bastava —
-- gestor criava convite papel='usuario' (permitido) e tentava fazer
-- UPDATE pra 'dono' depois, sem trigger nenhum barrando. Cobrir UPDATE
-- também.
with novo as (
  insert into public.convites (empresa_id, email, papel, created_by)
  values ('a0000000-0000-0000-0000-000000000001', 'escalada@segurosalfa.test', 'usuario', 'a0000000-0000-0000-0000-000000000102')
  returning id
)
select id as convite_escalada_id into temporary convite_escalada_teste from novo;

select throws_ok(
  format($$update public.convites set papel = 'dono' where id = %L$$, (select convite_escalada_id from convite_escalada_teste)),
  'P0001',
  'Só o dono da empresa pode convidar outro dono',
  'gestor não consegue promover um convite já criado pra papel dono via UPDATE'
);

reset role;

-- Regressão do outro achado: gestor cancela (só muda `status`, nunca
-- `papel`) um convite que JÁ é `dono` de verdade (criado por um dono de
-- verdade) — não deveria exigir ser dono, é só housekeeping.
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000101", "email": "dono@segurosalfa.test", "role": "authenticated"}';

with novo as (
  insert into public.convites (empresa_id, email, papel, created_by)
  values ('a0000000-0000-0000-0000-000000000001', 'dono-p-cancelar@segurosalfa.test', 'dono', 'a0000000-0000-0000-0000-000000000101')
  returning id
)
select id as convite_dono_id into temporary convite_dono_teste from novo;

reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000102", "email": "gestor@segurosalfa.test", "role": "authenticated"}';

select lives_ok(
  format($$update public.convites set status = 'cancelado' where id = %L$$, (select convite_dono_id from convite_dono_teste)),
  'gestor cancela um convite de dono já existente sem precisar ser dono (não está mudando o papel)'
);

reset role;

-- ---------------------------------------------------------------------
-- Dono (Ana): é o único dono da Alfa agora — não pode se demover nem se
-- remover (ficaria zero donos).
-- ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000101", "email": "dono@segurosalfa.test", "role": "authenticated"}';

select throws_like(
  $$update public.empresa_membros set papel = 'gestor'
    where empresa_id = 'a0000000-0000-0000-0000-000000000001' and usuario_id = 'a0000000-0000-0000-0000-000000000101'$$,
  '%ao menos um dono%',
  'dono único não consegue se demover (ficaria sem dono)'
);

select throws_like(
  $$update public.empresa_membros set deleted_at = now()
    where empresa_id = 'a0000000-0000-0000-0000-000000000001' and usuario_id = 'a0000000-0000-0000-0000-000000000101'$$,
  '%ao menos um dono%',
  'dono único não consegue se remover (ficaria sem dono)'
);

-- Promove Gustavo a dono (segundo dono) — dono pode.
select lives_ok(
  $$update public.empresa_membros set papel = 'dono'
    where empresa_id = 'a0000000-0000-0000-0000-000000000001' and usuario_id = 'a0000000-0000-0000-0000-000000000102'$$,
  'dono promove um gestor a dono (segundo dono da empresa)'
);

-- Agora que há dois donos, Ana consegue se demover.
select lives_ok(
  $$update public.empresa_membros set papel = 'gestor'
    where empresa_id = 'a0000000-0000-0000-0000-000000000001' and usuario_id = 'a0000000-0000-0000-0000-000000000101'$$,
  'com dois donos, o primeiro consegue se demover'
);

reset role;

-- Dono (agora Gustavo, promovido acima) cria convite de dono —
-- permitido. Precisa trocar de sessão: os testes anteriores deste bloco
-- rodaram como Ana, que acabou de se demover a gestor.
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000102", "email": "gestor@segurosalfa.test", "role": "authenticated"}';

select lives_ok(
  $$insert into public.convites (empresa_id, email, papel, created_by)
    values ('a0000000-0000-0000-0000-000000000001', 'segundo-dono@segurosalfa.test', 'dono', 'a0000000-0000-0000-0000-000000000102')$$,
  'dono cria convite de dono normalmente'
);

reset role;

-- ---------------------------------------------------------------------
-- Regressão do achado 2 do spec: remover um membro, reconvidar o mesmo
-- e-mail, aceitar — reativa a MESMA linha (deleted_at volta a null,
-- papel atualizado pro do convite novo), não tenta inserir outra.
-- ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000102", "email": "gestor@segurosalfa.test", "role": "authenticated"}';

with novo as (
  insert into public.convites (empresa_id, email, papel, created_by)
  values ('a0000000-0000-0000-0000-000000000001', 'removido@segurosalfa.test', 'gestor', 'a0000000-0000-0000-0000-000000000102')
  returning token
)
select token as token_reconvite into temporary reconvite_teste from novo;

reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "e0000000-0000-0000-0000-000000000001", "email": "removido@segurosalfa.test", "role": "authenticated"}';

select lives_ok(
  format($$select public.aceitar_convite(%L)$$, (select token_reconvite from reconvite_teste)),
  'membro removido reaceita convite novo sem erro'
);

reset role;

select is(
  (select count(*) from public.empresa_membros
    where empresa_id = 'a0000000-0000-0000-0000-000000000001' and usuario_id = 'e0000000-0000-0000-0000-000000000001'),
  1::bigint,
  'reativação usa a MESMA linha — não duplica'
);

select is(
  (select deleted_at from public.empresa_membros
    where empresa_id = 'a0000000-0000-0000-0000-000000000001' and usuario_id = 'e0000000-0000-0000-0000-000000000001'),
  null::timestamptz,
  'membro reativado volta a ter deleted_at nulo'
);

select is(
  (select papel from public.empresa_membros
    where empresa_id = 'a0000000-0000-0000-0000-000000000001' and usuario_id = 'e0000000-0000-0000-0000-000000000001'),
  'gestor',
  'membro reativado assume o papel do convite novo (gestor, não mais usuario)'
);

-- ---------------------------------------------------------------------
-- Isolamento: dono da Beta não altera empresa_membros da Alfa — RLS
-- (`tem_papel` exige ser membro) filtra a linha, sem lançar exceção.
-- ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "b0000000-0000-0000-0000-000000000101", "email": "dono@segurosbeta.test", "role": "authenticated"}';

select lives_ok(
  $$update public.empresa_membros set papel = 'dono'
    where empresa_id = 'a0000000-0000-0000-0000-000000000001' and usuario_id = 'a0000000-0000-0000-0000-000000000103'$$,
  'UPDATE do dono da Beta não lança exceção — RLS só filtra a linha'
);

reset role;

select isnt(
  (select papel from public.empresa_membros
    where empresa_id = 'a0000000-0000-0000-0000-000000000001' and usuario_id = 'a0000000-0000-0000-0000-000000000103'),
  'dono',
  'dono da Beta não conseguiu alterar papel de ninguém na Alfa'
);

select * from finish();
rollback;
