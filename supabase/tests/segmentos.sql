-- Fase 3 recortada, módulo 2/5: segmentos dinâmicos (docs/fase3/SPEC-segmentos.md).
-- Cobre: RLS de escrita (só gestor+) e leitura (qualquer membro),
-- validação de `criterios` no CHECK da tabela, um caso por `campo` da
-- DSL provando inclusão/exclusão real (não só "não dá erro"), o AND
-- entre regras + OR dentro de um `em`, isolamento multiempresa, e que
-- `avaliar_segmento` respeita a RLS de `contatos` (o mesmo segmento dá
-- resultados diferentes pra usuários com alcance diferente).
--
-- Datas relativas a `current_date`/`now()` em todo o arquivo (não
-- absolutas) — lição do bug encontrado em notificacoes.sql: uma data
-- fixa comparada contra dado relativo ao dia do `db:reset` quebra
-- quando os dois se afastam.

begin;
select no_plan();

set search_path = public, extensions;

-- ---------------------------------------------------------------------
-- Setup: dados extras nos contatos do seed, como Gustavo (gestor —
-- bypassa a exigência de ser o responsável). João (301) e Ricardo (303)
-- ganham nascimento/cidade/campo personalizado distintos pra dar
-- contraste nos testes de idade/cidade/personalizado.
-- ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000102", "email": "gestor@segurosalfa.test", "role": "authenticated"}';

update public.contatos
set nascimento = (current_date - interval '35 years')::date,
    endereco = '{"cidade": "São Paulo"}'::jsonb,
    campos = '{"anos_experiencia": 10}'::jsonb
where id = 'a0000000-0000-0000-0000-000000000301';

update public.contatos
set nascimento = (current_date - interval '20 years')::date,
    endereco = '{"cidade": "Rio de Janeiro"}'::jsonb,
    campos = '{"anos_experiencia": 2}'::jsonb
where id = 'a0000000-0000-0000-0000-000000000303';

insert into public.contato_tags (empresa_id, contato_id, tag_id, created_by) values
  ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000301', 'a0000000-0000-0000-0000-000000000241', 'a0000000-0000-0000-0000-000000000102');

insert into public.vencimentos (empresa_id, contato_id, vencimento_tipo_id, descricao, data_vencimento, responsavel_id, created_by) values
  ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000301', 'a0000000-0000-0000-0000-000000000231', 'Vencimento de teste (segmentos)', (current_date + interval '90 days')::date, 'a0000000-0000-0000-0000-000000000102', 'a0000000-0000-0000-0000-000000000102');

insert into public.campos_personalizados (empresa_id, entidade, chave, rotulo, tipo, created_by) values
  ('a0000000-0000-0000-0000-000000000001', 'contato', 'anos_experiencia', 'Anos de experiência', 'numero', 'a0000000-0000-0000-0000-000000000102');

-- ---------------------------------------------------------------------
-- RLS de escrita: Carla (usuário comum) não cria segmento; Gustavo
-- (gestor) cria.
-- ---------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000103", "email": "corretor@segurosalfa.test", "role": "authenticated"}';

select throws_ok(
  $$
    insert into public.segmentos (empresa_id, nome, criterios)
    values ('a0000000-0000-0000-0000-000000000001', 'Tentativa Carla', '{"regras": []}'::jsonb)
  $$,
  '42501',
  null,
  'usuário comum não consegue criar segmento — só gestor+'
);

set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000102", "email": "gestor@segurosalfa.test", "role": "authenticated"}';

select lives_ok(
  $$
    insert into public.segmentos (empresa_id, nome, criterios)
    values ('a0000000-0000-0000-0000-000000000001', 'Segmento de teste (RLS)', '{"regras": []}'::jsonb)
  $$,
  'gestor consegue criar segmento'
);

-- ---------------------------------------------------------------------
-- validar_criterios_segmento: campo fora do conjunto fechado é
-- rejeitado no CHECK, na hora de salvar — não só quando avaliado.
-- ---------------------------------------------------------------------
select throws_ok(
  $$
    insert into public.segmentos (empresa_id, nome, criterios)
    values (
      'a0000000-0000-0000-0000-000000000001', 'Segmento inválido',
      '{"regras": [{"campo": "campo_inexistente", "operador": "igual", "valor": "x"}]}'::jsonb
    )
  $$,
  '23514',
  null,
  'campo fora do conjunto fechado é rejeitado no CHECK da tabela'
);

-- ---------------------------------------------------------------------
-- Um caso por campo, provando inclusão/exclusão real. Segmentos
-- criados como Gustavo (gestor).
-- ---------------------------------------------------------------------

-- status: só 'lead' — Marina(302) e Fernanda(304), não João(301)/Ricardo(303) (cliente).
with novo as (
  insert into public.segmentos (empresa_id, nome, criterios)
  values ('a0000000-0000-0000-0000-000000000001', 'status=lead', '{"regras": [{"campo": "status", "operador": "em", "valor": ["lead"]}]}'::jsonb)
  returning id
)
select id as seg_id into temporary seg_status from novo;

select is(
  (select count(*) from public.avaliar_segmento((select seg_id from seg_status))),
  2::bigint,
  'campo status: 2 leads no seed (Marina, Fernanda)'
);
select ok(
  (select 'a0000000-0000-0000-0000-000000000302'::uuid in (select public.avaliar_segmento((select seg_id from seg_status)))),
  'status: inclui Marina (lead)'
);
select ok(
  not (select 'a0000000-0000-0000-0000-000000000301'::uuid in (select public.avaliar_segmento((select seg_id from seg_status)))),
  'status: exclui João (cliente)'
);

-- temperatura: só 'quente' — Marina(302).
with novo as (
  insert into public.segmentos (empresa_id, nome, criterios)
  values ('a0000000-0000-0000-0000-000000000001', 'temperatura=quente', '{"regras": [{"campo": "temperatura", "operador": "em", "valor": ["quente"]}]}'::jsonb)
  returning id
)
select id as seg_id into temporary seg_temp from novo;

select is(
  (select array_agg(id) from public.avaliar_segmento((select seg_id from seg_temp)) as id),
  array['a0000000-0000-0000-0000-000000000302'::uuid],
  'campo temperatura: só Marina (quente)'
);

-- origem: 'facebook_ads' — só Marina.
with novo as (
  insert into public.segmentos (empresa_id, nome, criterios)
  values ('a0000000-0000-0000-0000-000000000001', 'origem=facebook_ads', '{"regras": [{"campo": "origem", "operador": "em", "valor": ["facebook_ads"]}]}'::jsonb)
  returning id
)
select id as seg_id into temporary seg_origem from novo;

select is(
  (select array_agg(id) from public.avaliar_segmento((select seg_id from seg_origem)) as id),
  array['a0000000-0000-0000-0000-000000000302'::uuid],
  'campo origem: só Marina (facebook_ads)'
);

-- responsavel_id: Gustavo — só Ricardo(303).
with novo as (
  insert into public.segmentos (empresa_id, nome, criterios)
  values ('a0000000-0000-0000-0000-000000000001', 'responsavel=gustavo', '{"regras": [{"campo": "responsavel_id", "operador": "em", "valor": ["a0000000-0000-0000-0000-000000000102"]}]}'::jsonb)
  returning id
)
select id as seg_id into temporary seg_resp from novo;

select is(
  (select array_agg(id) from public.avaliar_segmento((select seg_id from seg_resp)) as id),
  array['a0000000-0000-0000-0000-000000000303'::uuid],
  'campo responsavel_id: só Ricardo (responsável Gustavo)'
);

-- cidade: 'São Paulo' — só João(301), depois do setup.
with novo as (
  insert into public.segmentos (empresa_id, nome, criterios)
  values ('a0000000-0000-0000-0000-000000000001', 'cidade=sp', '{"regras": [{"campo": "cidade", "operador": "igual", "valor": "São Paulo"}]}'::jsonb)
  returning id
)
select id as seg_id into temporary seg_cidade from novo;

select is(
  (select array_agg(id) from public.avaliar_segmento((select seg_id from seg_cidade)) as id),
  array['a0000000-0000-0000-0000-000000000301'::uuid],
  'campo cidade: só João (São Paulo)'
);

-- idade: entre 30 e 40 — só João (35 anos), não Ricardo (20).
with novo as (
  insert into public.segmentos (empresa_id, nome, criterios)
  values ('a0000000-0000-0000-0000-000000000001', 'idade=30-40', '{"regras": [{"campo": "idade", "operador": "entre", "valor": [30, 40]}]}'::jsonb)
  returning id
)
select id as seg_id into temporary seg_idade from novo;

select ok(
  (select 'a0000000-0000-0000-0000-000000000301'::uuid in (select public.avaliar_segmento((select seg_id from seg_idade)))),
  'idade: inclui João (35 anos)'
);
select ok(
  not (select 'a0000000-0000-0000-0000-000000000303'::uuid in (select public.avaliar_segmento((select seg_id from seg_idade)))),
  'idade: exclui Ricardo (20 anos)'
);

-- sem_contato_dias: >= 30 — só Ricardo (seed: último contato 40 dias atrás).
with novo as (
  insert into public.segmentos (empresa_id, nome, criterios)
  values ('a0000000-0000-0000-0000-000000000001', 'sem-contato-30d', '{"regras": [{"campo": "sem_contato_dias", "operador": "maior_ou_igual", "valor": 30}]}'::jsonb)
  returning id
)
select id as seg_id into temporary seg_semcontato from novo;

select is(
  (select array_agg(id) from public.avaliar_segmento((select seg_id from seg_semcontato)) as id),
  array['a0000000-0000-0000-0000-000000000303'::uuid],
  'sem_contato_dias >= 30: só Ricardo (40 dias sem contato no seed)'
);

-- nunca contatado conta como "sem contato há qualquer tempo".
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000102", "email": "gestor@segurosalfa.test", "role": "authenticated"}';

with novo as (
  insert into public.contatos (empresa_id, nome, status, responsavel_id, created_by)
  values ('a0000000-0000-0000-0000-000000000001', 'Nunca Contatado (teste)', 'lead', 'a0000000-0000-0000-0000-000000000102', 'a0000000-0000-0000-0000-000000000102')
  returning id
)
select id as contato_id into temporary contato_nunca_contatado from novo;

select ok(
  (select (select contato_id from contato_nunca_contatado) in (select public.avaliar_segmento((select seg_id from seg_semcontato)))),
  'sem_contato_dias: contato nunca contatado (ultimo_contato_em null) satisfaz qualquer limite'
);

-- tags: VIP — só João, depois do setup.
with novo as (
  insert into public.segmentos (empresa_id, nome, criterios)
  values ('a0000000-0000-0000-0000-000000000001', 'tag=vip', '{"regras": [{"campo": "tags", "operador": "contem_algum", "valor": ["a0000000-0000-0000-0000-000000000241"]}]}'::jsonb)
  returning id
)
select id as seg_id into temporary seg_tag from novo;

select is(
  (select array_agg(id) from public.avaliar_segmento((select seg_id from seg_tag)) as id),
  array['a0000000-0000-0000-0000-000000000301'::uuid],
  'campo tags: só João (tag VIP)'
);

-- vencimento_tipo_mes: tipo Seguro auto + mês do vencimento de teste — só João.
with novo as (
  insert into public.segmentos (empresa_id, nome, criterios)
  values (
    'a0000000-0000-0000-0000-000000000001', 'vencimento-tipo-mes',
    jsonb_build_object('regras', jsonb_build_array(
      jsonb_build_object(
        'campo', 'vencimento_tipo_mes', 'operador', 'igual',
        'valor', jsonb_build_object(
          'vencimento_tipo_id', 'a0000000-0000-0000-0000-000000000231',
          'mes', extract(month from (current_date + interval '90 days'))::int
        )
      )
    ))
  )
  returning id
)
select id as seg_id into temporary seg_venc from novo;

select is(
  (select array_agg(id) from public.avaliar_segmento((select seg_id from seg_venc)) as id),
  array['a0000000-0000-0000-0000-000000000301'::uuid],
  'campo vencimento_tipo_mes: só João (vencimento de teste no mês certo)'
);

-- personalizado (numérico): anos_experiencia >= 5 — só João (10), não Ricardo (2).
with novo as (
  insert into public.segmentos (empresa_id, nome, criterios)
  values ('a0000000-0000-0000-0000-000000000001', 'personalizado-experiencia', '{"regras": [{"campo": "personalizado", "chave": "anos_experiencia", "operador": "maior_ou_igual", "valor": 5}]}'::jsonb)
  returning id
)
select id as seg_id into temporary seg_personalizado from novo;

select ok(
  (select 'a0000000-0000-0000-0000-000000000301'::uuid in (select public.avaliar_segmento((select seg_id from seg_personalizado)))),
  'personalizado: inclui João (10 anos de experiência)'
);
select ok(
  not (select 'a0000000-0000-0000-0000-000000000303'::uuid in (select public.avaliar_segmento((select seg_id from seg_personalizado)))),
  'personalizado: exclui Ricardo (2 anos de experiência)'
);

-- ---------------------------------------------------------------------
-- Combinação: AND entre regras diferentes + OR dentro de um `em`.
-- status em [lead, cliente] (todo mundo) AND temperatura em [quente, frio]
-- → Marina (quente) e Ricardo (frio), não João/Fernanda (morno).
-- ---------------------------------------------------------------------
with novo as (
  insert into public.segmentos (empresa_id, nome, criterios)
  values (
    'a0000000-0000-0000-0000-000000000001', 'combinado',
    '{"regras": [
      {"campo": "status", "operador": "em", "valor": ["lead", "cliente"]},
      {"campo": "temperatura", "operador": "em", "valor": ["quente", "frio"]}
    ]}'::jsonb
  )
  returning id
)
select id as seg_id into temporary seg_combinado from novo;

select is(
  (select array_agg(id order by id) from public.avaliar_segmento((select seg_id from seg_combinado)) as id),
  array['a0000000-0000-0000-0000-000000000302'::uuid, 'a0000000-0000-0000-0000-000000000303'::uuid],
  'AND entre regras + OR dentro de um "em": Marina (quente) e Ricardo (frio)'
);

-- ---------------------------------------------------------------------
-- avaliar_segmento respeita a RLS de contatos: o MESMO segmento dá
-- resultados diferentes pra Gustavo (gestor, vê tudo) e Carla (usuário
-- comum, Alfa sem carteira compartilhada — só vê os próprios).
-- Critério: temperatura em [quente, morno, frio] bate com todo mundo.
-- ---------------------------------------------------------------------
with novo as (
  insert into public.segmentos (empresa_id, nome, criterios)
  values ('a0000000-0000-0000-0000-000000000001', 'todo-mundo', '{"regras": [{"campo": "temperatura", "operador": "em", "valor": ["quente", "morno", "frio"]}]}'::jsonb)
  returning id
)
select id as seg_id into temporary seg_todos from novo;

select is(
  (select count(*) from public.avaliar_segmento((select seg_id from seg_todos))),
  4::bigint,
  'gestor (Gustavo) enxerga os 4 contatos da Alfa que batem'
);

set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000103", "email": "corretor@segurosalfa.test", "role": "authenticated"}';

select is(
  (select count(*) from public.avaliar_segmento((select seg_id from seg_todos))),
  3::bigint,
  'usuário comum (Carla) enxerga só os próprios 3 contatos, mesmo segmento'
);
select ok(
  not (select 'a0000000-0000-0000-0000-000000000303'::uuid in (select public.avaliar_segmento((select seg_id from seg_todos)))),
  'Carla não enxerga Ricardo (responsável Gustavo) via avaliar_segmento — RLS de contatos, não do segmento'
);

-- ---------------------------------------------------------------------
-- Operador errado pro campo é rejeitado com exceção (não silenciosamente
-- ignorado nem retorna vazio).
-- ---------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000102", "email": "gestor@segurosalfa.test", "role": "authenticated"}';

select throws_ok(
  $$ select public.contato_bate_criterios(
    'a0000000-0000-0000-0000-000000000301',
    '{"regras": [{"campo": "status", "operador": "igual", "valor": "lead"}]}'::jsonb
  ) $$,
  'P0001',
  null,
  'operador incompatível com o campo levanta exceção, não ignora em silêncio'
);

-- ---------------------------------------------------------------------
-- Isolamento multiempresa: Beto (Beta) não enxerga nem avalia segmento
-- da Alfa.
-- ---------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "b0000000-0000-0000-0000-000000000101", "email": "dono@segurosbeta.test", "role": "authenticated"}';

select is(
  (select count(*) from public.segmentos where id = (select seg_id from seg_todos)),
  0::bigint,
  'usuário da Beta não enxerga segmento da Alfa'
);
select is(
  (select count(*) from public.avaliar_segmento((select seg_id from seg_todos))),
  0::bigint,
  'usuário da Beta não consegue avaliar segmento da Alfa (RLS de segmentos bloqueia o join)'
);

select * from finish();
rollback;
