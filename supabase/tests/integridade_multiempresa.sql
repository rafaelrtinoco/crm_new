-- Redesenho do núcleo: chaves compostas (empresa_id, <fk>) impedem
-- gravar uma linha da empresa A apontando pra funil/etapa/contato/
-- responsável da empresa B — antes disso era só uma FK simples pra
-- `funis(id)` etc., sem checar se o alvo era da mesma empresa da linha.
--
-- Age como Gustavo (gestor, Alfa) de propósito: `pode_acessar_responsavel`
-- libera qualquer `responsavel_id` pra gestor+, então a RLS por si só
-- NÃO bloquearia estas tentativas — é a FK composta que precisa barrar,
-- não a policy. Isolando assim, o teste prova a coisa certa.

begin;
select no_plan();

set search_path = public, extensions;

-- Setup ad hoc como superuser (bypassa RLS) — organização da Beta, usada
-- só pelo teste de organizacao_id cruzado lá embaixo.
insert into public.organizacoes (id, empresa_id, nome, responsavel_id) values
  ('b0000000-0000-0000-0000-000000000401', 'b0000000-0000-0000-0000-000000000001', 'Mercado Beta Ltda', 'b0000000-0000-0000-0000-000000000101');

set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000102", "email": "gestor@segurosalfa.test", "role": "authenticated"}';

-- ---------------------------------------------------------------------
-- negocios: funil_id, etapa_id, contato_id e motivo_perda_id de outra
-- empresa são rejeitados pela FK composta, não só "invisíveis".
-- ---------------------------------------------------------------------
select throws_ok(
  $$
    insert into public.negocios (empresa_id, contato_id, funil_id, etapa_id, proximo_passo_em, proximo_passo_acao, responsavel_id)
    values (
      'a0000000-0000-0000-0000-000000000001',
      'a0000000-0000-0000-0000-000000000301',
      'b0000000-0000-0000-0000-000000000201',
      'a0000000-0000-0000-0000-000000000211',
      current_date, 'invasão via funil_id', 'a0000000-0000-0000-0000-000000000102'
    )
  $$,
  '23503',
  null,
  'negócio da Alfa não aceita funil_id da Beta'
);

select throws_ok(
  $$
    insert into public.negocios (empresa_id, contato_id, funil_id, etapa_id, proximo_passo_em, proximo_passo_acao, responsavel_id)
    values (
      'a0000000-0000-0000-0000-000000000001',
      'a0000000-0000-0000-0000-000000000301',
      'a0000000-0000-0000-0000-000000000201',
      'b0000000-0000-0000-0000-000000000211',
      current_date, 'invasão via etapa_id', 'a0000000-0000-0000-0000-000000000102'
    )
  $$,
  '23503',
  null,
  'negócio da Alfa não aceita etapa_id da Beta'
);

select throws_ok(
  $$
    insert into public.negocios (empresa_id, contato_id, funil_id, etapa_id, proximo_passo_em, proximo_passo_acao, responsavel_id)
    values (
      'a0000000-0000-0000-0000-000000000001',
      'b0000000-0000-0000-0000-000000000301',
      'a0000000-0000-0000-0000-000000000201',
      'a0000000-0000-0000-0000-000000000211',
      current_date, 'invasão via contato_id', 'a0000000-0000-0000-0000-000000000102'
    )
  $$,
  '23503',
  null,
  'negócio da Alfa não aceita contato_id da Beta'
);

select throws_ok(
  $$
    update public.negocios
    set motivo_perda_id = 'b0000000-0000-0000-0000-000000000221'
    where proximo_passo_acao = 'Sem retorno após 3 tentativas'
  $$,
  '23503',
  null,
  'negócio da Alfa não aceita motivo_perda_id da Beta'
);

-- ---------------------------------------------------------------------
-- responsavel_id só aceita quem tem crachá da empresa (empresa_membros).
-- ---------------------------------------------------------------------
select throws_ok(
  $$
    insert into public.contatos (empresa_id, nome, responsavel_id)
    values ('a0000000-0000-0000-0000-000000000001', 'Invasor via responsável', 'b0000000-0000-0000-0000-000000000101')
  $$,
  '23503',
  null,
  'contato da Alfa não aceita responsavel_id de quem só é membro da Beta'
);

select throws_ok(
  $$
    insert into public.contatos (empresa_id, nome, responsavel_id)
    values ('a0000000-0000-0000-0000-000000000001', 'Invasor via responsável inexistente', gen_random_uuid())
  $$,
  '23503',
  null,
  'contato da Alfa não aceita responsavel_id de um usuário que não existe'
);

-- Sanidade: responsavel_id nulo continua opcional (MATCH SIMPLE não
-- checa a FK composta quando uma das colunas é nula).
select lives_ok(
  $$
    insert into public.contatos (empresa_id, nome, responsavel_id)
    values ('a0000000-0000-0000-0000-000000000001', 'Contato sem responsável', null)
  $$,
  'contato sem responsável (null) continua permitido — FK composta não bloqueia nulo'
);

-- Sanidade: dentro da própria empresa, tudo continua funcionando normal.
select lives_ok(
  $$
    insert into public.negocios (empresa_id, contato_id, funil_id, etapa_id, proximo_passo_em, proximo_passo_acao, responsavel_id)
    values (
      'a0000000-0000-0000-0000-000000000001',
      'a0000000-0000-0000-0000-000000000301',
      'a0000000-0000-0000-0000-000000000201',
      'a0000000-0000-0000-0000-000000000211',
      current_date, 'negócio legítimo dentro da própria empresa', 'a0000000-0000-0000-0000-000000000102'
    )
  $$,
  'negócio com funil/etapa/contato/responsável todos da mesma empresa é aceito normalmente'
);

-- ---------------------------------------------------------------------
-- Achado de revisão adversarial: a FK composta por empresa garante que
-- etapa_id é da MESMA EMPRESA, mas não do MESMO FUNIL do negócio — dava
-- pra misturar etapa do funil "Renovação" num negócio do funil "Venda
-- nova", dentro da mesma empresa.
-- ---------------------------------------------------------------------
insert into public.etapas (id, empresa_id, funil_id, nome, ordem) values
  ('a0000000-0000-0000-0000-000000000291', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000202', 'A contatar', 1);

select throws_ok(
  $$
    insert into public.negocios (empresa_id, contato_id, funil_id, etapa_id, proximo_passo_em, proximo_passo_acao, responsavel_id)
    values (
      'a0000000-0000-0000-0000-000000000001',
      'a0000000-0000-0000-0000-000000000301',
      'a0000000-0000-0000-0000-000000000201',
      'a0000000-0000-0000-0000-000000000291',
      current_date, 'etapa de outro funil, mesma empresa', 'a0000000-0000-0000-0000-000000000102'
    )
  $$,
  '23503',
  null,
  'negócio do funil "Venda nova" não aceita etapa do funil "Renovação", mesmo sendo a mesma empresa'
);

-- ---------------------------------------------------------------------
-- organizacoes: mesma proteção, sendo entidade nova.
-- ---------------------------------------------------------------------
insert into public.organizacoes (id, empresa_id, nome, responsavel_id) values
  ('a0000000-0000-0000-0000-000000000401', 'a0000000-0000-0000-0000-000000000001', 'Padaria Alfa Ltda', 'a0000000-0000-0000-0000-000000000102');

select throws_ok(
  $$
    update public.contatos
    set organizacao_id = 'b0000000-0000-0000-0000-000000000401'
    where id = 'a0000000-0000-0000-0000-000000000301'
  $$,
  '23503',
  null,
  'contato da Alfa não aceita organizacao_id da Beta'
);

select lives_ok(
  $$
    update public.contatos
    set organizacao_id = 'a0000000-0000-0000-0000-000000000401'
    where id = 'a0000000-0000-0000-0000-000000000301'
  $$,
  'contato aceita organizacao_id da própria empresa'
);

select * from finish();
rollback;
