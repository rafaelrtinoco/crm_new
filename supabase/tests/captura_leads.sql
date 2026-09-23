-- Fase 3 recortada, módulo 3/5: captura de leads (docs/fase3/SPEC-captura-leads.md).
-- Cobre: isolamento multiempresa nas 3 tabelas novas, RLS de escrita (só
-- gestor+ cria), token_hash nunca legível por authenticated (nem
-- gestor, via column grant), submeter_formulario cria lead com
-- rodízio/fixo corretos, receber_lead_webhook aceita token certo e
-- rejeita errado/revogado com 42501, obter_pagina_captura_publica não
-- vaza dado de outra empresa por slug adivinhado, CHECK de
-- distribuição fixa sem responsável, e definir_slug_empresa (correção
-- 5 da migration — RLS de empresas é dono-only, gestor precisa da
-- função dedicada).
--
-- Datas relativas a current_date/now() em todo o arquivo — mesma lição
-- de segmentos.sql/fila_envios.sql.

begin;
select no_plan();

set search_path = public, extensions;

set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000102", "email": "gestor@segurosalfa.test", "role": "authenticated"}';

-- ---------------------------------------------------------------------
-- definir_slug_empresa: usuário comum não consegue; gestor consegue.
-- ---------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000103", "email": "corretor@segurosalfa.test", "role": "authenticated"}';

select throws_ok(
  $$ select public.definir_slug_empresa('a0000000-0000-0000-0000-000000000001', 'seguros-alfa') $$,
  'P0001',
  'Sem permissão para configurar esta empresa',
  'usuário comum não consegue definir slug da empresa'
);

set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000102", "email": "gestor@segurosalfa.test", "role": "authenticated"}';

select lives_ok(
  $$ select public.definir_slug_empresa('a0000000-0000-0000-0000-000000000001', 'seguros-alfa') $$,
  'gestor consegue definir slug da própria empresa'
);

select is(
  (select slug from public.empresas where id = 'a0000000-0000-0000-0000-000000000001'),
  'seguros-alfa',
  'slug gravado corretamente'
);

-- ---------------------------------------------------------------------
-- RLS de escrita: comum não cria formulário/página/integração; gestor
-- consegue.
-- ---------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000103", "email": "corretor@segurosalfa.test", "role": "authenticated"}';

select throws_ok(
  $$
    insert into public.formularios (empresa_id, nome)
    values ('a0000000-0000-0000-0000-000000000001', 'Tentativa Carla')
  $$,
  '42501',
  null,
  'usuário comum não consegue criar formulário — só gestor+'
);

select throws_ok(
  $$ select public.criar_integracao('a0000000-0000-0000-0000-000000000001', 'Tentativa Carla') $$,
  'P0001',
  'Sem permissão para criar integração',
  'usuário comum não consegue criar integração — só gestor+'
);

set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000102", "email": "gestor@segurosalfa.test", "role": "authenticated"}';

with novo as (
  insert into public.formularios (empresa_id, nome, distribuicao_tipo)
  values ('a0000000-0000-0000-0000-000000000001', 'Formulário site', 'rodizio')
  returning id
)
select id as formulario_id into temporary form_rodizio from novo;

select ok((select formulario_id from form_rodizio) is not null, 'gestor consegue criar formulário');

with novo as (
  insert into public.paginas_captura (empresa_id, slug, titulo, formulario_id, whatsapp_numero, whatsapp_mensagem)
  values (
    'a0000000-0000-0000-0000-000000000001', 'fale-conosco', 'Fale com a Alfa',
    (select formulario_id from form_rodizio), '11999990000', 'Olá, quero um seguro'
  )
  returning id
)
select id as pagina_id into temporary pagina from novo;

select ok((select pagina_id from pagina) is not null, 'gestor consegue criar página de captura');

-- ---------------------------------------------------------------------
-- CHECK: distribuição fixa exige responsavel_fixo_id.
-- ---------------------------------------------------------------------
select throws_ok(
  $$
    insert into public.formularios (empresa_id, nome, distribuicao_tipo)
    values ('a0000000-0000-0000-0000-000000000001', 'Fixo sem responsável', 'fixo')
  $$,
  '23514',
  null,
  'distribuicao_tipo=fixo sem responsavel_fixo_id é rejeitado no CHECK'
);

-- ---------------------------------------------------------------------
-- criar_integracao: token só sai uma vez, token_hash nunca é legível
-- por authenticated depois — nem gestor, nem via select direto na
-- coluna (column grant, não só a UI que "não mostra").
-- ---------------------------------------------------------------------
select * from public.criar_integracao('a0000000-0000-0000-0000-000000000001', 'Integração de teste', 'rodizio')
\gset integ_

select ok(length(:'integ_token') > 0, 'criar_integracao devolve o token em claro na criação');

select throws_ok(
  format($$ select token_hash from public.integracoes where id = %L $$, :'integ_id'),
  '42501',
  null,
  'gestor não consegue ler token_hash mesmo com select direto na coluna'
);

select lives_ok(
  format($$ select id, nome from public.integracoes where id = %L $$, :'integ_id'),
  'gestor consegue ler as outras colunas de integracoes normalmente'
);

-- ---------------------------------------------------------------------
-- submeter_formulario: nome obrigatório, formulário inativo/inexistente
-- rejeitados; contato nasce lead/origem/UTM corretos; rodízio distribui
-- entre os 3 membros ativos da Alfa (101, 102, 103, nessa ordem —
-- created_at empatado no seed, desempate por usuario_id) antes de
-- repetir.
-- ---------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000102", "email": "gestor@segurosalfa.test", "role": "authenticated"}';

select throws_ok(
  format($$ select public.submeter_formulario(%L, '{"telefone":"11900000000"}'::jsonb, '{}'::jsonb) $$, (select formulario_id from form_rodizio)),
  'P0001',
  'Nome é obrigatório',
  'submeter_formulario sem nome é rejeitado'
);

select throws_ok(
  $$ select public.submeter_formulario('00000000-0000-0000-0000-000000000000'::uuid, '{"nome":"X"}'::jsonb, '{}'::jsonb) $$,
  'P0001',
  'Formulário não encontrado ou inativo',
  'submeter_formulario com id inexistente é rejeitado'
);

-- Correção do security-check: "excluir" (soft delete) um formulário
-- também bloqueia submeter_formulario, não só some da lista/embed.
with novo as (
  insert into public.formularios (empresa_id, nome, distribuicao_tipo)
  values ('a0000000-0000-0000-0000-000000000001', 'Formulário excluído', 'rodizio')
  returning id
)
select id as formulario_id into temporary form_excluido from novo;

update public.formularios set deleted_at = now() where id = (select formulario_id from form_excluido);

select throws_ok(
  format($$ select public.submeter_formulario(%L, '{"nome":"X"}'::jsonb, '{}'::jsonb) $$, (select formulario_id from form_excluido)),
  'P0001',
  'Formulário não encontrado ou inativo',
  'submeter_formulario recusa formulário excluído (soft delete), não só inativo'
);

select public.submeter_formulario(
  (select formulario_id from form_rodizio),
  '{"nome":"Lead Um","telefone":"11988880001","email":"lead1@teste.test"}'::jsonb,
  '{"utm_source":"google"}'::jsonb
);
select public.submeter_formulario((select formulario_id from form_rodizio), '{"nome":"Lead Dois"}'::jsonb, '{}'::jsonb);
select public.submeter_formulario((select formulario_id from form_rodizio), '{"nome":"Lead Tres"}'::jsonb, '{}'::jsonb);
select public.submeter_formulario((select formulario_id from form_rodizio), '{"nome":"Lead Quatro"}'::jsonb, '{}'::jsonb);

select is(
  (select status from public.contatos where nome = 'Lead Um'), 'lead', 'lead criado com status=lead'
);
select is(
  (select origem from public.contatos where nome = 'Lead Um'), 'formulario', 'lead criado com origem=formulario'
);
select is(
  (select utm_source from public.contatos where nome = 'Lead Um'), 'google', 'UTM preenchido a partir do p_utm'
);
select is(
  (select array_agg(responsavel_id order by created_at)
   from public.contatos where nome in ('Lead Um', 'Lead Dois', 'Lead Tres', 'Lead Quatro')),
  array[
    'a0000000-0000-0000-0000-000000000101'::uuid,
    'a0000000-0000-0000-0000-000000000102'::uuid,
    'a0000000-0000-0000-0000-000000000103'::uuid,
    'a0000000-0000-0000-0000-000000000101'::uuid
  ],
  'rodízio passa pelos 3 membros ativos antes de repetir'
);

-- distribuição fixa: sempre o mesmo responsável.
with novo as (
  insert into public.formularios (empresa_id, nome, distribuicao_tipo, responsavel_fixo_id)
  values ('a0000000-0000-0000-0000-000000000001', 'Formulário fixo', 'fixo', 'a0000000-0000-0000-0000-000000000103')
  returning id
)
select id as formulario_id into temporary form_fixo from novo;

select public.submeter_formulario((select formulario_id from form_fixo), '{"nome":"Lead Fixo Um"}'::jsonb, '{}'::jsonb);
select public.submeter_formulario((select formulario_id from form_fixo), '{"nome":"Lead Fixo Dois"}'::jsonb, '{}'::jsonb);

select is(
  (select array_agg(distinct responsavel_id) from public.contatos where nome like 'Lead Fixo %'),
  array['a0000000-0000-0000-0000-000000000103'::uuid],
  'distribuição fixa sempre atribui ao mesmo responsável'
);

-- ---------------------------------------------------------------------
-- receber_lead_webhook: token certo cria lead com origem=webhook;
-- token errado/revogado lança 42501; ultimo_uso_em atualiza.
-- ---------------------------------------------------------------------
select public.receber_lead_webhook(:'integ_token', 'Lead Webhook Ok', '11977770000', null, '{}'::jsonb, '{"utm_source":"parceiro"}'::jsonb);

select is(
  (select origem from public.contatos where nome = 'Lead Webhook Ok'), 'webhook', 'lead via webhook nasce com origem=webhook'
);
select is(
  (select utm_source from public.contatos where nome = 'Lead Webhook Ok'), 'parceiro', 'UTM do webhook preenchido'
);
select ok(
  (select ultimo_uso_em is not null from public.integracoes where id = :'integ_id'::uuid),
  'ultimo_uso_em atualizado após uso do token'
);

select throws_ok(
  $$ select public.receber_lead_webhook('token-invalido-qualquer', 'Nao deve entrar') $$,
  '42501',
  'Token inválido ou revogado',
  'token errado é rejeitado com 42501 explícito'
);
select is(
  (select count(*) from public.contatos where nome = 'Nao deve entrar'), 0::bigint,
  'token errado não cria contato nenhum'
);

-- revogar_integracao: token deixa de funcionar depois de revogado.
select public.revogar_integracao(:'integ_id'::uuid);
select throws_ok(
  format($$ select public.receber_lead_webhook(%L, 'Depois de revogado') $$, :'integ_token'),
  '42501',
  'Token inválido ou revogado',
  'token revogado deixa de funcionar'
);

-- ---------------------------------------------------------------------
-- obter_pagina_captura_publica: devolve só as colunas esperadas, sem
-- vazar empresa_id nem outros dados de outra empresa por slug
-- adivinhado. security definer de propósito (correção 1) — testado sem
-- sessão nenhuma, como um visitante real.
-- ---------------------------------------------------------------------
reset role;
reset request.jwt.claims;

select results_eq(
  $$ select titulo, empresa_nome from public.obter_pagina_captura_publica('seguros-alfa', 'fale-conosco') $$,
  $$ values ('Fale com a Alfa'::text, 'Seguros Alfa'::text) $$,
  'visitante anônimo lê a página de captura pública corretamente'
);

select is(
  (select count(*) from public.obter_pagina_captura_publica('slug-que-nao-existe', 'nada')),
  0::bigint,
  'slug de empresa inexistente não vaza nada'
);
select is(
  (select count(*) from public.obter_pagina_captura_publica('seguros-alfa', 'pagina-que-nao-existe')),
  0::bigint,
  'slug de página inexistente (empresa certa) não vaza nada'
);

select results_eq(
  format($$ select nome from public.obter_formulario_publico(%L) $$, (select formulario_id from form_rodizio)),
  $$ values ('Formulário site'::text) $$,
  'visitante anônimo lê o formulário embutível corretamente'
);

-- ---------------------------------------------------------------------
-- Isolamento multiempresa: Beto (Beta) não enxerga formulário, página
-- nem integração da Alfa.
-- ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "b0000000-0000-0000-0000-000000000101", "email": "dono@segurosbeta.test", "role": "authenticated"}';

select is(
  (select count(*) from public.formularios where id = (select formulario_id from form_rodizio)),
  0::bigint,
  'usuário da Beta não enxerga formulário da Alfa'
);
select is(
  (select count(*) from public.paginas_captura where id = (select pagina_id from pagina)),
  0::bigint,
  'usuário da Beta não enxerga página de captura da Alfa'
);
select is(
  (select count(*) from public.integracoes where id = :'integ_id'::uuid),
  0::bigint,
  'usuário da Beta não enxerga integração da Alfa'
);

select * from finish();
rollback;
