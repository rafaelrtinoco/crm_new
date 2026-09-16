-- Fase 3 recortada, módulo 1/5: fila de envios (docs/fase3/SPEC-fila-envios.md).
-- Cobre: bloqueio de escrita direta na tabela, autorização e
-- idempotência de enfileirar_envio, isolamento entre empresas, as
-- checagens do worker (contato excluído, endereço no canal,
-- consentimento/opt-out, horário comercial, limite de lote) e os dois
-- helpers de horário comercial isoladamente.
--
-- Empresa Alfa é America/Sao_Paulo (UTC-3, sem horário de verão desde
-- 2019 — offset fixo), horário comercial padrão seg-sex 08h-18h local.
-- 2026-09-14 é segunda-feira; 2026-09-19 é sábado.
--
-- p_agendado_para é sempre passado explicitamente nos enfileiramentos
-- abaixo (não o default now()) — os cenários usam datas fictícias de
-- 2026-09-14, e a data real do ambiente já passou disso.

begin;
select no_plan();

set search_path = public, extensions;

-- ---------------------------------------------------------------------
-- Helpers de horário comercial, isolados. Não concedidos a
-- authenticated (mesmo raciocínio de gerar_notificacoes_diarias) —
-- chamados como superuser, papel padrão no início do arquivo.
-- ---------------------------------------------------------------------
select is(
  public.dentro_horario_comercial('a0000000-0000-0000-0000-000000000001', '2026-09-14 13:00:00+00'),
  true,
  '10h de segunda-feira está dentro do horário comercial (seg-sex 08-18h local)'
);

select is(
  public.dentro_horario_comercial('a0000000-0000-0000-0000-000000000001', '2026-09-14 23:00:00+00'),
  false,
  '20h de segunda-feira está fora do horário comercial'
);

select is(
  public.dentro_horario_comercial('a0000000-0000-0000-0000-000000000001', '2026-09-19 15:00:00+00'),
  false,
  'sábado está fora — a empresa não abre aos sábados (sab: null)'
);

select is(
  public.proximo_horario_comercial('a0000000-0000-0000-0000-000000000001', '2026-09-14 23:00:00+00'),
  '2026-09-15 11:00:00+00'::timestamptz,
  'fora do horário numa segunda reagenda pra terça 8h local (11h UTC)'
);

select is(
  public.proximo_horario_comercial('a0000000-0000-0000-0000-000000000001', '2026-09-19 15:00:00+00'),
  '2026-09-21 11:00:00+00'::timestamptz,
  'sábado reagenda pra segunda 8h local, pulando o domingo'
);

-- ---------------------------------------------------------------------
-- Escrita direta em fila_envios é barrada — só enfileirar_envio/
-- processar_fila_envios escrevem (mesmo padrão de contatos/soft delete).
-- ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000103", "email": "corretor@segurosalfa.test", "role": "authenticated"}';

select throws_ok(
  $$
    insert into public.fila_envios (empresa_id, contato_id, canal, finalidade, origem_tipo, origem_id, chave_idempotencia, conteudo)
    values ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000301', 'email', 'atendimento', 'campanha', 'e0000000-0000-0000-0000-000000000900', 'teste:insert-direto', 'x')
  $$,
  '42501',
  null,
  'INSERT direto em fila_envios é barrado — precisa passar por enfileirar_envio'
);

-- ---------------------------------------------------------------------
-- enfileirar_envio: quem não tem acesso de escrita ao contato não
-- consegue enfileirar mensagem pra ele. Carla (usuário comum, Alfa sem
-- carteira compartilhada) tentando enfileirar pro contato de Gustavo.
-- ---------------------------------------------------------------------
select throws_ok(
  $$
    select public.enfileirar_envio(
      'a0000000-0000-0000-0000-000000000303', 'email', 'atendimento', 'campanha',
      'e0000000-0000-0000-0000-000000000900', 'teste:sem-permissao', 'x'
    )
  $$,
  'P0001',
  null,
  'usuário sem acesso ao contato não consegue enfileirar mensagem pra ele'
);

-- ---------------------------------------------------------------------
-- Idempotência: chamar duas vezes com a mesma chave não duplica.
-- ---------------------------------------------------------------------
select public.enfileirar_envio(
  'a0000000-0000-0000-0000-000000000301', 'email', 'atendimento', 'campanha',
  'e0000000-0000-0000-0000-000000000900', 'teste:idempotencia', 'Primeiro envio',
  null, '2026-09-14 09:00:00+00'
) as id into temporary env_idempotencia_1;

select public.enfileirar_envio(
  'a0000000-0000-0000-0000-000000000301', 'email', 'atendimento', 'campanha',
  'e0000000-0000-0000-0000-000000000900', 'teste:idempotencia', 'Segundo envio (deveria ser ignorado)',
  null, '2026-09-14 09:00:00+00'
) as id into temporary env_idempotencia_2;

select is(
  (select id from env_idempotencia_1),
  (select id from env_idempotencia_2),
  'chamar enfileirar_envio duas vezes com a mesma chave devolve o mesmo id, não duplica'
);

select is(
  (select count(*) from public.fila_envios where chave_idempotencia = 'teste:idempotencia'),
  1::bigint,
  'só existe uma linha na fila pra essa chave de idempotência'
);

-- ---------------------------------------------------------------------
-- Isolamento: Beto (Beta) não enxerga a fila da Alfa.
-- ---------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "b0000000-0000-0000-0000-000000000101", "email": "dono@segurosbeta.test", "role": "authenticated"}';

select is(
  (select count(*) from public.fila_envios where chave_idempotencia = 'teste:idempotencia'),
  0::bigint,
  'usuário da Beta não enxerga fila de envios da Alfa'
);

-- ---------------------------------------------------------------------
-- Cenário 1: marketing sem nenhum registro de consentimento (Fernanda
-- Alves) — bloqueada, sem_consentimento_marketing.
-- ---------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000103", "email": "corretor@segurosalfa.test", "role": "authenticated"}';

select public.enfileirar_envio(
  'a0000000-0000-0000-0000-000000000304', 'email', 'marketing', 'campanha',
  'e0000000-0000-0000-0000-000000000900', 'teste:sem-consentimento', 'Campanha de teste',
  null, '2026-09-14 09:00:00+00'
) as id into temporary env_sem_consentimento;

reset role;
select public.processar_fila_envios('2026-09-14 13:00:00+00'::timestamptz);

select is(
  (select status from public.fila_envios where id = (select id from env_sem_consentimento)),
  'bloqueada',
  'marketing sem nenhum registro de consentimento é bloqueada'
);
select is(
  (select motivo_bloqueio from public.fila_envios where id = (select id from env_sem_consentimento)),
  'sem_consentimento_marketing',
  'motivo correto: sem_consentimento_marketing'
);

-- ---------------------------------------------------------------------
-- Cenário 2: marketing com opt-out explícito (Marina Souza) —
-- bloqueada, optout.
-- ---------------------------------------------------------------------
insert into public.consentimentos (empresa_id, contato_id, finalidade, concedido, canal, created_by)
values ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000302', 'marketing', false, 'whatsapp', 'a0000000-0000-0000-0000-000000000101');

set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000103", "email": "corretor@segurosalfa.test", "role": "authenticated"}';

select public.enfileirar_envio(
  'a0000000-0000-0000-0000-000000000302', 'email', 'marketing', 'campanha',
  'e0000000-0000-0000-0000-000000000900', 'teste:optout', 'Campanha de teste',
  null, '2026-09-14 09:00:00+00'
) as id into temporary env_optout;

reset role;
select public.processar_fila_envios('2026-09-14 13:00:00+00'::timestamptz);

select is(
  (select status from public.fila_envios where id = (select id from env_optout)),
  'bloqueada',
  'marketing pra contato com opt-out explícito é bloqueada'
);
select is(
  (select motivo_bloqueio from public.fila_envios where id = (select id from env_optout)),
  'optout',
  'motivo correto: optout'
);

-- ---------------------------------------------------------------------
-- Cenário 3: atendimento sem nenhum registro de consentimento passa
-- (João Pereira) — só marketing exige opt-in explícito.
-- ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000103", "email": "corretor@segurosalfa.test", "role": "authenticated"}';

select public.enfileirar_envio(
  'a0000000-0000-0000-0000-000000000301', 'email', 'atendimento', 'campanha',
  'e0000000-0000-0000-0000-000000000900', 'teste:atendimento-sem-registro', 'Lembrete de vencimento',
  null, '2026-09-14 09:00:00+00'
) as id into temporary env_atendimento;

reset role;
select public.processar_fila_envios('2026-09-14 13:00:00+00'::timestamptz);

select is(
  (select status from public.fila_envios where id = (select id from env_atendimento)),
  'enviada',
  'atendimento sem nenhum registro de consentimento passa (só marketing exige opt-in)'
);

-- ---------------------------------------------------------------------
-- Cenário 4: marketing com consentimento concedido, dentro do horário
-- comercial — enviada.
-- ---------------------------------------------------------------------
insert into public.consentimentos (empresa_id, contato_id, finalidade, concedido, canal, created_by)
values ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000301', 'marketing', true, 'whatsapp', 'a0000000-0000-0000-0000-000000000101');

set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000103", "email": "corretor@segurosalfa.test", "role": "authenticated"}';

select public.enfileirar_envio(
  'a0000000-0000-0000-0000-000000000301', 'email', 'marketing', 'campanha',
  'e0000000-0000-0000-0000-000000000900', 'teste:marketing-com-consentimento', 'Campanha de teste',
  null, '2026-09-14 09:00:00+00'
) as id into temporary env_marketing_ok;

reset role;
select public.processar_fila_envios('2026-09-14 13:00:00+00'::timestamptz);

select is(
  (select status from public.fila_envios where id = (select id from env_marketing_ok)),
  'enviada',
  'marketing com consentimento concedido e dentro do horário comercial é enviada'
);
select isnt(
  (select processado_em from public.fila_envios where id = (select id from env_marketing_ok)),
  null,
  'processado_em é preenchido quando a mensagem é enviada'
);

-- ---------------------------------------------------------------------
-- Cenário 5: contato excluído depois de enfileirado (corrida: soft
-- delete acontece entre o enfileiramento e o worker rodar) — bloqueada,
-- contato_excluido. Exclusão passa por excluir_registro, o caminho real
-- de produção (soft_delete.sql já prova que UPDATE direto é barrado).
-- ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000102", "email": "gestor@segurosalfa.test", "role": "authenticated"}';

with novo as (
  insert into public.contatos (empresa_id, nome, status, telefone, email, responsavel_id, created_by)
  values (
    'a0000000-0000-0000-0000-000000000001', 'Contato Temporário Exclusão', 'lead',
    '(11) 90000-0001', 'temp-exclusao@exemplo.test',
    'a0000000-0000-0000-0000-000000000102', 'a0000000-0000-0000-0000-000000000102'
  )
  returning id
)
select id as contato_id into temporary contato_exclusao from novo;

select public.enfileirar_envio(
  (select contato_id from contato_exclusao), 'email', 'atendimento', 'campanha',
  'e0000000-0000-0000-0000-000000000900', 'teste:contato-excluido', 'Mensagem qualquer',
  null, '2026-09-14 09:00:00+00'
) as id into temporary env_contato_excluido;

select public.excluir_registro('contatos', (select contato_id from contato_exclusao));

reset role;
select public.processar_fila_envios('2026-09-14 13:00:00+00'::timestamptz);

select is(
  (select status from public.fila_envios where id = (select id from env_contato_excluido)),
  'bloqueada',
  'contato excluído depois de enfileirado é bloqueado pelo worker'
);
select is(
  (select motivo_bloqueio from public.fila_envios where id = (select id from env_contato_excluido)),
  'contato_excluido',
  'motivo correto: contato_excluido'
);

-- ---------------------------------------------------------------------
-- Cenário 6: contato sem e-mail cadastrado bloqueia canal email —
-- bloqueada, sem_endereco_email.
-- ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000101", "email": "dono@segurosalfa.test", "role": "authenticated"}';

with novo as (
  insert into public.contatos (empresa_id, nome, status, created_by)
  values ('a0000000-0000-0000-0000-000000000001', 'Contato Sem E-mail', 'lead', 'a0000000-0000-0000-0000-000000000101')
  returning id
)
select id as contato_id into temporary contato_sem_email from novo;

select public.enfileirar_envio(
  (select contato_id from contato_sem_email), 'email', 'atendimento', 'campanha',
  'e0000000-0000-0000-0000-000000000900', 'teste:sem-endereco-email', 'Mensagem qualquer',
  null, '2026-09-14 09:00:00+00'
) as id into temporary env_sem_endereco;

reset role;
select public.processar_fila_envios('2026-09-14 13:00:00+00'::timestamptz);

select is(
  (select status from public.fila_envios where id = (select id from env_sem_endereco)),
  'bloqueada',
  'contato sem e-mail cadastrado bloqueia envio de canal email'
);
select is(
  (select motivo_bloqueio from public.fila_envios where id = (select id from env_sem_endereco)),
  'sem_endereco_email',
  'motivo correto: sem_endereco_email'
);

-- ---------------------------------------------------------------------
-- Cenário 7: fora do horário comercial NÃO bloqueia — reagenda e
-- continua pendente.
-- ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000103", "email": "corretor@segurosalfa.test", "role": "authenticated"}';

select public.enfileirar_envio(
  'a0000000-0000-0000-0000-000000000301', 'email', 'atendimento', 'campanha',
  'e0000000-0000-0000-0000-000000000900', 'teste:fora-horario', 'Mensagem qualquer',
  null, '2026-09-14 09:00:00+00'
) as id into temporary env_fora_horario;

reset role;
select public.processar_fila_envios('2026-09-14 23:00:00+00'::timestamptz);

select is(
  (select status from public.fila_envios where id = (select id from env_fora_horario)),
  'pendente',
  'fora do horário comercial não bloqueia — continua pendente'
);
select is(
  (select agendado_para from public.fila_envios where id = (select id from env_fora_horario)),
  '2026-09-15 11:00:00+00'::timestamptz,
  'agendado_para é recalculado pra próxima abertura (terça 8h local)'
);

-- ---------------------------------------------------------------------
-- Cenário 8: p_limite respeitado — 3 pendentes, limite 2, processa só 2.
-- ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000103", "email": "corretor@segurosalfa.test", "role": "authenticated"}';

select public.enfileirar_envio(
  'a0000000-0000-0000-0000-000000000301', 'email', 'atendimento', 'campanha',
  'e0000000-0000-0000-0000-000000000900', 'teste:limite-1', 'x', null, '2026-09-14 09:00:00+00'
) as id into temporary env_limite_1;
select public.enfileirar_envio(
  'a0000000-0000-0000-0000-000000000302', 'email', 'atendimento', 'campanha',
  'e0000000-0000-0000-0000-000000000900', 'teste:limite-2', 'x', null, '2026-09-14 09:00:00+00'
) as id into temporary env_limite_2;
select public.enfileirar_envio(
  'a0000000-0000-0000-0000-000000000304', 'email', 'atendimento', 'campanha',
  'e0000000-0000-0000-0000-000000000900', 'teste:limite-3', 'x', null, '2026-09-14 09:00:00+00'
) as id into temporary env_limite_3;

reset role;
select enviadas, bloqueadas, reagendadas into temporary resultado_limite
from public.processar_fila_envios('2026-09-14 13:00:00+00'::timestamptz, 2);

select is(
  (select enviadas from resultado_limite),
  2::bigint,
  'p_limite=2 processa só 2 das 3 linhas pendentes'
);

select is(
  (select count(*) from public.fila_envios
    where chave_idempotencia in ('teste:limite-1', 'teste:limite-2', 'teste:limite-3')
      and status = 'pendente'),
  1::bigint,
  'a terceira linha continua pendente, sem ser tocada'
);

select * from finish();
rollback;
