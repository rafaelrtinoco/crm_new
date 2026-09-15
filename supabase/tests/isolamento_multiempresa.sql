-- Isolamento entre empresas: para toda tabela com empresa_id, um usuário
-- da empresa Alfa não pode ler nem alterar dados da empresa Beta (e
-- vice-versa). Este é o teste "portão" da regra de ouro do projeto —
-- se algo aqui falhar, a tabela não está pronta.
--
-- Setup (como superuser, bypassa RLS) cria uma linha ad-hoc por empresa
-- nas tabelas que o seed.sql ainda não populou. Tudo roda em uma
-- transação e é desfeito no final (rollback).

begin;
select no_plan();

set search_path = public, extensions;

-- ---------------------------------------------------------------------
-- Setup: linhas ad-hoc para tabelas sem dado no seed.sql.
-- ---------------------------------------------------------------------
insert into public.convites (id, empresa_id, email, papel, created_by) values
  ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'novo@segurosalfa.test', 'usuario', 'a0000000-0000-0000-0000-000000000101'),
  ('e0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'novo@segurosbeta.test', 'usuario', 'b0000000-0000-0000-0000-000000000101');

insert into public.campos_personalizados (id, empresa_id, entidade, chave, rotulo, tipo, created_by) values
  ('e0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000001', 'contato', 'profissao', 'Profissão', 'texto', 'a0000000-0000-0000-0000-000000000101'),
  ('e0000000-0000-0000-0000-000000000012', 'b0000000-0000-0000-0000-000000000001', 'contato', 'profissao', 'Profissão', 'texto', 'b0000000-0000-0000-0000-000000000101');

insert into public.contato_tags (id, empresa_id, contato_id, tag_id, created_by) values
  ('e0000000-0000-0000-0000-000000000021', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000301', 'a0000000-0000-0000-0000-000000000241', 'a0000000-0000-0000-0000-000000000101'),
  ('e0000000-0000-0000-0000-000000000022', 'b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000301', 'b0000000-0000-0000-0000-000000000241', 'b0000000-0000-0000-0000-000000000101');

insert into public.atividades (id, empresa_id, contato_id, tipo, conteudo, responsavel_id, created_by) values
  ('e0000000-0000-0000-0000-000000000031', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000301', 'nota', '{"texto": "Cliente pediu retorno em 2 dias"}'::jsonb, 'a0000000-0000-0000-0000-000000000103', 'a0000000-0000-0000-0000-000000000103'),
  ('e0000000-0000-0000-0000-000000000032', 'b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000301', 'nota', '{"texto": "Aguardando documentação"}'::jsonb, 'b0000000-0000-0000-0000-000000000101', 'b0000000-0000-0000-0000-000000000101');

insert into public.consentimentos (id, empresa_id, contato_id, finalidade, concedido, canal, created_by) values
  ('e0000000-0000-0000-0000-000000000041', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000301', 'marketing', true, 'whatsapp', 'a0000000-0000-0000-0000-000000000101'),
  ('e0000000-0000-0000-0000-000000000042', 'b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000301', 'marketing', true, 'whatsapp', 'b0000000-0000-0000-0000-000000000101');

insert into public.importacoes (id, empresa_id, arquivo_nome, created_by) values
  ('e0000000-0000-0000-0000-000000000051', 'a0000000-0000-0000-0000-000000000001', 'clientes-alfa.csv', 'a0000000-0000-0000-0000-000000000101'),
  ('e0000000-0000-0000-0000-000000000052', 'b0000000-0000-0000-0000-000000000001', 'clientes-beta.csv', 'b0000000-0000-0000-0000-000000000101');

insert into public.importacao_erros (id, empresa_id, importacao_id, linha, erro) values
  ('e0000000-0000-0000-0000-000000000061', 'a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000051', 3, 'Telefone inválido'),
  ('e0000000-0000-0000-0000-000000000062', 'b0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000052', 5, 'CPF inválido');

insert into public.audit_log (id, empresa_id, usuario_id, acao, entidade) values
  ('e0000000-0000-0000-0000-000000000071', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000101', 'exportacao', 'contatos'),
  ('e0000000-0000-0000-0000-000000000072', 'b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000101', 'exportacao', 'contatos');

insert into public.organizacoes (id, empresa_id, nome, responsavel_id) values
  ('e0000000-0000-0000-0000-000000000081', 'a0000000-0000-0000-0000-000000000001', 'Padaria Alfa Ltda', 'a0000000-0000-0000-0000-000000000101'),
  ('e0000000-0000-0000-0000-000000000082', 'b0000000-0000-0000-0000-000000000001', 'Mercado Beta Ltda', 'b0000000-0000-0000-0000-000000000101');

-- ---------------------------------------------------------------------
-- A partir daqui, age como Carla (usuario, empresa Alfa).
-- ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000103", "role": "authenticated"}';

-- empresas
select is((select count(*) from public.empresas where id = 'b0000000-0000-0000-0000-000000000001'), 0::bigint, 'não vê a empresa Beta');
select is((select count(*) from public.empresas where id = 'a0000000-0000-0000-0000-000000000001'), 1::bigint, 'vê a própria empresa');
with x as (update public.empresas set nome = nome where id = 'b0000000-0000-0000-0000-000000000001' returning id)
select is((select count(*) from x), 0::bigint, 'não altera a empresa Beta');

-- empresa_membros
select is((select count(*) from public.empresa_membros where empresa_id = 'b0000000-0000-0000-0000-000000000001'), 0::bigint, 'não vê membros da empresa Beta');
with x as (update public.empresa_membros set papel = papel where empresa_id = 'b0000000-0000-0000-0000-000000000001' returning id)
select is((select count(*) from x), 0::bigint, 'não altera membros da empresa Beta');

-- convites
select is((select count(*) from public.convites where id = 'e0000000-0000-0000-0000-000000000002'), 0::bigint, 'não vê convite da empresa Beta');
with x as (update public.convites set status = status where id = 'e0000000-0000-0000-0000-000000000002' returning id)
select is((select count(*) from x), 0::bigint, 'não altera convite da empresa Beta');

-- contatos
select is((select count(*) from public.contatos where id = 'b0000000-0000-0000-0000-000000000301'), 0::bigint, 'não vê contato da empresa Beta');
select is((select count(*) from public.contatos where empresa_id = 'a0000000-0000-0000-0000-000000000001'), 3::bigint, 'usuario vê os contatos sob sua responsabilidade na própria empresa');
with x as (update public.contatos set nome = nome where id = 'b0000000-0000-0000-0000-000000000301' returning id)
select is((select count(*) from x), 0::bigint, 'não altera contato da empresa Beta');
-- DELETE físico é revogado do papel authenticated pra todas as tabelas
-- com dono (exclusão sempre passa por excluir_registro) — ninguém
-- alcança nem a própria empresa, muito menos a de outra.
select throws_ok(
  $$ delete from public.contatos where id = 'b0000000-0000-0000-0000-000000000301' $$,
  '42501',
  null,
  'não apaga contato da empresa Beta (DELETE físico revogado do papel authenticated)'
);
select throws_ok(
  $$ insert into public.contatos (empresa_id, nome, responsavel_id) values ('b0000000-0000-0000-0000-000000000001', 'Invasor', 'a0000000-0000-0000-0000-000000000103') $$,
  '42501',
  null,
  'não insere contato na empresa Beta'
);

-- campos_personalizados
select is((select count(*) from public.campos_personalizados where id = 'e0000000-0000-0000-0000-000000000012'), 0::bigint, 'não vê campo personalizado da empresa Beta');
with x as (update public.campos_personalizados set ordem = ordem where id = 'e0000000-0000-0000-0000-000000000012' returning id)
select is((select count(*) from x), 0::bigint, 'não altera campo personalizado da empresa Beta');

-- tags
select is((select count(*) from public.tags where id = 'b0000000-0000-0000-0000-000000000241'), 0::bigint, 'não vê tag da empresa Beta');
with x as (update public.tags set cor = cor where id = 'b0000000-0000-0000-0000-000000000241' returning id)
select is((select count(*) from x), 0::bigint, 'não altera tag da empresa Beta');
select throws_ok(
  $$ insert into public.tags (empresa_id, nome) values ('b0000000-0000-0000-0000-000000000001', 'Invasora') $$,
  '42501',
  null,
  'não insere tag na empresa Beta'
);

-- contato_tags
select is((select count(*) from public.contato_tags where id = 'e0000000-0000-0000-0000-000000000022'), 0::bigint, 'não vê vínculo de tag da empresa Beta');
with x as (delete from public.contato_tags where id = 'e0000000-0000-0000-0000-000000000022' returning id)
select is((select count(*) from x), 0::bigint, 'não apaga vínculo de tag da empresa Beta');

-- vencimento_tipos
select is((select count(*) from public.vencimento_tipos where id = 'b0000000-0000-0000-0000-000000000231'), 0::bigint, 'não vê tipo de vencimento da empresa Beta');
with x as (update public.vencimento_tipos set ativo = ativo where id = 'b0000000-0000-0000-0000-000000000231' returning id)
select is((select count(*) from x), 0::bigint, 'não altera tipo de vencimento da empresa Beta');

-- vencimentos
select is((select count(*) from public.vencimentos where descricao = 'Seguro auto — Onix'), 0::bigint, 'não vê vencimento da empresa Beta');
with x as (
  update public.vencimentos set status = status
  where id = (select id from public.vencimentos where descricao = 'Seguro auto — Onix')
  returning id
)
select is(
  (select count(*) from x),
  0::bigint,
  'não altera vencimento da empresa Beta'
);

-- funis / etapas / motivos_perda
select is((select count(*) from public.funis where id = 'b0000000-0000-0000-0000-000000000201'), 0::bigint, 'não vê funil da empresa Beta');
with x as (update public.funis set ativo = ativo where id = 'b0000000-0000-0000-0000-000000000201' returning id)
select is((select count(*) from x), 0::bigint, 'não altera funil da empresa Beta');
select throws_ok(
  $$ insert into public.funis (empresa_id, nome) values ('b0000000-0000-0000-0000-000000000001', 'Funil invasor') $$,
  '42501',
  null,
  'não insere funil na empresa Beta'
);

select is((select count(*) from public.etapas where id = 'b0000000-0000-0000-0000-000000000211'), 0::bigint, 'não vê etapa da empresa Beta');
with x as (update public.etapas set ordem = ordem where id = 'b0000000-0000-0000-0000-000000000211' returning id)
select is((select count(*) from x), 0::bigint, 'não altera etapa da empresa Beta');

select is((select count(*) from public.motivos_perda where id = 'b0000000-0000-0000-0000-000000000221'), 0::bigint, 'não vê motivo de perda da empresa Beta');
with x as (update public.motivos_perda set ativo = ativo where id = 'b0000000-0000-0000-0000-000000000221' returning id)
select is((select count(*) from x), 0::bigint, 'não altera motivo de perda da empresa Beta');

-- negocios
select is((select count(*) from public.negocios where proximo_passo_acao = 'Enviar cotação por WhatsApp'), 0::bigint, 'não vê negócio da empresa Beta');
with x as (
  update public.negocios set valor_estimado = valor_estimado
  where id = (select id from public.negocios where proximo_passo_acao = 'Enviar cotação por WhatsApp')
  returning id
)
select is(
  (select count(*) from x),
  0::bigint,
  'não altera negócio da empresa Beta'
);
select throws_ok(
  $$
    delete from public.negocios
    where id = (select id from public.negocios where proximo_passo_acao = 'Enviar cotação por WhatsApp')
  $$,
  '42501',
  null,
  'não apaga negócio da empresa Beta (DELETE físico revogado do papel authenticated)'
);

-- atividades
select is((select count(*) from public.atividades where id = 'e0000000-0000-0000-0000-000000000032'), 0::bigint, 'não vê atividade da empresa Beta');

-- tarefas
select is((select count(*) from public.tarefas where titulo = 'Enviar cotação do seguro auto'), 0::bigint, 'não vê tarefa da empresa Beta');
with x as (
  update public.tarefas set titulo = titulo
  where id = (select id from public.tarefas where titulo = 'Enviar cotação do seguro auto')
  returning id
)
select is(
  (select count(*) from x),
  0::bigint,
  'não altera tarefa da empresa Beta'
);

-- consentimentos
select is((select count(*) from public.consentimentos where id = 'e0000000-0000-0000-0000-000000000042'), 0::bigint, 'não vê consentimento da empresa Beta');

-- audit_log
select is((select count(*) from public.audit_log where id = 'e0000000-0000-0000-0000-000000000072'), 0::bigint, 'não vê audit_log da empresa Beta');
select throws_ok(
  $$ update public.audit_log set acao = 'alterado' where id = 'e0000000-0000-0000-0000-000000000071' $$,
  '42501',
  null,
  'não consegue alterar audit_log nem da própria empresa (append-only, revoke explícito)'
);

-- importacoes / importacao_erros
select is((select count(*) from public.importacoes where id = 'e0000000-0000-0000-0000-000000000052'), 0::bigint, 'não vê importação da empresa Beta');
select is((select count(*) from public.importacao_erros where id = 'e0000000-0000-0000-0000-000000000062'), 0::bigint, 'não vê erro de importação da empresa Beta');

-- organizacoes
select is((select count(*) from public.organizacoes where id = 'e0000000-0000-0000-0000-000000000082'), 0::bigint, 'não vê organização da empresa Beta');
with x as (update public.organizacoes set nome = nome where id = 'e0000000-0000-0000-0000-000000000082' returning id)
select is((select count(*) from x), 0::bigint, 'não altera organização da empresa Beta');
select throws_ok(
  $$ insert into public.organizacoes (empresa_id, nome) values ('b0000000-0000-0000-0000-000000000001', 'Invasora Ltda') $$,
  '42501',
  null,
  'não insere organização na empresa Beta'
);

-- nicho_templates: dado global, deve ser visível para qualquer autenticado,
-- mas não editável por quem não é service_role.
select is((select count(*) from public.nicho_templates where nicho = 'corretora'), 1::bigint, 'vê o template global mesmo sem pertencer a nenhuma empresa dona dele');
-- Sem policy de UPDATE (só SELECT), o RLS filtra a linha candidata pra
-- zero silenciosamente — diferente de audit_log, que tem revoke
-- explícito de UPDATE/DELETE e por isso lança 42501.
with x as (
  update public.nicho_templates set nome_exibicao = 'Hackeado' where nicho = 'corretora' returning id
)
select is((select count(*) from x), 0::bigint, 'não consegue editar o template global de nicho');

select * from finish();
rollback;
