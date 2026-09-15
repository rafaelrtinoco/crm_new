-- Redesenho do núcleo (parte 5/6): soft delete deixa de ser
-- responsabilidade de cada consulta lembrar (`.is("deleted_at", null)`
-- no cliente). Isso já causou um bug real: a taxa de renovação exibida
-- na tela "Hoje" (`useResumoNumeros`) contava vencimentos excluídos,
-- porque duas das cinco consultas ali não tinham o filtro.
--
-- Escopo: só as tabelas com dono (`pode_acessar_responsavel`) —
-- contatos, vencimentos, negócios, tarefas, organizações. Configuração
-- compartilhada (funis, tags, tipos etc.) não muda aqui.
--
-- Descoberta no caminho (documentada porque não é óbvia): colocar
-- `deleted_at is null` na policy de SELECT e tentar reaproveitar a MESMA
-- policy (FOR ALL) pra escrita não funciona — o Postgres reaplica a
-- USING da policy de SELECT contra a linha NOVA de todo UPDATE, então a
-- própria escrita que seta `deleted_at = now()` se autobloqueia,
-- **mesmo** com um WITH CHECK explícito e mesmo com a permissão de
-- escrita numa policy separada. A única forma de fazer a exclusão em si
-- funcionar com `deleted_at is null` na policy de leitura é a escrita
-- não passar pela RLS normal: por isso `excluir_registro`, simétrico a
-- `restaurar_registro`. Confirmado experimentalmente antes de escrever
-- isto — não é suposição.
--
-- Por isso: 4 policies por tabela (select/insert/update/delete) em vez
-- de 1. FOR ALL não serve pra escrita aqui porque também concederia
-- SELECT sem o filtro de `deleted_at`, reabrindo a brecha por outra
-- porta (OR entre policies permissivas do mesmo comando).

drop policy "contatos_por_responsavel" on public.contatos;
create policy "contatos_select"
  on public.contatos for select
  to authenticated
  using (public.pode_acessar_responsavel(empresa_id, responsavel_id) and deleted_at is null);
create policy "contatos_insert"
  on public.contatos for insert
  to authenticated
  with check (public.pode_acessar_responsavel(empresa_id, responsavel_id));
create policy "contatos_update"
  on public.contatos for update
  to authenticated
  using (public.pode_acessar_responsavel(empresa_id, responsavel_id))
  with check (public.pode_acessar_responsavel(empresa_id, responsavel_id));
create policy "contatos_delete"
  on public.contatos for delete
  to authenticated
  using (public.pode_acessar_responsavel(empresa_id, responsavel_id));

drop policy "vencimentos_por_responsavel" on public.vencimentos;
create policy "vencimentos_select"
  on public.vencimentos for select
  to authenticated
  using (public.pode_acessar_responsavel(empresa_id, responsavel_id) and deleted_at is null);
create policy "vencimentos_insert"
  on public.vencimentos for insert
  to authenticated
  with check (public.pode_acessar_responsavel(empresa_id, responsavel_id));
create policy "vencimentos_update"
  on public.vencimentos for update
  to authenticated
  using (public.pode_acessar_responsavel(empresa_id, responsavel_id))
  with check (public.pode_acessar_responsavel(empresa_id, responsavel_id));
create policy "vencimentos_delete"
  on public.vencimentos for delete
  to authenticated
  using (public.pode_acessar_responsavel(empresa_id, responsavel_id));

drop policy "negocios_por_responsavel" on public.negocios;
create policy "negocios_select"
  on public.negocios for select
  to authenticated
  using (public.pode_acessar_responsavel(empresa_id, responsavel_id) and deleted_at is null);
create policy "negocios_insert"
  on public.negocios for insert
  to authenticated
  with check (public.pode_acessar_responsavel(empresa_id, responsavel_id));
create policy "negocios_update"
  on public.negocios for update
  to authenticated
  using (public.pode_acessar_responsavel(empresa_id, responsavel_id))
  with check (public.pode_acessar_responsavel(empresa_id, responsavel_id));
create policy "negocios_delete"
  on public.negocios for delete
  to authenticated
  using (public.pode_acessar_responsavel(empresa_id, responsavel_id));

drop policy "tarefas_por_responsavel" on public.tarefas;
create policy "tarefas_select"
  on public.tarefas for select
  to authenticated
  using (public.pode_acessar_responsavel(empresa_id, responsavel_id) and deleted_at is null);
create policy "tarefas_insert"
  on public.tarefas for insert
  to authenticated
  with check (public.pode_acessar_responsavel(empresa_id, responsavel_id));
create policy "tarefas_update"
  on public.tarefas for update
  to authenticated
  using (public.pode_acessar_responsavel(empresa_id, responsavel_id))
  with check (public.pode_acessar_responsavel(empresa_id, responsavel_id));
create policy "tarefas_delete"
  on public.tarefas for delete
  to authenticated
  using (public.pode_acessar_responsavel(empresa_id, responsavel_id));

drop policy "organizacoes_por_responsavel" on public.organizacoes;
create policy "organizacoes_select"
  on public.organizacoes for select
  to authenticated
  using (public.pode_acessar_responsavel(empresa_id, responsavel_id) and deleted_at is null);
create policy "organizacoes_insert"
  on public.organizacoes for insert
  to authenticated
  with check (public.pode_acessar_responsavel(empresa_id, responsavel_id));
create policy "organizacoes_update"
  on public.organizacoes for update
  to authenticated
  using (public.pode_acessar_responsavel(empresa_id, responsavel_id))
  with check (public.pode_acessar_responsavel(empresa_id, responsavel_id));
create policy "organizacoes_delete"
  on public.organizacoes for delete
  to authenticated
  using (public.pode_acessar_responsavel(empresa_id, responsavel_id));

-- DELETE físico não é o caminho de exclusão do produto (é sempre soft
-- delete via `excluir_registro`, abaixo) — mas a policy `_delete` acima
-- sozinha não impede um cliente de chamar `.delete()` direto e apagar a
-- linha de verdade (cascateando pra tabelas filhas), sem passar pela
-- auditoria de `excluir_registro`. Revoke explícito fecha isso — mesmo
-- reforço que `atividades` já tinha (`timeline_automatica.sql`), agora
-- replicado aqui (achado de revisão adversarial pós-implementação: as
-- policies de DELETE existiam mas nada revogava o privilégio bruto).
revoke delete on public.contatos, public.vencimentos, public.negocios, public.tarefas, public.organizacoes from authenticated;

-- ---------------------------------------------------------------------
-- excluir_registro / restaurar_registro — pelo motivo explicado acima,
-- o soft delete em si (não só a restauração) precisa passar por uma
-- função SECURITY DEFINER nestas 5 tabelas. Ambas usam a MESMA regra de
-- autorização que a policy de escrita normal já usava
-- (`pode_acessar_responsavel`) — não é uma restrição nova, só muda o
-- caminho de execução.
-- ---------------------------------------------------------------------
create or replace function public.excluir_registro(p_tabela text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa_id uuid;
  v_responsavel_id uuid;
  v_permitidas text[] := array['contatos', 'vencimentos', 'negocios', 'tarefas', 'organizacoes'];
begin
  if not (p_tabela = any (v_permitidas)) then
    raise exception 'Tabela "%" não suporta exclusão', p_tabela;
  end if;

  execute format('select empresa_id, responsavel_id from public.%I where id = $1', p_tabela)
    into v_empresa_id, v_responsavel_id
    using p_id;

  if v_empresa_id is null then
    raise exception 'Registro não encontrado em "%"', p_tabela;
  end if;

  if not public.pode_acessar_responsavel(v_empresa_id, v_responsavel_id) then
    raise exception 'Sem permissão para excluir este registro';
  end if;

  execute format('update public.%I set deleted_at = now() where id = $1', p_tabela) using p_id;

  insert into public.audit_log (empresa_id, usuario_id, acao, entidade, entidade_id, detalhes)
  values (v_empresa_id, (select auth.uid()), 'excluir_registro', p_tabela, p_id, '{}'::jsonb);
end;
$$;

revoke all on function public.excluir_registro(text, uuid) from public;
grant execute on function public.excluir_registro(text, uuid) to authenticated;

create or replace function public.restaurar_registro(p_tabela text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa_id uuid;
  v_responsavel_id uuid;
  v_permitidas text[] := array['contatos', 'vencimentos', 'negocios', 'tarefas', 'organizacoes'];
begin
  if not (p_tabela = any (v_permitidas)) then
    raise exception 'Tabela "%" não suporta restauração', p_tabela;
  end if;

  execute format('select empresa_id, responsavel_id from public.%I where id = $1', p_tabela)
    into v_empresa_id, v_responsavel_id
    using p_id;

  if v_empresa_id is null then
    raise exception 'Registro não encontrado em "%"', p_tabela;
  end if;

  if not public.pode_acessar_responsavel(v_empresa_id, v_responsavel_id) then
    raise exception 'Sem permissão para restaurar este registro';
  end if;

  execute format('update public.%I set deleted_at = null where id = $1', p_tabela) using p_id;

  insert into public.audit_log (empresa_id, usuario_id, acao, entidade, entidade_id, detalhes)
  values (v_empresa_id, (select auth.uid()), 'restaurar_registro', p_tabela, p_id, '{}'::jsonb);
end;
$$;

revoke all on function public.restaurar_registro(text, uuid) from public;
grant execute on function public.restaurar_registro(text, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Dedup (PRD §6.1): CPF/CNPJ repetido na mesma empresa é bloqueado —
-- é um identificador único de verdade. Telefone e e-mail só avisam (a
-- função abaixo, usada pela importação): duas pessoas da mesma família
-- podem legitimamente compartilhar telefone.
-- ---------------------------------------------------------------------
create unique index uq_contatos_empresa_cpf_cnpj
  on public.contatos (empresa_id, cpf_cnpj)
  where cpf_cnpj is not null and deleted_at is null;

create or replace function public.buscar_possiveis_duplicatas(
  p_empresa_id uuid,
  p_telefone text default null,
  p_email text default null,
  p_cpf_cnpj text default null
)
returns table (id uuid, nome text, telefone text, email text, cpf_cnpj text, motivo text)
language sql
stable
set search_path = ''
as $$
  select c.id, c.nome, c.telefone, c.email, c.cpf_cnpj,
    case
      when p_cpf_cnpj is not null and c.cpf_cnpj = p_cpf_cnpj then 'cpf_cnpj'
      when p_telefone is not null and c.telefone = p_telefone then 'telefone'
      when p_email is not null and lower(c.email) = lower(p_email) then 'email'
    end as motivo
  from public.contatos c
  where c.empresa_id = p_empresa_id
    and c.deleted_at is null
    and public.pode_acessar_responsavel(c.empresa_id, c.responsavel_id)
    and (
      (p_cpf_cnpj is not null and c.cpf_cnpj = p_cpf_cnpj)
      or (p_telefone is not null and c.telefone = p_telefone)
      or (p_email is not null and lower(c.email) = lower(p_email))
    );
$$;

revoke all on function public.buscar_possiveis_duplicatas(uuid, text, text, text) from public;
grant execute on function public.buscar_possiveis_duplicatas(uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- Reindexação das listagens quentes (tela "Hoje" e afins) com o filtro
-- de soft delete embutido no índice, não só na policy.
-- ---------------------------------------------------------------------
drop index public.idx_contatos_empresa_status;
create index idx_contatos_empresa_status
  on public.contatos (empresa_id, status) where deleted_at is null;

drop index public.idx_negocios_empresa_proximo_passo;
create index idx_negocios_empresa_proximo_passo
  on public.negocios (empresa_id, proximo_passo_em) where deleted_at is null;

drop index public.idx_vencimentos_empresa_data;
create index idx_vencimentos_empresa_data
  on public.vencimentos (empresa_id, data_vencimento) where deleted_at is null;

drop index public.idx_tarefas_empresa_data;
create index idx_tarefas_empresa_data
  on public.tarefas (empresa_id, data_vencimento) where deleted_at is null;
