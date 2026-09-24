-- Fase 3 recortada, módulo 5/5 (último): relatorios-origem
-- (docs/fase3/SPEC-relatorios-origem.md). Sem tabela nova, sem RLS nova —
-- cobre isolamento multiempresa (incluindo o p_empresa_id explícito que a
-- migration acrescentou em relação ao spec original, com um cenário de
-- usuário membro de DUAS empresas pra provar por que RLS sozinha não
-- bastava) e os dois relatórios fim-a-fim: leads por origem/UTM (período
-- incluindo/excluindo contato por created_at) e desempenho de campanhas
-- (mesmo padrão de disparo de campanhas.sql, conferindo contra
-- metricas_campanha chamada direto).
--
-- Contatos do cenário de leads usam created_at fixo em janeiro/2026 —
-- bem longe de "agora" e do seed (que grava now() real) — pra não sofrer
-- contaminação de contato do seed ou de outro bloco deste arquivo, mesmo
-- cuidado de fila_envios.sql/campanhas.sql com datas fixas quando o
-- valor importa pro resultado. Já o disparo de campanha usa
-- current_date (disparada_em = now() real, sem parâmetro pra fixar).

begin;
select no_plan();

set search_path = public, extensions;

-- Gustavo (gestor da Alfa) também vira membro comum da Beta — só pra
-- provar que relatorio_leads_por_origem('empresa Alfa', ...) não mistura
-- contato da Beta mesmo quando o invoker É membro das duas (RLS de
-- contatos, sozinha, deixaria; o filtro explícito p_empresa_id é quem
-- garante o isolamento aqui).
insert into public.empresa_membros (empresa_id, usuario_id, papel) values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000102', 'usuario');

set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000102", "email": "gestor@segurosalfa.test", "role": "authenticated"}';

-- ---------------------------------------------------------------------
-- relatorio_leads_por_origem: 2 origens dentro do período (3 contatos) +
-- 1 contato da mesma origem só que fora do período (deve sumir) + 1
-- contato da Beta (Gustavo agora é membro de lá também, mas pediu
-- p_empresa_id da Alfa — não pode aparecer).
-- ---------------------------------------------------------------------
insert into public.contatos (empresa_id, nome, status, origem, utm_campaign, responsavel_id, created_by, created_at) values
  ('a0000000-0000-0000-0000-000000000001', 'Relatório FB Cliente', 'cliente', 'facebook_ads', 'promo_verao', 'a0000000-0000-0000-0000-000000000102', 'a0000000-0000-0000-0000-000000000102', '2026-01-15 12:00:00+00'),
  ('a0000000-0000-0000-0000-000000000001', 'Relatório FB Lead', 'lead', 'facebook_ads', 'promo_verao', 'a0000000-0000-0000-0000-000000000102', 'a0000000-0000-0000-0000-000000000102', '2026-01-20 12:00:00+00'),
  ('a0000000-0000-0000-0000-000000000001', 'Relatório Google Lead', 'lead', 'google_ads', null, 'a0000000-0000-0000-0000-000000000102', 'a0000000-0000-0000-0000-000000000102', '2026-01-10 12:00:00+00'),
  ('a0000000-0000-0000-0000-000000000001', 'Relatório FB Fora Do Período', 'cliente', 'facebook_ads', 'promo_verao', 'a0000000-0000-0000-0000-000000000102', 'a0000000-0000-0000-0000-000000000102', '2025-12-20 12:00:00+00'),
  ('b0000000-0000-0000-0000-000000000001', 'Relatório Beta (não pode vazar)', 'lead', 'facebook_ads', 'promo_verao', 'a0000000-0000-0000-0000-000000000102', 'a0000000-0000-0000-0000-000000000102', '2026-01-15 12:00:00+00');

select results_eq(
  $$ select origem, utm_campaign, total_leads, convertidos, taxa_conversao
     from public.relatorio_leads_por_origem('a0000000-0000-0000-0000-000000000001'::uuid, '2026-01-01'::date, '2026-01-31'::date)
     order by total_leads desc, origem $$,
  $$ values
      ('facebook_ads'::text, 'promo_verao'::text, 2::bigint, 1::bigint, 0.5::numeric),
      ('google_ads'::text, null::text, 1::bigint, 0::bigint, 0::numeric)
  $$,
  'leads por origem: só o período pedido, convertidos = status atual (não "converteu no período"), taxa correta; contato fora do período e contato da Beta não aparecem'
);

-- ---------------------------------------------------------------------
-- Isolamento: Beto (Beta) pedindo relatório da Alfa não vê nada.
-- ---------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "b0000000-0000-0000-0000-000000000101", "email": "dono@segurosbeta.test", "role": "authenticated"}';

select is(
  (select count(*) from public.relatorio_leads_por_origem('a0000000-0000-0000-0000-000000000001'::uuid, '1900-01-01'::date, '2100-01-01'::date)),
  0::bigint,
  'usuário da Beta pedindo relatório com empresa_id da Alfa não vê nada (RLS bloqueia o join com contatos)'
);

set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000102", "email": "gestor@segurosalfa.test", "role": "authenticated"}';

-- ---------------------------------------------------------------------
-- relatorio_desempenho_campanhas: dispara uma campanha de verdade
-- (mesmo padrão do bloco "metricas_campanha fim-a-fim" de campanhas.sql)
-- e confere que o relatório bate com metricas_campanha chamada direto.
-- ---------------------------------------------------------------------
insert into public.contatos (empresa_id, nome, status, email, telefone, origem, responsavel_id, created_by) values
  ('a0000000-0000-0000-0000-000000000001', 'Relatório Campanha Ok', 'lead', 'relatorio.campanha@teste.test', '(11) 90000-0021', 'teste_relatorio_campanha', 'a0000000-0000-0000-0000-000000000102', 'a0000000-0000-0000-0000-000000000102');

insert into public.consentimentos (empresa_id, contato_id, finalidade, concedido, canal)
select 'a0000000-0000-0000-0000-000000000001', id, 'marketing', true, 'formulario'
from public.contatos where nome = 'Relatório Campanha Ok' and origem = 'teste_relatorio_campanha';

with novo as (
  insert into public.segmentos (empresa_id, nome, criterios)
  values (
    'a0000000-0000-0000-0000-000000000001', 'Teste relatório desempenho',
    '{"regras": [{"campo": "origem", "operador": "em", "valor": ["teste_relatorio_campanha"]}]}'::jsonb
  )
  returning id
)
select id as seg_id into temporary seg_relatorio from novo;

with novo as (
  insert into public.campanhas (empresa_id, nome, canal, segmento_id, assunto, blocos, created_by)
  values (
    'a0000000-0000-0000-0000-000000000001', 'Campanha relatório desempenho', 'email', (select seg_id from seg_relatorio),
    'Assunto teste relatório', '[{"tipo":"texto","conteudo":"Texto teste relatório"}]'::jsonb,
    'a0000000-0000-0000-0000-000000000102'
  )
  returning id
)
select id as camp_id into temporary camp_relatorio from novo;

select public.disparar_campanha((select camp_id from camp_relatorio));

-- Mesmo horário comercial fixo usado em campanhas.sql/fila_envios.sql —
-- não depende do dia real em que o teste roda.
reset role;
select public.processar_fila_envios('2026-09-14 13:00:00+00'::timestamptz);
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000102", "email": "gestor@segurosalfa.test", "role": "authenticated"}';

select results_eq(
  format(
    $$ select r.enviados, r.bloqueados, r.optouts, r.negocios_gerados
       from public.relatorio_desempenho_campanhas('a0000000-0000-0000-0000-000000000001'::uuid, current_date - 1, current_date + 1) r
       where r.campanha_id = %L $$,
    (select camp_id from camp_relatorio)
  ),
  format(
    $$ select enviados, bloqueados, optouts, negocios_gerados from public.metricas_campanha(%L) $$,
    (select camp_id from camp_relatorio)
  ),
  'desempenho de campanhas: números do relatório batem exatamente com metricas_campanha chamada direto'
);

select is(
  (select count(*) from public.relatorio_desempenho_campanhas('a0000000-0000-0000-0000-000000000001'::uuid, '1900-01-01'::date, '1900-01-02'::date)
   where campanha_id = (select camp_id from camp_relatorio)),
  0::bigint,
  'período fora do dia do disparo não traz a campanha'
);

-- ---------------------------------------------------------------------
-- Isolamento: Beto (Beta) pedindo desempenho de campanhas da Alfa não
-- vê nada.
-- ---------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "b0000000-0000-0000-0000-000000000101", "email": "dono@segurosbeta.test", "role": "authenticated"}';

select is(
  (select count(*) from public.relatorio_desempenho_campanhas('a0000000-0000-0000-0000-000000000001'::uuid, '1900-01-01'::date, '2100-01-01'::date)),
  0::bigint,
  'usuário da Beta pedindo desempenho de campanhas com empresa_id da Alfa não vê nada'
);

select * from finish();
rollback;
