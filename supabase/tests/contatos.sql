-- ultimo_contato_em (PRD §6.3): toda atividade vinculada a um contato
-- atualiza o timestamp automaticamente.

begin;
select no_plan();

set search_path = public, extensions;

set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000103", "email": "corretor@segurosalfa.test", "role": "authenticated"}';

select ok(
  (select ultimo_contato_em from public.contatos where id = 'a0000000-0000-0000-0000-000000000302') < (now() - interval '30 minutes'),
  'valor inicial do seed é antigo (não foi tocado por esta transação ainda)'
);

insert into public.atividades (empresa_id, contato_id, tipo, conteudo, responsavel_id)
values (
  'a0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000302',
  'nota',
  '{"texto": "Liguei, sem resposta"}'::jsonb,
  'a0000000-0000-0000-0000-000000000103'
);

select ok(
  (select ultimo_contato_em from public.contatos where id = 'a0000000-0000-0000-0000-000000000302') > (now() - interval '1 minute'),
  'inserir atividade pro contato atualiza ultimo_contato_em pra agora'
);

-- Atividade sem contato_id (ex.: só ligada a negócio) não deve quebrar nada.
select lives_ok(
  $$
    insert into public.atividades (empresa_id, negocio_id, tipo, conteudo, responsavel_id)
    select 'a0000000-0000-0000-0000-000000000001', id, 'nota', '{"texto": "sem contato"}'::jsonb, 'a0000000-0000-0000-0000-000000000103'
    from public.negocios where empresa_id = 'a0000000-0000-0000-0000-000000000001' limit 1
  $$,
  'atividade sem contato_id não gera erro no trigger'
);

select * from finish();
rollback;
