-- Fase 3 recortada, módulo 4/5: campanhas (docs/fase3/SPEC-campanhas.md).
-- Cobre: isolamento multiempresa nas 3 tabelas novas, RLS de escrita (só
-- gestor+ cria/dispara), WhatsApp sem template aprovado (erro explícito,
-- nada enfileirado), disparo enfileira exatamente quem avaliar_segmento
-- retorna, variável sem valor bloqueia só aquele contato,
-- metricas_campanha fim-a-fim, e o caminho agendado (disparar_campanhas_agendadas
-- + atualizar_status_campanhas) com p_agora explícito — incluindo a
-- impersonação que faz o disparo agendado funcionar sem sessão de
-- usuário (correção 1 da migration).
--
-- Datas relativas a current_date/now() em todo o arquivo, exceto quando
-- o valor só alimenta dentro_horario_comercial (que não compara contra
-- dado do seed) — mesmo padrão de fila_envios.sql.

begin;
select no_plan();

set search_path = public, extensions;

set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000102", "email": "gestor@segurosalfa.test", "role": "authenticated"}';

-- ---------------------------------------------------------------------
-- Setup: segmento com os 4 contatos do seed da Alfa (lead/cliente).
-- ---------------------------------------------------------------------
with novo as (
  insert into public.segmentos (empresa_id, nome, criterios)
  values (
    'a0000000-0000-0000-0000-000000000001', 'Todos Alfa (campanhas)',
    '{"regras": [{"campo": "status", "operador": "em", "valor": ["lead", "cliente", "inativo"]}]}'::jsonb
  )
  returning id
)
select id as seg_id into temporary seg_todos from novo;

-- ---------------------------------------------------------------------
-- RLS de escrita: Carla (usuário comum) não cria template nem campanha;
-- Gustavo (gestor) cria os dois.
-- ---------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000103", "email": "corretor@segurosalfa.test", "role": "authenticated"}';

select throws_ok(
  $$
    insert into public.templates_mensagem (empresa_id, nome, canal, conteudo)
    values ('a0000000-0000-0000-0000-000000000001', 'Tentativa Carla', 'whatsapp', 'Oi {{nome}}')
  $$,
  '42501',
  null,
  'usuário comum não consegue criar template — só gestor+'
);

select throws_ok(
  format(
    $$
      insert into public.campanhas (empresa_id, nome, canal, segmento_id)
      values ('a0000000-0000-0000-0000-000000000001', 'Tentativa Carla', 'email', %L)
    $$,
    (select seg_id from seg_todos)
  ),
  '42501',
  null,
  'usuário comum não consegue criar campanha — só gestor+'
);

set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000102", "email": "gestor@segurosalfa.test", "role": "authenticated"}';

with novo as (
  insert into public.templates_mensagem (empresa_id, nome, canal, conteudo, variaveis, status)
  values ('a0000000-0000-0000-0000-000000000001', 'Boas-vindas', 'whatsapp', 'Oi {{nome}}, tudo bem?', '["nome"]'::jsonb, 'rascunho')
  returning id
)
select id as tpl_id into temporary tpl_rascunho from novo;

select ok((select tpl_id from tpl_rascunho) is not null, 'gestor consegue criar template');

-- ---------------------------------------------------------------------
-- created_by não pode ser forjado (achado do security-check): mesmo
-- sendo gestor, Gustavo não consegue inserir uma campanha atribuindo a
-- criação a Carla (nem a outro gestor) — created_by só aceita o próprio
-- auth.uid() no INSERT. Importa porque created_by aqui não é só rótulo
-- de auditoria: disparar_campanhas_agendadas o usa pra impersonar quem
-- disparou, então forjar esse campo forjaria a identidade usada na
-- autorização do disparo agendado.
-- ---------------------------------------------------------------------
select throws_ok(
  format(
    $$
      insert into public.campanhas (empresa_id, nome, canal, segmento_id, created_by)
      values ('a0000000-0000-0000-0000-000000000001', 'Forjando autoria', 'email', %L, 'a0000000-0000-0000-0000-000000000103')
    $$,
    (select seg_id from seg_todos)
  ),
  '42501',
  null,
  'gestor não consegue inserir campanha com created_by de outra pessoa (só o próprio auth.uid())'
);

-- ---------------------------------------------------------------------
-- disparar_campanha, WhatsApp com template ainda em rascunho (não
-- aprovado): erro explícito, campanha não sai de 'rascunho', nada em
-- campanha_envios.
-- ---------------------------------------------------------------------
with novo as (
  insert into public.campanhas (empresa_id, nome, canal, segmento_id, template_id, created_by)
  values ('a0000000-0000-0000-0000-000000000001', 'WA sem aprovação', 'whatsapp', (select seg_id from seg_todos), (select tpl_id from tpl_rascunho), 'a0000000-0000-0000-0000-000000000102')
  returning id
)
select id as camp_wa_id into temporary camp_wa from novo;

select throws_ok(
  format($$ select public.disparar_campanha(%L) $$, (select camp_wa_id from camp_wa)),
  'P0001',
  'Campanha de WhatsApp exige um template aprovado',
  'WhatsApp sem template aprovado: erro explícito'
);

select is(
  (select status from public.campanhas where id = (select camp_wa_id from camp_wa)),
  'rascunho',
  'campanha WhatsApp rejeitada continua em rascunho (não fica travada em enviando)'
);

select is(
  (select count(*) from public.campanha_envios where campanha_id = (select camp_wa_id from camp_wa)),
  0::bigint,
  'WhatsApp sem template aprovado: nada é enfileirado'
);

-- Carla (comum) não consegue disparar mesmo uma campanha válida —
-- a UPDATE de status='enviando' não afeta linha nenhuma sob a RLS dela,
-- disparar_campanha detecta e recusa.
update public.templates_mensagem set status = 'aprovado' where id = (select tpl_id from tpl_rascunho);

set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000103", "email": "corretor@segurosalfa.test", "role": "authenticated"}';

select throws_ok(
  format($$ select public.disparar_campanha(%L) $$, (select camp_wa_id from camp_wa)),
  'P0001',
  'Sem permissão para disparar esta campanha',
  'usuário comum não consegue disparar campanha — só gestor+'
);

set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000102", "email": "gestor@segurosalfa.test", "role": "authenticated"}';

select lives_ok(
  format($$ select public.disparar_campanha(%L) $$, (select camp_wa_id from camp_wa)),
  'gestor consegue disparar campanha WhatsApp com template aprovado'
);

select is(
  (select count(*) from public.campanha_envios where campanha_id = (select camp_wa_id from camp_wa)),
  4::bigint,
  'disparo WhatsApp enfileira exatamente os 4 contatos que avaliar_segmento retorna'
);

select is(
  (
    select array_agg(contato_id order by contato_id)
    from public.campanha_envios where campanha_id = (select camp_wa_id from camp_wa)
  ),
  (select array_agg(id order by id) from public.avaliar_segmento((select seg_id from seg_todos)) as id),
  'o conjunto de contatos enfileirados bate exatamente com avaliar_segmento'
);

-- Reenviar campanha já 'enviando' falha (guarda de status) e não
-- duplica campanha_envios — é essa guarda que também protege o
-- caminho agendado de rodar a mesma campanha duas vezes.
select throws_ok(
  format($$ select public.disparar_campanha(%L) $$, (select camp_wa_id from camp_wa)),
  'P0001',
  null,
  'campanha já em "enviando" não pode ser disparada de novo'
);

select is(
  (select count(*) from public.campanha_envios where campanha_id = (select camp_wa_id from camp_wa)),
  4::bigint,
  'reenvio recusado não duplica linhas em campanha_envios'
);

-- ---------------------------------------------------------------------
-- Variável sem valor bloqueia só aquele contato, não a campanha
-- inteira. Dois contatos novos: um com e-mail, outro sem.
-- ---------------------------------------------------------------------
insert into public.contatos (empresa_id, nome, status, email, telefone, origem, responsavel_id, created_by) values
  ('a0000000-0000-0000-0000-000000000001', 'Teste Com Email', 'lead', 'comemail@teste.test', '(11) 90000-0001', 'teste_variavel_campanha', 'a0000000-0000-0000-0000-000000000102', 'a0000000-0000-0000-0000-000000000102'),
  ('a0000000-0000-0000-0000-000000000001', 'Teste Sem Email', 'lead', null, '(11) 90000-0002', 'teste_variavel_campanha', 'a0000000-0000-0000-0000-000000000102', 'a0000000-0000-0000-0000-000000000102');

with novo as (
  insert into public.segmentos (empresa_id, nome, criterios)
  values (
    'a0000000-0000-0000-0000-000000000001', 'Teste variável (campanhas)',
    '{"regras": [{"campo": "origem", "operador": "em", "valor": ["teste_variavel_campanha"]}]}'::jsonb
  )
  returning id
)
select id as seg_id into temporary seg_variavel from novo;

with novo as (
  insert into public.campanhas (empresa_id, nome, canal, segmento_id, assunto, blocos, created_by)
  values (
    'a0000000-0000-0000-0000-000000000001', 'Teste variável', 'email', (select seg_id from seg_variavel),
    'Oi {{email}}', '[{"tipo":"texto","conteudo":"Texto fixo sem variável"}]'::jsonb,
    'a0000000-0000-0000-0000-000000000102'
  )
  returning id
)
select id as camp_id into temporary camp_variavel from novo;

select lives_ok(
  format($$ select public.disparar_campanha(%L) $$, (select camp_id from camp_variavel)),
  'disparo com um contato sem e-mail não levanta exceção pra campanha inteira'
);

select is(
  (
    select motivo_bloqueio from public.campanha_envios ce
    join public.contatos c on c.id = ce.contato_id
    where ce.campanha_id = (select camp_id from camp_variavel) and c.nome = 'Teste Sem Email'
  ),
  'variavel_sem_valor',
  'contato sem valor pra {{email}} fica bloqueado com motivo "variavel_sem_valor", sem fila_envios'
);

select is(
  (
    select fila_envios_id is not null from public.campanha_envios ce
    join public.contatos c on c.id = ce.contato_id
    where ce.campanha_id = (select camp_id from camp_variavel) and c.nome = 'Teste Com Email'
  ),
  true,
  'contato com e-mail é enfileirado normalmente, mesmo campanha tendo outro contato bloqueado'
);

-- ---------------------------------------------------------------------
-- metricas_campanha fim-a-fim: 3 contatos — 1 sem consentimento de
-- marketing, 1 com opt-out, 1 com consentimento concedido.
-- ---------------------------------------------------------------------
insert into public.contatos (empresa_id, nome, status, email, telefone, origem, responsavel_id, created_by) values
  ('a0000000-0000-0000-0000-000000000001', 'Métrica Sem Consentimento', 'lead', 'semconsent@teste.test', '(11) 90000-0011', 'teste_metrica_campanha', 'a0000000-0000-0000-0000-000000000102', 'a0000000-0000-0000-0000-000000000102'),
  ('a0000000-0000-0000-0000-000000000001', 'Métrica Optout', 'lead', 'optout@teste.test', '(11) 90000-0012', 'teste_metrica_campanha', 'a0000000-0000-0000-0000-000000000102', 'a0000000-0000-0000-0000-000000000102'),
  ('a0000000-0000-0000-0000-000000000001', 'Métrica Ok', 'lead', 'ok@teste.test', '(11) 90000-0013', 'teste_metrica_campanha', 'a0000000-0000-0000-0000-000000000102', 'a0000000-0000-0000-0000-000000000102');

insert into public.consentimentos (empresa_id, contato_id, finalidade, concedido, canal)
select 'a0000000-0000-0000-0000-000000000001', id, 'marketing', false, 'formulario'
from public.contatos where nome = 'Métrica Optout' and origem = 'teste_metrica_campanha';

insert into public.consentimentos (empresa_id, contato_id, finalidade, concedido, canal)
select 'a0000000-0000-0000-0000-000000000001', id, 'marketing', true, 'formulario'
from public.contatos where nome = 'Métrica Ok' and origem = 'teste_metrica_campanha';

with novo as (
  insert into public.segmentos (empresa_id, nome, criterios)
  values (
    'a0000000-0000-0000-0000-000000000001', 'Teste métrica (campanhas)',
    '{"regras": [{"campo": "origem", "operador": "em", "valor": ["teste_metrica_campanha"]}]}'::jsonb
  )
  returning id
)
select id as seg_id into temporary seg_metrica from novo;

-- agendado_para fixo (não null): dispara agora, mas o valor enfileirado
-- em fila_envios fica alinhado com o p_agora fixo que processar_fila_envios
-- recebe logo abaixo — enfileirar_envio's default seria now() real, fora
-- da janela de agendado_para <= p_agora do worker com p_agora fixo no
-- passado (mesmo cuidado de fila_envios.sql com p_agendado_para explícito).
with novo as (
  insert into public.campanhas (empresa_id, nome, canal, segmento_id, assunto, blocos, agendado_para, created_by)
  values (
    'a0000000-0000-0000-0000-000000000001', 'Teste métrica', 'email', (select seg_id from seg_metrica),
    'Assunto fixo sem variável', '[{"tipo":"texto","conteudo":"Texto fixo sem variável"}]'::jsonb,
    '2026-09-14 12:00:00+00'::timestamptz, 'a0000000-0000-0000-0000-000000000102'
  )
  returning id
)
select id as camp_id into temporary camp_metrica from novo;

select public.disparar_campanha((select camp_id from camp_metrica));

-- processar_fila_envios é revogada de "authenticated" (só o cron chama)
-- — mesma troca de role usada no caminho agendado, abaixo. Horário
-- comercial fixo (mesma data/hora usada em fila_envios.sql — não
-- depende do seed, só de dia da semana/hora, então é seguro fixar).
reset role;
select public.processar_fila_envios('2026-09-14 13:00:00+00'::timestamptz);
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000102", "email": "gestor@segurosalfa.test", "role": "authenticated"}';

select results_eq(
  format($$ select enviados, bloqueados, optouts from public.metricas_campanha(%L) $$, (select camp_id from camp_metrica)),
  $$ values (1::bigint, 1::bigint, 1::bigint) $$,
  'métricas: 1 enviado, 1 bloqueado (sem consentimento), 1 opt-out'
);

-- ---------------------------------------------------------------------
-- Caminho agendado: disparar_campanhas_agendadas roda como o cron (sem
-- sessão), atualizar_status_campanhas fecha o ciclo. p_agora explícito
-- em ambas, mesmo padrão determinístico de processar_fila_envios.
-- ---------------------------------------------------------------------
-- Usa seg_metrica (escopo fechado por origem, 3 contatos), não seg_todos:
-- seg_todos casa por status in (lead,cliente,inativo) sem filtrar
-- origem, então os contatos de teste inseridos depois (variável/métrica,
-- todos 'lead') também passariam a bater com ele — reusar seg_todos
-- aqui acoplaria essa contagem à ordem dos blocos anteriores.
with novo as (
  insert into public.campanhas (empresa_id, nome, canal, segmento_id, assunto, blocos, status, agendado_para, created_by)
  values (
    'a0000000-0000-0000-0000-000000000001', 'Campanha agendada (teste)', 'email', (select seg_id from seg_metrica),
    'Assunto agendado', '[{"tipo":"texto","conteudo":"Texto agendado"}]'::jsonb,
    'agendada', '2026-09-14 12:00:00+00'::timestamptz, 'a0000000-0000-0000-0000-000000000102'
  )
  returning id
)
select id as camp_id into temporary camp_agendada from novo;

-- Sem sessão nenhuma — só assim prova que a impersonação por dentro de
-- disparar_campanhas_agendadas é o que faz o disparo funcionar, não
-- uma sessão de gestor que "vazou" de um passo anterior do teste.
reset role;
reset request.jwt.claims;

select public.disparar_campanhas_agendadas('2026-09-14 13:00:00+00'::timestamptz);

select is(
  (select status from public.campanhas where id = (select camp_id from camp_agendada)),
  'enviando',
  'disparar_campanhas_agendadas move campanha agendada (agendado_para no passado) pra "enviando", sem sessão de usuário'
);

select is(
  (select count(*) from public.campanha_envios where campanha_id = (select camp_id from camp_agendada)),
  3::bigint,
  'disparo agendado enfileira os 3 contatos do segmento, mesmo sem JWT (impersonação funcionou)'
);

select public.processar_fila_envios('2026-09-14 13:00:00+00'::timestamptz);
select public.atualizar_status_campanhas();

select is(
  (select status from public.campanhas where id = (select camp_id from camp_agendada)),
  'concluida',
  'atualizar_status_campanhas fecha a campanha depois que a fila termina de processar'
);

-- ---------------------------------------------------------------------
-- Isolamento multiempresa: Beto (Beta) não enxerga templates, campanhas
-- nem campanha_envios da Alfa, e não consegue disparar campanha da Alfa.
-- ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "b0000000-0000-0000-0000-000000000101", "email": "dono@segurosbeta.test", "role": "authenticated"}';

select is(
  (select count(*) from public.templates_mensagem where id = (select tpl_id from tpl_rascunho)),
  0::bigint,
  'usuário da Beta não enxerga template da Alfa'
);

select is(
  (select count(*) from public.campanhas where id = (select camp_wa_id from camp_wa)),
  0::bigint,
  'usuário da Beta não enxerga campanha da Alfa'
);

select is(
  (select count(*) from public.campanha_envios where campanha_id = (select camp_wa_id from camp_wa)),
  0::bigint,
  'usuário da Beta não enxerga campanha_envios da Alfa'
);

select throws_ok(
  format($$ select public.disparar_campanha(%L) $$, (select camp_id from camp_metrica)),
  'P0001',
  'Campanha não encontrada',
  'usuário da Beta não consegue disparar campanha da Alfa (RLS bloqueia a leitura antes de qualquer checagem de papel)'
);

select * from finish();
rollback;
