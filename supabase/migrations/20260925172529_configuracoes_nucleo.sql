-- Configurações da empresa — fatia 2 (Núcleo). PRD §6.15, continuação da
-- fatia 1. Ver docs/configuracoes/SPEC-configuracoes-nucleo.md.
--
-- Sem tabela nova — funis/etapas/vencimento_tipos/campos_personalizados/
-- tags/motivos_perda já existem desde 20260910200256_nucleo.sql, com RLS
-- de escrita completa (*_gestor_escreve FOR ALL / tags_membro), nunca
-- exposta por nenhuma tela. Dois ajustes de banco, achados só ao
-- explorar antes de codar a UI que finalmente vai exercitar exclusão
-- nessas tabelas pela primeira vez:
--
-- 1. unique(..., nome) são constraints simples, não índices parciais —
--    excluir e recriar com o mesmo nome falharia pra sempre (a linha
--    excluída continua reservando o nome). Convertido pro mesmo padrão
--    que a ADR 0003 já usa pro CPF/CNPJ de `contatos`.
-- 2. Excluir um item em uso (funil/etapa/motivo com negócio ativo, tipo
--    de vencimento com vencimento ativo, tag com contato ativo) deixaria
--    negócios/vencimentos/contatos existentes com uma referência que
--    some dos seletores filtrados por deleted_at — bloqueado por trigger,
--    não só no cliente (quem escreve direto via RLS FOR ALL não escapa).

-- ---------------------------------------------------------------------
-- 1. Índices únicos parciais (substituem as 6 constraints simples).
-- ---------------------------------------------------------------------
alter table public.funis drop constraint funis_empresa_id_nome_key;
create unique index funis_empresa_id_nome_key
  on public.funis (empresa_id, nome) where deleted_at is null;

alter table public.etapas drop constraint etapas_funil_id_nome_key;
create unique index etapas_funil_id_nome_key
  on public.etapas (funil_id, nome) where deleted_at is null;

alter table public.vencimento_tipos drop constraint vencimento_tipos_empresa_id_nome_key;
create unique index vencimento_tipos_empresa_id_nome_key
  on public.vencimento_tipos (empresa_id, nome) where deleted_at is null;

alter table public.motivos_perda drop constraint motivos_perda_empresa_id_nome_key;
create unique index motivos_perda_empresa_id_nome_key
  on public.motivos_perda (empresa_id, nome) where deleted_at is null;

alter table public.tags drop constraint tags_empresa_id_nome_key;
create unique index tags_empresa_id_nome_key
  on public.tags (empresa_id, nome) where deleted_at is null;

alter table public.campos_personalizados drop constraint campos_personalizados_empresa_id_entidade_chave_key;
create unique index campos_personalizados_empresa_id_entidade_chave_key
  on public.campos_personalizados (empresa_id, entidade, chave) where deleted_at is null;

-- ---------------------------------------------------------------------
-- 2. Triggers de bloqueio de exclusão em uso. Um por tabela referenciada
-- por FK; campos_personalizados fica de fora de propósito (o valor mora
-- dentro de contatos.campos/vencimentos.campos, jsonb sem FK — checar
-- exigiria varrer a tabela inteira sem índice, custo/benefício não fecha
-- nesta rodada, ver spec).
-- ---------------------------------------------------------------------
create or replace function public.impedir_exclusao_funil_em_uso()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_total bigint;
begin
  select count(*) into v_total
  from public.negocios
  where funil_id = OLD.id and deleted_at is null;

  if v_total > 0 then
    raise exception 'Não é possível excluir: ainda em uso por % negócio(s)', v_total;
  end if;

  return NEW;
end;
$$;

create trigger trg_funis_impedir_exclusao_em_uso
  before update on public.funis
  for each row
  when (NEW.deleted_at is not null and OLD.deleted_at is null)
  execute function public.impedir_exclusao_funil_em_uso();

create or replace function public.impedir_exclusao_etapa_em_uso()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_total bigint;
begin
  select count(*) into v_total
  from public.negocios
  where etapa_id = OLD.id and deleted_at is null;

  if v_total > 0 then
    raise exception 'Não é possível excluir: ainda em uso por % negócio(s)', v_total;
  end if;

  return NEW;
end;
$$;

create trigger trg_etapas_impedir_exclusao_em_uso
  before update on public.etapas
  for each row
  when (NEW.deleted_at is not null and OLD.deleted_at is null)
  execute function public.impedir_exclusao_etapa_em_uso();

create or replace function public.impedir_exclusao_motivo_perda_em_uso()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_total bigint;
begin
  select count(*) into v_total
  from public.negocios
  where motivo_perda_id = OLD.id and deleted_at is null;

  if v_total > 0 then
    raise exception 'Não é possível excluir: ainda em uso por % negócio(s)', v_total;
  end if;

  return NEW;
end;
$$;

create trigger trg_motivos_perda_impedir_exclusao_em_uso
  before update on public.motivos_perda
  for each row
  when (NEW.deleted_at is not null and OLD.deleted_at is null)
  execute function public.impedir_exclusao_motivo_perda_em_uso();

create or replace function public.impedir_exclusao_vencimento_tipo_em_uso()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_total bigint;
begin
  select count(*) into v_total
  from public.vencimentos
  where vencimento_tipo_id = OLD.id and deleted_at is null;

  if v_total > 0 then
    raise exception 'Não é possível excluir: ainda em uso por % vencimento(s)', v_total;
  end if;

  return NEW;
end;
$$;

create trigger trg_vencimento_tipos_impedir_exclusao_em_uso
  before update on public.vencimento_tipos
  for each row
  when (NEW.deleted_at is not null and OLD.deleted_at is null)
  execute function public.impedir_exclusao_vencimento_tipo_em_uso();

create or replace function public.impedir_exclusao_tag_em_uso()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_total bigint;
begin
  select count(*) into v_total
  from public.contato_tags ct
  join public.contatos c on c.id = ct.contato_id
  where ct.tag_id = OLD.id and c.deleted_at is null;

  if v_total > 0 then
    raise exception 'Não é possível excluir: ainda em uso por % contato(s)', v_total;
  end if;

  return NEW;
end;
$$;

create trigger trg_tags_impedir_exclusao_em_uso
  before update on public.tags
  for each row
  when (NEW.deleted_at is not null and OLD.deleted_at is null)
  execute function public.impedir_exclusao_tag_em_uso();
