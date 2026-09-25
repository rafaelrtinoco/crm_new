-- Configurações da empresa — fatia 1 (Empresa). PRD §6.15.
-- Ver docs/configuracoes/SPEC-configuracoes-empresa.md.

begin;
select no_plan();

set search_path = public, extensions;

-- ---------------------------------------------------------------------
-- Gestor da Alfa atualiza as configurações — o valor muda.
-- ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000102", "email": "gestor@segurosalfa.test", "role": "authenticated"}';

select lives_ok(
  $$select public.atualizar_configuracoes_empresa(
    'a0000000-0000-0000-0000-000000000001'::uuid,
    'Seguros Alfa Corretora',
    'America/Recife',
    '{"seg_sex": ["09:00", "19:00"], "sab": ["09:00", "12:00"], "dom": null}'::jsonb,
    'https://exemplo.test/logo-alfa.png',
    '#2563EB'
  )$$,
  'gestor da Alfa consegue atualizar as configurações da própria empresa'
);

reset role;

select results_eq(
  $$select nome, fuso, cor_primaria from public.empresas where id = 'a0000000-0000-0000-0000-000000000001'::uuid$$,
  $$values ('Seguros Alfa Corretora'::text, 'America/Recife'::text, '#2563EB'::text)$$,
  'os valores gravados batem com o que o gestor enviou'
);

select is(
  (select horario_comercial ->> 'sab' from public.empresas where id = 'a0000000-0000-0000-0000-000000000001'::uuid),
  '["09:00", "12:00"]',
  'horário de sábado foi gravado corretamente'
);

-- ---------------------------------------------------------------------
-- Usuário comum (Carla) não passa no guard de papel da função.
-- ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000103", "email": "corretor@segurosalfa.test", "role": "authenticated"}';

select throws_ok(
  $$select public.atualizar_configuracoes_empresa(
    'a0000000-0000-0000-0000-000000000001'::uuid,
    'Nome Indevido',
    'America/Sao_Paulo',
    '{"seg_sex": ["08:00", "18:00"], "sab": null, "dom": null}'::jsonb,
    null, null
  )$$,
  'P0001',
  'Sem permissão para configurar esta empresa',
  'usuário comum não consegue atualizar configurações da empresa'
);

reset role;

-- ---------------------------------------------------------------------
-- Isolamento: dono da Beta não altera a Alfa (nem sequer é membro dela,
-- então tem_papel falha por falta de vínculo, não só por papel baixo).
-- ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "b0000000-0000-0000-0000-000000000101", "email": "dono@segurosbeta.test", "role": "authenticated"}';

select throws_ok(
  $$select public.atualizar_configuracoes_empresa(
    'a0000000-0000-0000-0000-000000000001'::uuid,
    'Empresa Sequestrada',
    'America/Sao_Paulo',
    '{"seg_sex": ["08:00", "18:00"], "sab": null, "dom": null}'::jsonb,
    null, null
  )$$,
  'P0001',
  'Sem permissão para configurar esta empresa',
  'dono de outra empresa (Beta) não consegue alterar a Alfa'
);

reset role;

select is(
  (select nome from public.empresas where id = 'a0000000-0000-0000-0000-000000000001'::uuid),
  'Seguros Alfa Corretora',
  'nome da Alfa continua o valor gravado pelo gestor, não o sequestro tentado'
);

-- ---------------------------------------------------------------------
-- Trigger valida os dois caminhos de escrita — inclui o dono gravando
-- DIRETO em `empresas` (não via RPC), provando que a validação não
-- ficou só do lado da função.
-- ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000101", "email": "dono@segurosalfa.test", "role": "authenticated"}';

select throws_like(
  $$update public.empresas set fuso = 'Planeta/Inexistente' where id = 'a0000000-0000-0000-0000-000000000001'::uuid$$,
  '%Fuso horário inválido%',
  'trigger rejeita fuso inválido mesmo em UPDATE direto do dono'
);

select throws_like(
  $$update public.empresas
    set horario_comercial = '{"seg_sex": ["08:00", "18:00"], "sab": null}'::jsonb
    where id = 'a0000000-0000-0000-0000-000000000001'::uuid$$,
  '%chaves seg_sex, sab e dom%',
  'trigger rejeita horario_comercial sem a chave dom'
);

select throws_like(
  $$update public.empresas
    set horario_comercial = '{"seg_sex": ["18:00", "08:00"], "sab": null, "dom": null}'::jsonb
    where id = 'a0000000-0000-0000-0000-000000000001'::uuid$$,
  '%janela inválida%',
  'trigger rejeita janela com início depois do fim'
);

select throws_like(
  $$update public.empresas set cor_primaria = 'azul' where id = 'a0000000-0000-0000-0000-000000000001'::uuid$$,
  '%hex de 6 dígitos%',
  'trigger rejeita cor_primaria que não é hex'
);

select lives_ok(
  $$update public.empresas set cor_primaria = null where id = 'a0000000-0000-0000-0000-000000000001'::uuid$$,
  'cor_primaria nula continua permitida (sem marca definida)'
);

reset role;

-- ---------------------------------------------------------------------
-- janela_horario_valida — casos diretos da função pura, sem passar
-- pela tabela.
-- ---------------------------------------------------------------------
select ok(public.janela_horario_valida(null), 'janela nula é válida (chave ausente tratada como fechado)');
select ok(public.janela_horario_valida('null'::jsonb), 'janela JSON null é válida (dia fechado)');
select ok(public.janela_horario_valida('["08:00", "18:00"]'::jsonb), 'janela bem formada é válida');
select ok(not public.janela_horario_valida('["18:00", "08:00"]'::jsonb), 'início >= fim é inválido');
select ok(not public.janela_horario_valida('["8:00", "18:00"]'::jsonb), 'horário sem zero à esquerda é inválido');
select ok(not public.janela_horario_valida('["08:00"]'::jsonb), 'array com 1 elemento é inválido');
select ok(not public.janela_horario_valida('"08:00-18:00"'::jsonb), 'string solta (não array) é inválida');

-- ---------------------------------------------------------------------
-- Storage — bucket `logos`: gestor insere na própria pasta, usuário de
-- outra empresa não insere na pasta alheia, pasta que não é uuid é
-- negada sem estourar a avaliação da policy.
-- ---------------------------------------------------------------------
select ok(
  (select public from storage.buckets where id = 'logos'),
  'bucket logos existe e é público'
);

set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000102", "email": "gestor@segurosalfa.test", "role": "authenticated"}';

select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner)
    values ('logos', 'a0000000-0000-0000-0000-000000000001/logo.png', 'a0000000-0000-0000-0000-000000000102')$$,
  'gestor da Alfa insere um objeto na própria pasta do bucket logos'
);

reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "b0000000-0000-0000-0000-000000000101", "email": "dono@segurosbeta.test", "role": "authenticated"}';

select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner)
    values ('logos', 'a0000000-0000-0000-0000-000000000001/logo-invasor.png', 'b0000000-0000-0000-0000-000000000101')$$,
  '42501',
  null,
  'dono da Beta não insere objeto na pasta da Alfa'
);

select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner)
    values ('logos', 'nao-e-um-uuid/logo.png', 'b0000000-0000-0000-0000-000000000101')$$,
  '42501',
  null,
  'pasta que não é uuid é negada (sem estourar a policy)'
);

reset role;

select * from finish();
rollback;
