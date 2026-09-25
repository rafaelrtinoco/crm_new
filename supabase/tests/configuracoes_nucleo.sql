-- Configurações da empresa — fatia 2 (Núcleo). PRD §6.15.
-- Ver docs/configuracoes/SPEC-configuracoes-nucleo.md.

begin;
select no_plan();

set search_path = public, extensions;

-- ---------------------------------------------------------------------
-- Bloqueio de exclusão em uso — um caso por tabela, usando dado real do
-- seed (funil/etapa/motivo/tipo já referenciados por negócio/vencimento
-- da Alfa).
-- ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000102", "email": "gestor@segurosalfa.test", "role": "authenticated"}';

select throws_like(
  $$update public.funis set deleted_at = now() where id = 'a0000000-0000-0000-0000-000000000201'::uuid$$,
  '%ainda em uso por%negócio%',
  'não exclui funil em uso por negócio ativo'
);

select throws_like(
  $$update public.etapas set deleted_at = now() where id = 'a0000000-0000-0000-0000-000000000212'::uuid$$,
  '%ainda em uso por%negócio%',
  'não exclui etapa em uso por negócio ativo'
);

select throws_like(
  $$update public.motivos_perda set deleted_at = now() where id = 'a0000000-0000-0000-0000-000000000222'::uuid$$,
  '%ainda em uso por%negócio%',
  'não exclui motivo de perda em uso por negócio ativo'
);

select throws_like(
  $$update public.vencimento_tipos set deleted_at = now() where id = 'a0000000-0000-0000-0000-000000000231'::uuid$$,
  '%ainda em uso por%vencimento%',
  'não exclui tipo de vencimento em uso por vencimento ativo'
);

-- Tag em uso: cria uma tag nova e vincula a um contato ativo da Alfa.
with nova as (
  insert into public.tags (empresa_id, nome, created_by)
  values ('a0000000-0000-0000-0000-000000000001', 'Tag Em Uso', 'a0000000-0000-0000-0000-000000000102')
  returning id
)
select id as tag_em_uso_id into temporary tags_teste from nova;

insert into public.contato_tags (empresa_id, contato_id, tag_id, created_by)
select
  'a0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000301',
  tag_em_uso_id,
  'a0000000-0000-0000-0000-000000000102'
from tags_teste;

select throws_like(
  format($$update public.tags set deleted_at = now() where id = %L$$, (select tag_em_uso_id from tags_teste)),
  '%ainda em uso por%contato%',
  'não exclui tag em uso por contato ativo'
);

reset role;

-- ---------------------------------------------------------------------
-- Achado do security-check: `impedir_exclusao_tag_em_uso` precisa ser
-- `security definer` — sem isso, a contagem via RLS de `contatos` via
-- um "usuario" comum (sem carteira compartilhada) só enxerga os
-- PRÓPRIOS contatos, então ele conseguiria excluir uma tag em uso no
-- contato de um COLEGA sem a checagem barrar. Alfa nasce com
-- carteira_compartilhada=false (seed) — Ricardo (contato 303) é do
-- Gustavo (gestor), não da Carla; a tag abaixo é anexada a ele.
-- ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000102", "email": "gestor@segurosalfa.test", "role": "authenticated"}';

with nova as (
  insert into public.tags (empresa_id, nome, created_by)
  values ('a0000000-0000-0000-0000-000000000001', 'Tag Do Ricardo', 'a0000000-0000-0000-0000-000000000102')
  returning id
)
select id as tag_do_ricardo_id into temporary tags_ricardo_teste from nova;

insert into public.contato_tags (empresa_id, contato_id, tag_id, created_by)
select
  'a0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000303',
  tag_do_ricardo_id,
  'a0000000-0000-0000-0000-000000000102'
from tags_ricardo_teste;

reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000103", "email": "corretor@segurosalfa.test", "role": "authenticated"}';

select throws_like(
  format($$update public.tags set deleted_at = now() where id = %L$$, (select tag_do_ricardo_id from tags_ricardo_teste)),
  '%ainda em uso por%contato%',
  'Carla (usuário comum, sem carteira compartilhada) não exclui tag em uso no contato do Gustavo — a checagem enxerga além do que a RLS deixaria Carla ver'
);

reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000102", "email": "gestor@segurosalfa.test", "role": "authenticated"}';

-- ---------------------------------------------------------------------
-- Excluir sem uso funciona normalmente, e recriar com o mesmo nome
-- depois prova o índice único parcial — um caso por tabela. Criação e
-- exclusão em statements SEPARADOS de propósito: `with novo as (insert
-- ... returning id) update ... where id = (select id from novo)` não
-- funciona (armadilha real do Postgres, não bug do trigger/índice) — o
-- UPDATE do mesmo statement usa o snapshot de ANTES do INSERT da CTE,
-- então não enxerga a linha recém-criada (`UPDATE 0`, silencioso, sem
-- erro). Confirmado isolando o caso fora do pgTAP antes de corrigir
-- aqui. Captura o id em tabela temporária entre um statement e outro.
-- ---------------------------------------------------------------------
with novo as (
  insert into public.funis (empresa_id, nome, created_by)
  values ('a0000000-0000-0000-0000-000000000001', 'Funil Descartável', 'a0000000-0000-0000-0000-000000000102')
  returning id
)
select id as funil_descartavel_id into temporary funis_teste from novo;

select lives_ok(
  format($$update public.funis set deleted_at = now() where id = %L$$, (select funil_descartavel_id from funis_teste)),
  'exclui funil sem uso normalmente'
);

select lives_ok(
  $$insert into public.funis (empresa_id, nome, created_by)
    values ('a0000000-0000-0000-0000-000000000001', 'Funil Descartável', 'a0000000-0000-0000-0000-000000000102')$$,
  'recria funil com o mesmo nome do que foi excluído (índice parcial)'
);

with novo as (
  insert into public.motivos_perda (empresa_id, nome, created_by)
  values ('a0000000-0000-0000-0000-000000000001', 'Motivo Descartável', 'a0000000-0000-0000-0000-000000000102')
  returning id
)
select id as motivo_descartavel_id into temporary motivos_teste from novo;

select lives_ok(
  format($$update public.motivos_perda set deleted_at = now() where id = %L$$, (select motivo_descartavel_id from motivos_teste)),
  'exclui motivo de perda sem uso normalmente'
);

select lives_ok(
  $$insert into public.motivos_perda (empresa_id, nome, created_by)
    values ('a0000000-0000-0000-0000-000000000001', 'Motivo Descartável', 'a0000000-0000-0000-0000-000000000102')$$,
  'recria motivo de perda com o mesmo nome do que foi excluído (índice parcial)'
);

with novo as (
  insert into public.vencimento_tipos (empresa_id, nome, created_by)
  values ('a0000000-0000-0000-0000-000000000001', 'Tipo Reciclável', 'a0000000-0000-0000-0000-000000000102')
  returning id
)
select id as tipo_reciclavel_id into temporary tipos_teste from novo;

select lives_ok(
  format($$update public.vencimento_tipos set deleted_at = now() where id = %L$$, (select tipo_reciclavel_id from tipos_teste)),
  'exclui tipo de vencimento sem uso'
);

select lives_ok(
  $$insert into public.vencimento_tipos (empresa_id, nome, created_by)
    values ('a0000000-0000-0000-0000-000000000001', 'Tipo Reciclável', 'a0000000-0000-0000-0000-000000000102')$$,
  'recria tipo de vencimento com o mesmo nome do que foi excluído (índice parcial)'
);

with novo as (
  insert into public.tags (empresa_id, nome, created_by)
  values ('a0000000-0000-0000-0000-000000000001', 'Tag Reciclável', 'a0000000-0000-0000-0000-000000000102')
  returning id
)
select id as tag_reciclavel_id into temporary tags_reciclaveis_teste from novo;

select lives_ok(
  format($$update public.tags set deleted_at = now() where id = %L$$, (select tag_reciclavel_id from tags_reciclaveis_teste)),
  'exclui tag sem uso'
);

select lives_ok(
  $$insert into public.tags (empresa_id, nome, created_by)
    values ('a0000000-0000-0000-0000-000000000001', 'Tag Reciclável', 'a0000000-0000-0000-0000-000000000102')$$,
  'recria tag com o mesmo nome do que foi excluída (índice parcial)'
);

with novo as (
  insert into public.campos_personalizados (empresa_id, entidade, chave, rotulo, tipo, created_by)
  values ('a0000000-0000-0000-0000-000000000001', 'contato', 'campo_reciclavel', 'Campo Reciclável', 'texto', 'a0000000-0000-0000-0000-000000000102')
  returning id
)
select id as campo_reciclavel_id into temporary campos_teste from novo;

select lives_ok(
  format($$update public.campos_personalizados set deleted_at = now() where id = %L$$, (select campo_reciclavel_id from campos_teste)),
  'exclui campo personalizado sem checagem de uso (fora do escopo do bloqueio)'
);

select lives_ok(
  $$insert into public.campos_personalizados (empresa_id, entidade, chave, rotulo, tipo, created_by)
    values ('a0000000-0000-0000-0000-000000000001', 'contato', 'campo_reciclavel', 'Campo Reciclável', 'texto', 'a0000000-0000-0000-0000-000000000102')$$,
  'recria campo personalizado com a mesma chave da que foi excluída (índice parcial)'
);

reset role;

-- ---------------------------------------------------------------------
-- Isolamento: dono da Beta não altera configuração da Alfa — barrado
-- pela RLS já existente (tem_papel exige ser membro), antes mesmo do
-- trigger novo entrar em ação. UPDATE sob RLS não lança exceção quando
-- a linha é filtrada pela USING — só afeta zero linhas, silenciosamente
-- (mesma armadilha de teste já documentada em
-- docs/whatsapp-mock/SPEC-chat-whatsapp-mock.md, "correção 2"). Testa
-- que o nome continua intacto, não que uma exceção foi lançada.
-- ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "b0000000-0000-0000-0000-000000000101", "email": "dono@segurosbeta.test", "role": "authenticated"}';

select lives_ok(
  $$update public.funis set nome = 'Sequestrado' where id = 'a0000000-0000-0000-0000-000000000201'::uuid$$,
  'UPDATE do dono da Beta não lança exceção — RLS só filtra a linha, silenciosamente'
);

reset role;

select isnt(
  (select nome from public.funis where id = 'a0000000-0000-0000-0000-000000000201'::uuid),
  'Sequestrado',
  'dono da Beta não alterou o nome do funil da Alfa (RLS filtrou a linha, UPDATE afetou zero linhas)'
);

-- ---------------------------------------------------------------------
-- RLS de escrita: usuário comum não escreve nas 4 tabelas gestor-only,
-- mas escreve em tags (qualquer membro).
-- ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000103", "email": "corretor@segurosalfa.test", "role": "authenticated"}';

select throws_ok(
  $$insert into public.funis (empresa_id, nome, created_by)
    values ('a0000000-0000-0000-0000-000000000001', 'Funil da Carla', 'a0000000-0000-0000-0000-000000000103')$$,
  '42501',
  null,
  'usuário comum não cria funil'
);

select throws_ok(
  $$insert into public.vencimento_tipos (empresa_id, nome, created_by)
    values ('a0000000-0000-0000-0000-000000000001', 'Tipo da Carla', 'a0000000-0000-0000-0000-000000000103')$$,
  '42501',
  null,
  'usuário comum não cria tipo de vencimento'
);

select throws_ok(
  $$insert into public.motivos_perda (empresa_id, nome, created_by)
    values ('a0000000-0000-0000-0000-000000000001', 'Motivo da Carla', 'a0000000-0000-0000-0000-000000000103')$$,
  '42501',
  null,
  'usuário comum não cria motivo de perda'
);

select throws_ok(
  $$insert into public.campos_personalizados (empresa_id, entidade, chave, rotulo, tipo, created_by)
    values ('a0000000-0000-0000-0000-000000000001', 'contato', 'campo_carla', 'Campo da Carla', 'texto', 'a0000000-0000-0000-0000-000000000103')$$,
  '42501',
  null,
  'usuário comum não cria campo personalizado'
);

select lives_ok(
  $$insert into public.tags (empresa_id, nome, created_by)
    values ('a0000000-0000-0000-0000-000000000001', 'Tag da Carla', 'a0000000-0000-0000-0000-000000000103')$$,
  'usuário comum cria tag normalmente (qualquer membro pode)'
);

reset role;

select * from finish();
rollback;
