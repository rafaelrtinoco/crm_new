-- Redesenho do núcleo (parte 6/6): RPCs atualizadas e a view que falta
-- pra parar de resolver "responsável" em duas consultas.

-- ---------------------------------------------------------------------
-- mover_negocio_etapa — substitui as duas chamadas HTTP separadas de
-- `useMoverNegocio` (update do negócio + insert manual da atividade) por
-- uma transação só. A timeline agora é automática (ver
-- `trg_negocios_registrar_atividade`, migration anterior), então esta
-- função só precisa da escrita que já era obrigatória.
-- ---------------------------------------------------------------------
create or replace function public.mover_negocio_etapa(
  p_negocio_id uuid,
  p_etapa_id uuid,
  p_proximo_passo_em date,
  p_proximo_passo_acao text
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  update public.negocios
  set etapa_id = p_etapa_id,
      proximo_passo_em = p_proximo_passo_em,
      proximo_passo_acao = p_proximo_passo_acao
  where id = p_negocio_id;

  if not found then
    raise exception 'Negócio não encontrado';
  end if;
end;
$$;

revoke all on function public.mover_negocio_etapa(uuid, uuid, date, text) from public;
grant execute on function public.mover_negocio_etapa(uuid, uuid, date, text) to authenticated;

-- ---------------------------------------------------------------------
-- marcar_negocio_ganho — a promoção do contato a cliente e o registro
-- na timeline saíram daqui: agora acontecem via
-- `trg_negocios_registrar_atividade` sempre que `status` vira 'ganho',
-- não importa se foi por este RPC ou por arrastar o card pra uma etapa
-- `tipo = 'ganho'`. O que sobra aqui é mover o card pra essa etapa
-- especial do funil, se existir uma (best-effort — nem todo funil tem).
-- ---------------------------------------------------------------------
create or replace function public.marcar_negocio_ganho(p_negocio_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_negocio public.negocios%rowtype;
  v_etapa_ganho_id uuid;
begin
  select * into v_negocio from public.negocios where id = p_negocio_id;
  if not found then
    raise exception 'Negócio não encontrado';
  end if;

  select id into v_etapa_ganho_id
  from public.etapas
  where funil_id = v_negocio.funil_id and tipo = 'ganho' and deleted_at is null
  limit 1;

  update public.negocios
  set status = 'ganho',
      etapa_id = coalesce(v_etapa_ganho_id, etapa_id)
  where id = p_negocio_id;
end;
$$;

-- ---------------------------------------------------------------------
-- marcar_negocio_perdido — mesma ideia: move pra etapa `tipo = 'perdido'`
-- do funil quando existir uma. O registro na timeline também passou a
-- ser automático.
-- ---------------------------------------------------------------------
create or replace function public.marcar_negocio_perdido(
  p_negocio_id uuid,
  p_motivo_perda_id uuid,
  p_reativar_em date default null
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_negocio public.negocios%rowtype;
  v_etapa_perdido_id uuid;
begin
  select * into v_negocio from public.negocios where id = p_negocio_id;
  if not found then
    raise exception 'Negócio não encontrado';
  end if;

  select id into v_etapa_perdido_id
  from public.etapas
  where funil_id = v_negocio.funil_id and tipo = 'perdido' and deleted_at is null
  limit 1;

  update public.negocios
  set status = 'perdido',
      motivo_perda_id = p_motivo_perda_id,
      reativar_em = p_reativar_em,
      etapa_id = coalesce(v_etapa_perdido_id, etapa_id)
  where id = p_negocio_id;

  if p_reativar_em is not null then
    insert into public.tarefas (
      empresa_id, contato_id, negocio_id, tipo, titulo, data_vencimento, responsavel_id, created_by
    )
    values (
      v_negocio.empresa_id,
      v_negocio.contato_id,
      v_negocio.id,
      'outro',
      'Reativar: ' || v_negocio.proximo_passo_acao,
      p_reativar_em,
      v_negocio.responsavel_id,
      (select auth.uid())
    );
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- renovar_vencimento — agora encadeia o vencimento novo ao anterior
-- (`vencimento_anterior_id`), fechando o gap do PRD §6.12 (taxa de
-- renovação por tipo precisa conseguir seguir a cadeia histórica).
-- ---------------------------------------------------------------------
create or replace function public.renovar_vencimento(
  p_vencimento_id uuid,
  p_nova_data date,
  p_novo_valor numeric default null,
  p_novos_campos jsonb default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_atual public.vencimentos%rowtype;
  v_novo_id uuid;
begin
  select * into v_atual from public.vencimentos where id = p_vencimento_id;
  if not found then
    raise exception 'Vencimento não encontrado';
  end if;

  update public.vencimentos set status = 'renovado' where id = p_vencimento_id;

  insert into public.vencimentos (
    empresa_id, contato_id, vencimento_tipo_id, descricao,
    data_vencimento, valor, recorrencia, status, responsavel_id, campos,
    vencimento_anterior_id
  )
  values (
    v_atual.empresa_id,
    v_atual.contato_id,
    v_atual.vencimento_tipo_id,
    v_atual.descricao,
    p_nova_data,
    coalesce(p_novo_valor, v_atual.valor),
    v_atual.recorrencia,
    'pendente',
    v_atual.responsavel_id,
    coalesce(p_novos_campos, v_atual.campos),
    v_atual.id
  )
  returning id into v_novo_id;

  return v_novo_id;
end;
$$;

-- ---------------------------------------------------------------------
-- membros_empresa — fonte única pra "quem são os membros desta empresa,
-- com nome", em vez de cada tela juntar `empresa_membros` + `perfis` na
-- mão (não há FK direta entre as duas — só via `auth.users` — então o
-- PostgREST não embeda sozinho). `security_invoker = true`: a view não
-- amplia acesso nenhum, só reflete a RLS de `empresa_membros`/`perfis`
-- de quem consulta. Só membros ativos (`deleted_at is null`) — é usada
-- em seletores de responsável, não faz sentido oferecer quem já saiu.
-- ---------------------------------------------------------------------
create view public.membros_empresa
  with (security_invoker = true) as
select
  em.empresa_id,
  em.usuario_id,
  em.papel,
  p.nome,
  p.telefone
from public.empresa_membros em
join public.perfis p on p.id = em.usuario_id
where em.deleted_at is null;
