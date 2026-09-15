-- Redesenho do núcleo (parte 4/6): a timeline deixa de depender do
-- frontend lembrar de escrevê-la. Hoje `useMoverNegocio` faz duas
-- chamadas HTTP separadas (update do negócio, depois insert da
-- atividade) — se a segunda falhar, o card já mudou de etapa e a
-- timeline fica muda, sem rollback. Daqui pra frente o banco registra
-- sozinho; o RPC novo da próxima migration substitui as duas chamadas
-- do cliente por uma só.
--
-- Nenhuma função aqui precisa de SECURITY DEFINER: quem já tem permissão
-- de UPDATE em `negocios`/`tarefas` (passou pela RLS de lá) também tem
-- permissão de INSERT em `atividades` contanto que o trigger grave
-- `responsavel_id = auth.uid()` — é exatamente o que a policy
-- `atividades_insert` já aceita pra qualquer papel.

-- ---------------------------------------------------------------------
-- derivar_contexto_atividade — antes de gravar uma atividade, completa
-- `empresa_id`/`contato_id`/`negocio_id` a partir do negócio, vencimento
-- ou tarefa vinculados (quando vierem vazios) e VALIDA coerência quando
-- vierem preenchidos. É o que impede uma atividade apontar pra um
-- negócio de um contato e um `contato_id` de outro.
-- ---------------------------------------------------------------------
create or replace function public.derivar_contexto_atividade()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_negocio public.negocios%rowtype;
  v_vencimento public.vencimentos%rowtype;
  v_tarefa public.tarefas%rowtype;
begin
  if new.negocio_id is not null then
    select * into v_negocio from public.negocios where id = new.negocio_id;
    if not found then
      raise exception 'Negócio não encontrado para a atividade';
    end if;
    if new.empresa_id is null then
      new.empresa_id = v_negocio.empresa_id;
    elsif new.empresa_id <> v_negocio.empresa_id then
      raise exception 'Atividade e negócio pertencem a empresas diferentes';
    end if;
    if new.contato_id is null then
      new.contato_id = v_negocio.contato_id;
    elsif new.contato_id <> v_negocio.contato_id then
      raise exception 'Atividade aponta para um contato diferente do contato do negócio';
    end if;
  end if;

  if new.vencimento_id is not null then
    select * into v_vencimento from public.vencimentos where id = new.vencimento_id;
    if not found then
      raise exception 'Vencimento não encontrado para a atividade';
    end if;
    if new.empresa_id is null then
      new.empresa_id = v_vencimento.empresa_id;
    elsif new.empresa_id <> v_vencimento.empresa_id then
      raise exception 'Atividade e vencimento pertencem a empresas diferentes';
    end if;
    if new.contato_id is null then
      new.contato_id = v_vencimento.contato_id;
    elsif new.contato_id <> v_vencimento.contato_id then
      raise exception 'Atividade aponta para um contato diferente do contato do vencimento';
    end if;
  end if;

  if new.tarefa_id is not null then
    select * into v_tarefa from public.tarefas where id = new.tarefa_id;
    if not found then
      raise exception 'Tarefa não encontrada para a atividade';
    end if;
    if new.empresa_id is null then
      new.empresa_id = v_tarefa.empresa_id;
    elsif new.empresa_id <> v_tarefa.empresa_id then
      raise exception 'Atividade e tarefa pertencem a empresas diferentes';
    end if;
    if new.contato_id is null then
      new.contato_id = v_tarefa.contato_id;
    elsif v_tarefa.contato_id is not null and new.contato_id <> v_tarefa.contato_id then
      raise exception 'Atividade aponta para um contato diferente do contato da tarefa';
    end if;
    if new.negocio_id is null then
      new.negocio_id = v_tarefa.negocio_id;
    elsif v_tarefa.negocio_id is not null and new.negocio_id <> v_tarefa.negocio_id then
      raise exception 'Atividade aponta para um negócio diferente do negócio da tarefa';
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_atividades_derivar_contexto
  before insert on public.atividades
  for each row execute function public.derivar_contexto_atividade();

-- Paridade com `audit_log`: a RLS já nega update/delete (não existe
-- policy pra isso), o revoke explícito é só reforço documentado.
revoke update, delete on public.atividades from authenticated;

-- ---------------------------------------------------------------------
-- derivar_contexto_tarefa — mesma ideia de G2, pra tarefas: se veio
-- `negocio_id`, o `contato_id` da tarefa precisa ser o mesmo do
-- negócio. Antes, cada hook do frontend precisava lembrar de mandar os
-- dois campos sincronizados manualmente.
-- ---------------------------------------------------------------------
create or replace function public.derivar_contexto_tarefa()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_negocio public.negocios%rowtype;
begin
  if new.negocio_id is not null then
    select * into v_negocio from public.negocios where id = new.negocio_id;
    if not found then
      raise exception 'Negócio não encontrado para a tarefa';
    end if;
    if new.contato_id is null then
      new.contato_id = v_negocio.contato_id;
    elsif new.contato_id <> v_negocio.contato_id then
      raise exception 'Tarefa aponta para um contato diferente do contato do negócio';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_tarefas_derivar_contexto
  before insert or update of negocio_id, contato_id on public.tarefas
  for each row execute function public.derivar_contexto_tarefa();

-- ---------------------------------------------------------------------
-- sincronizar_status_por_etapa — fecha o gap "arrastar o card pra
-- coluna Ganho não marca o negócio como ganho" (PRD §6.5). Quando a
-- etapa muda para uma marcada como `ganho`, o status acompanha. Quando
-- muda para `perdido`, exige que o motivo já esteja preenchido — quem
-- arrasta direto pro "Perdido" sem passar pelo diálogo de motivo recebe
-- um erro claro em vez de uma constraint genérica.
--
-- Ordem de execução: roda como trigger BEFORE UPDATE separado de
-- `trg_negocios_entrou_na_etapa` (que só mexe em `entrou_na_etapa_em`);
-- como nenhum dos dois lê o que o outro escreve, a ordem alfabética de
-- disparo entre eles não importa.
-- ---------------------------------------------------------------------
create or replace function public.sincronizar_status_por_etapa()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_tipo_etapa text;
begin
  if new.etapa_id is distinct from old.etapa_id then
    select tipo into v_tipo_etapa from public.etapas where id = new.etapa_id;

    if v_tipo_etapa = 'ganho' then
      new.status = 'ganho';
    elsif v_tipo_etapa = 'perdido' then
      if new.motivo_perda_id is null then
        raise exception 'Etapa de perda exige um motivo — use "Marcar como perdido" em vez de arrastar o card.';
      end if;
      new.status = 'perdido';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_negocios_sincronizar_status_etapa
  before update on public.negocios
  for each row execute function public.sincronizar_status_por_etapa();

-- ---------------------------------------------------------------------
-- registrar_atividade_negocio — a timeline de mudança de etapa, ganho e
-- perda deixa de ser responsabilidade do cliente.
-- ---------------------------------------------------------------------
create or replace function public.registrar_atividade_negocio()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_etapa_nome text;
begin
  if new.etapa_id is distinct from old.etapa_id then
    select nome into v_etapa_nome from public.etapas where id = new.etapa_id;
    insert into public.atividades (empresa_id, contato_id, negocio_id, tipo, responsavel_id, created_by, conteudo)
    values (
      new.empresa_id, new.contato_id, new.id, 'mudanca_etapa',
      (select auth.uid()), (select auth.uid()),
      jsonb_build_object('evento', 'etapa', 'etapa', v_etapa_nome)
    );
  end if;

  if new.status = 'ganho' and old.status <> 'ganho' then
    update public.contatos set status = 'cliente' where id = new.contato_id;
    insert into public.atividades (empresa_id, contato_id, negocio_id, tipo, responsavel_id, created_by, conteudo)
    values (
      new.empresa_id, new.contato_id, new.id, 'mudanca_etapa',
      (select auth.uid()), (select auth.uid()),
      jsonb_build_object('evento', 'ganho')
    );
  end if;

  if new.status = 'perdido' and old.status <> 'perdido' then
    insert into public.atividades (empresa_id, contato_id, negocio_id, tipo, responsavel_id, created_by, conteudo)
    values (
      new.empresa_id, new.contato_id, new.id, 'mudanca_etapa',
      (select auth.uid()), (select auth.uid()),
      jsonb_build_object('evento', 'perdido')
    );
  end if;

  return new;
end;
$$;

create trigger trg_negocios_registrar_atividade
  after update on public.negocios
  for each row execute function public.registrar_atividade_negocio();

-- ---------------------------------------------------------------------
-- registrar_atividade_tarefa_concluida
-- ---------------------------------------------------------------------
create or replace function public.registrar_atividade_tarefa_concluida()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.concluida_em is not null and old.concluida_em is null then
    insert into public.atividades (empresa_id, contato_id, negocio_id, tarefa_id, tipo, responsavel_id, created_by, conteudo)
    values (
      new.empresa_id, new.contato_id, new.negocio_id, new.id, 'tarefa',
      (select auth.uid()), (select auth.uid()),
      jsonb_build_object('titulo', new.titulo, 'evento', 'concluida')
    );
  end if;
  return new;
end;
$$;

create trigger trg_tarefas_registrar_atividade
  after update on public.tarefas
  for each row execute function public.registrar_atividade_tarefa_concluida();

-- ---------------------------------------------------------------------
-- registrar_atividade_vencimento_renovado — dispara quando um vencimento
-- é inserido já apontando pra um anterior (é assim que `renovar_vencimento`,
-- atualizado na migration 6, marca "este é fruto de uma renovação").
-- ---------------------------------------------------------------------
create or replace function public.registrar_atividade_vencimento_renovado()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.vencimento_anterior_id is not null then
    insert into public.atividades (empresa_id, contato_id, vencimento_id, tipo, responsavel_id, created_by, conteudo)
    values (
      new.empresa_id, new.contato_id, new.id, 'vencimento',
      (select auth.uid()), (select auth.uid()),
      jsonb_build_object('evento', 'renovado', 'data_vencimento', new.data_vencimento)
    );
  end if;
  return new;
end;
$$;

create trigger trg_vencimentos_registrar_atividade
  after insert on public.vencimentos
  for each row execute function public.registrar_atividade_vencimento_renovado();
