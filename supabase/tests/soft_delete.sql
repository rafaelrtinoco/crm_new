-- Redesenho do núcleo: soft delete deixa de depender de cada consulta
-- lembrar `.is("deleted_at", null)` — o filtro está na RLS de SELECT.
-- Como consequência direta disso (Postgres reaplica a USING da policy
-- de SELECT contra a linha nova em todo UPDATE — ver comentário longo em
-- `soft_delete_e_dedup.sql`), a própria exclusão deixa de ser um UPDATE
-- direto do cliente: passa a ser `excluir_registro`, simétrico a
-- `restaurar_registro`. Ambos usam a mesma regra de autorização que a
-- escrita normal já usava (`pode_acessar_responsavel`).
--
-- Cobre também a deduplicação de CPF/CNPJ (bloqueio) e o aviso por
-- telefone/e-mail (`buscar_possiveis_duplicatas`).

begin;
select no_plan();

set search_path = public, extensions;

set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000102", "email": "gestor@segurosalfa.test", "role": "authenticated"}';

-- ---------------------------------------------------------------------
-- Um UPDATE direto de deleted_at é barrado pela RLS — o soft delete
-- precisa passar por excluir_registro. É intencional, não um bug.
-- ---------------------------------------------------------------------
select throws_ok(
  $$ update public.contatos set deleted_at = now() where id = 'a0000000-0000-0000-0000-000000000304' $$,
  '42501',
  null,
  'UPDATE direto de deleted_at é barrado — precisa passar por excluir_registro'
);

-- Achado de revisão adversarial: a policy de DELETE (`contatos_delete`
-- etc.) só filtra quem pode apagar, não SE pode — sem revoke explícito,
-- um DELETE físico direto do cliente contornava o soft delete inteiro
-- (apagava a linha de verdade, cascateando, sem passar por
-- excluir_registro nem gerar audit_log).
select throws_ok(
  $$ delete from public.contatos where id = 'a0000000-0000-0000-0000-000000000304' $$,
  '42501',
  null,
  'DELETE físico direto também é barrado — nem gestor consegue apagar por fora de excluir_registro'
);

-- ---------------------------------------------------------------------
-- excluir_registro: gestor consegue, registra em audit_log, e o
-- registro fica invisível — mesmo pra ele.
-- ---------------------------------------------------------------------
select public.excluir_registro('contatos', 'a0000000-0000-0000-0000-000000000304');

select is(
  (select count(*) from public.contatos where id = 'a0000000-0000-0000-0000-000000000304'),
  0::bigint,
  'contato excluído via excluir_registro fica invisível mesmo pra gestor'
);

select is(
  (
    select count(*) from public.audit_log
    where entidade = 'contatos'
      and entidade_id = 'a0000000-0000-0000-0000-000000000304'
      and acao = 'excluir_registro'
  ),
  1::bigint,
  'excluir_registro registra em audit_log'
);

-- ---------------------------------------------------------------------
-- restaurar_registro: mesma regra de autorização, devolve a visibilidade.
-- ---------------------------------------------------------------------
select public.restaurar_registro('contatos', 'a0000000-0000-0000-0000-000000000304');

select is(
  (select count(*) from public.contatos where id = 'a0000000-0000-0000-0000-000000000304'),
  1::bigint,
  'restaurar_registro devolve a visibilidade do contato'
);

select is(
  (
    select count(*) from public.audit_log
    where entidade = 'contatos'
      and entidade_id = 'a0000000-0000-0000-0000-000000000304'
      and acao = 'restaurar_registro'
  ),
  1::bigint,
  'restaurar_registro registra em audit_log'
);

-- Achado de revisão adversarial: `uq_negocios_vencimento_aberto` não
-- filtrava `deleted_at` — excluir um negócio de renovação (que não muda
-- `status`) deixava a linha morta ocupando a vaga do vencimento pra
-- sempre, travando um negócio novo pro mesmo vencimento.
insert into public.negocios (empresa_id, contato_id, funil_id, etapa_id, vencimento_id, proximo_passo_em, proximo_passo_acao, responsavel_id)
values (
  'a0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000301',
  'a0000000-0000-0000-0000-000000000201',
  'a0000000-0000-0000-0000-000000000211',
  (select id from public.vencimentos where descricao = 'Seguro auto — Honda Civic'),
  current_date + 5, 'Ligar pra renovar', 'a0000000-0000-0000-0000-000000000102'
);

select public.excluir_registro(
  'negocios',
  (select id from public.negocios where proximo_passo_acao = 'Ligar pra renovar')
);

select lives_ok(
  $$
    insert into public.negocios (empresa_id, contato_id, funil_id, etapa_id, vencimento_id, proximo_passo_em, proximo_passo_acao, responsavel_id)
    values (
      'a0000000-0000-0000-0000-000000000001',
      'a0000000-0000-0000-0000-000000000301',
      'a0000000-0000-0000-0000-000000000201',
      'a0000000-0000-0000-0000-000000000211',
      (select id from public.vencimentos where descricao = 'Seguro auto — Honda Civic'),
      current_date + 6, 'Ligar pra renovar de novo', 'a0000000-0000-0000-0000-000000000102'
    )
  $$,
  'um novo negócio aberto pro mesmo vencimento é aceito depois que o anterior foi excluído'
);

-- Tabela fora da allow-list é rejeitada (defesa contra SQL dinâmico livre).
select throws_ok(
  $$ select public.excluir_registro('perfis', 'a0000000-0000-0000-0000-000000000101') $$,
  'P0001',
  'Tabela "perfis" não suporta exclusão',
  'excluir_registro recusa tabela fora da allow-list'
);

select throws_ok(
  $$ select public.restaurar_registro('perfis', 'a0000000-0000-0000-0000-000000000101') $$,
  'P0001',
  'Tabela "perfis" não suporta restauração',
  'restaurar_registro recusa tabela fora da allow-list'
);

-- ---------------------------------------------------------------------
-- Dedup: CPF/CNPJ repetido na mesma empresa é bloqueado (identificador
-- único de verdade); telefone e e-mail só avisam, via
-- buscar_possiveis_duplicatas — não bloqueiam.
-- ---------------------------------------------------------------------
select throws_ok(
  $$ insert into public.contatos (empresa_id, nome, cpf_cnpj) values ('a0000000-0000-0000-0000-000000000001', 'Duplicado', '529.982.247-25') $$,
  '23505',
  null,
  'não aceita dois contatos com o mesmo CPF/CNPJ na mesma empresa'
);

select is(
  (
    select count(*) from public.buscar_possiveis_duplicatas(
      'a0000000-0000-0000-0000-000000000001', '(11) 98888-0002', null, null
    )
  ),
  1::bigint,
  'buscar_possiveis_duplicatas encontra por telefone'
);

select is(
  (
    select motivo from public.buscar_possiveis_duplicatas(
      'a0000000-0000-0000-0000-000000000001', null, 'MARINA.SOUZA@exemplo.test', null
    )
  ),
  'email',
  'buscar_possiveis_duplicatas encontra por e-mail (case-insensitive) e informa o motivo'
);

-- ---------------------------------------------------------------------
-- Permissão: excluir_registro/restaurar_registro usam
-- pode_acessar_responsavel — um usuario comum que não é gestor, não tem
-- carteira compartilhada e não é o responsável não consegue nem excluir
-- nem restaurar o registro de outra pessoa.
-- ---------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000103", "email": "corretor@segurosalfa.test", "role": "authenticated"}';

-- Ricardo Lima (303) é responsabilidade do Gustavo, não da Carla.
select throws_ok(
  $$ select public.excluir_registro('contatos', 'a0000000-0000-0000-0000-000000000303') $$,
  'P0001',
  'Sem permissão para excluir este registro',
  'usuario comum não pode excluir um registro de outra pessoa'
);

select throws_ok(
  $$ select public.restaurar_registro('contatos', 'a0000000-0000-0000-0000-000000000303') $$,
  'P0001',
  'Sem permissão para restaurar este registro',
  'usuario comum não pode restaurar um registro de outra pessoa'
);

select * from finish();
rollback;
