-- Simulação de chat WhatsApp (mock) — docs/whatsapp-mock/SPEC-chat-whatsapp-mock.md.
-- Sem tabela nova, sem RLS nova (atividades_select/atividades_insert já
-- cobrem qualquer tipo, já testadas em timeline_automatica.sql/
-- isolamento_multiempresa.sql) — este arquivo cobre só o comportamento
-- NOVO: o trigger em fila_envios grava a mensagem "saída" certa (e só
-- quando enviada de verdade, não quando bloqueada), e a resposta
-- simulada segue a RLS já existente.
--
-- processar_fila_envios roda sempre com `reset role`/sem sessão (mesmo
-- padrão de fila_envios.sql/campanhas.sql) — é exatamente esse caminho
-- que prova que o trigger precisa de security definer, já que ele
-- dispara como efeito colateral dessa chamada sem JWT nenhum.

begin;
select no_plan();

set search_path = public, extensions;

set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000102", "email": "gestor@segurosalfa.test", "role": "authenticated"}';

-- ---------------------------------------------------------------------
-- Setup: 2 contatos com a mesma origem (mesmo segmento) — um com
-- consentimento de marketing (vai receber e gerar atividade), outro sem
-- (fica bloqueado e não deve gerar nada).
-- ---------------------------------------------------------------------
with novo as (
  insert into public.contatos (empresa_id, nome, status, telefone, origem, responsavel_id, created_by) values
    ('a0000000-0000-0000-0000-000000000001', 'WA Com Consentimento', 'lead', '(11) 90000-0031', 'teste_msg_whatsapp', 'a0000000-0000-0000-0000-000000000102', 'a0000000-0000-0000-0000-000000000102')
  returning id
)
select id as contato_id into temporary contato_com_consentimento from novo;

insert into public.contatos (empresa_id, nome, status, telefone, origem, responsavel_id, created_by) values
  ('a0000000-0000-0000-0000-000000000001', 'WA Sem Consentimento', 'lead', '(11) 90000-0032', 'teste_msg_whatsapp', 'a0000000-0000-0000-0000-000000000102', 'a0000000-0000-0000-0000-000000000102');

insert into public.consentimentos (empresa_id, contato_id, finalidade, concedido, canal)
select 'a0000000-0000-0000-0000-000000000001', contato_id, 'marketing', true, 'formulario'
from contato_com_consentimento;

with novo as (
  insert into public.templates_mensagem (empresa_id, nome, canal, conteudo, status)
  values (
    'a0000000-0000-0000-0000-000000000001', 'Template teste chat', 'whatsapp',
    'Ola! Sua mensagem de teste chegou.', 'aprovado'
  )
  returning id
)
select id as tpl_id into temporary tpl_chat from novo;

with novo as (
  insert into public.segmentos (empresa_id, nome, criterios)
  values (
    'a0000000-0000-0000-0000-000000000001', 'Teste chat WhatsApp',
    '{"regras": [{"campo": "origem", "operador": "em", "valor": ["teste_msg_whatsapp"]}]}'::jsonb
  )
  returning id
)
select id as seg_id into temporary seg_chat from novo;

-- agendado_para fixo (não null): enfileirar_envio's default seria now()
-- real, fora da janela de agendado_para <= p_agora do worker com p_agora
-- fixo no passado logo abaixo — mesmo cuidado de camp_metrica em
-- campanhas.sql.
with novo as (
  insert into public.campanhas (empresa_id, nome, canal, segmento_id, template_id, agendado_para, created_by)
  values (
    'a0000000-0000-0000-0000-000000000001', 'Campanha teste chat', 'whatsapp',
    (select seg_id from seg_chat), (select tpl_id from tpl_chat),
    '2026-09-14 12:00:00+00'::timestamptz, 'a0000000-0000-0000-0000-000000000102'
  )
  returning id
)
select id as camp_id into temporary camp_chat from novo;

select public.disparar_campanha((select camp_id from camp_chat));

-- Mesmo horário comercial fixo usado em campanhas.sql/fila_envios.sql —
-- não depende do dia real em que o teste roda. Sem sessão nenhuma: é
-- assim que o worker roda de verdade via pg_cron, e é o que prova que o
-- trigger precisava de security definer.
reset role;
reset request.jwt.claims;
select public.processar_fila_envios('2026-09-14 13:00:00+00'::timestamptz);
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000102", "email": "gestor@segurosalfa.test", "role": "authenticated"}';

-- ---------------------------------------------------------------------
-- Mensagem "saída": exatamente 1 atividade, com o conteúdo certo, pro
-- contato que tinha consentimento.
-- ---------------------------------------------------------------------
select results_eq(
  $$ select a.tipo, a.conteudo->>'direcao', a.conteudo->>'canal', a.conteudo->>'texto',
            (a.conteudo->>'campanha_id')::uuid
     from public.atividades a
     join public.contatos c on c.id = a.contato_id
     where c.nome = 'WA Com Consentimento' and c.origem = 'teste_msg_whatsapp' $$,
  format(
    $$ values ('mensagem'::text, 'saida'::text, 'whatsapp'::text, 'Ola! Sua mensagem de teste chegou.'::text, %L::uuid) $$,
    (select camp_id from camp_chat)
  ),
  'trigger grava a mensagem de saída certa (tipo, direção, canal, texto e campanha) quando a campanha WhatsApp envia de verdade'
);

select is(
  (select count(*)
   from public.atividades a
   join public.contatos c on c.id = a.contato_id
   where c.nome = 'WA Sem Consentimento' and c.origem = 'teste_msg_whatsapp' and a.tipo = 'mensagem'),
  0::bigint,
  'mensagem bloqueada (sem consentimento) não gera atividade — o trigger só dispara em status=enviada'
);

-- ---------------------------------------------------------------------
-- Resposta simulada: insert direto do cliente, mesmo caminho de
-- nota/ligação. Responsável pelo contato consegue; quem não tem relação
-- nenhuma com o contato é barrado pela RLS já existente (sem RLS nova).
-- ---------------------------------------------------------------------
select lives_ok(
  format(
    $$ insert into public.atividades (empresa_id, contato_id, tipo, responsavel_id, created_by, conteudo)
       select 'a0000000-0000-0000-0000-000000000001', c.id, 'mensagem',
              'a0000000-0000-0000-0000-000000000102', 'a0000000-0000-0000-0000-000000000102',
              '{"texto": "Quero renovar!", "direcao": "entrada", "canal": "whatsapp", "simulado": true}'::jsonb
       from public.contatos c
       where c.nome = 'WA Com Consentimento' and c.origem = 'teste_msg_whatsapp' $$
  ),
  'responsável pelo contato consegue registrar a resposta simulada (mesma RLS de nota/ligação)'
);

select is(
  (select count(*)
   from public.atividades a
   join public.contatos c on c.id = a.contato_id
   where c.nome = 'WA Com Consentimento' and c.origem = 'teste_msg_whatsapp'
     and a.tipo = 'mensagem' and a.conteudo->>'direcao' = 'entrada'),
  1::bigint,
  'resposta simulada aparece como atividade tipo=mensagem, direcao=entrada'
);

set local request.jwt.claims = '{"sub": "b0000000-0000-0000-0000-000000000101", "email": "dono@segurosbeta.test", "role": "authenticated"}';

-- contato_id literal (não um SELECT contra contatos): sob a sessão do
-- Beto, contatos_select já filtra o contato da Alfa, então um
-- INSERT ... SELECT ... FROM contatos simplesmente não acharia a linha
-- (0 linhas afetadas, sem exceção) — isso provaria contatos_select, não
-- atividades_insert. Com o id fixo, o INSERT chega até o WITH CHECK de
-- atividades_insert de verdade.
select throws_ok(
  format(
    $$ insert into public.atividades (empresa_id, contato_id, tipo, responsavel_id, created_by, conteudo)
       values (
         'a0000000-0000-0000-0000-000000000001', %L, 'mensagem',
         'b0000000-0000-0000-0000-000000000101', 'b0000000-0000-0000-0000-000000000101',
         '{"texto": "invasao", "direcao": "entrada", "canal": "whatsapp", "simulado": true}'::jsonb
       ) $$,
    (select contato_id from contato_com_consentimento)
  ),
  '42501',
  null,
  'usuário da Beta, sem relação nenhuma com o contato da Alfa, não consegue simular resposta pra ele'
);

select * from finish();
rollback;
