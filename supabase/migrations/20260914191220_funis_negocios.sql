-- 1D-2: funis de venda (kanban).
--
-- entrou_na_etapa_em existe desde o 1A (default now()) mas nada a
-- atualizava — PRD §6.5 pede "tempo parado na etapa visível no card".
create or replace function public.atualizar_entrou_na_etapa()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.etapa_id is distinct from old.etapa_id then
    new.entrou_na_etapa_em = now();
  end if;
  return new;
end;
$$;

create trigger trg_negocios_entrou_na_etapa
  before update on public.negocios
  for each row execute function public.atualizar_entrou_na_etapa();

-- PRD §6.5: "Ganho: marca o contato como cliente e oferece cadastrar o
-- vencimento correspondente." O "oferece" é do frontend; aqui só as
-- duas escritas que precisam de tudo-ou-nada (fechar o negócio, promover
-- o contato).
--
-- SECURITY INVOKER — não bypassa RLS: quem chama já precisa ter acesso
-- de escrita ao negócio via pode_acessar_responsavel, e o update do
-- contato passa pela policy normal de contatos (mesma empresa).
create or replace function public.marcar_negocio_ganho(p_negocio_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_contato_id uuid;
begin
  select contato_id into v_contato_id from public.negocios where id = p_negocio_id;
  if not found then
    raise exception 'Negócio não encontrado';
  end if;

  update public.negocios set status = 'ganho' where id = p_negocio_id;
  update public.contatos set status = 'cliente' where id = v_contato_id;
end;
$$;

revoke all on function public.marcar_negocio_ganho(uuid) from public;
grant execute on function public.marcar_negocio_ganho(uuid) to authenticated;

-- PRD §6.5: "Perdido: motivo obrigatório e campo 'reativar em', que cria
-- uma tarefa futura." O motivo obrigatório já é garantido pelo check
-- negocios_perdido_tem_motivo (23514 se vier nulo); aqui só a segunda
-- escrita condicional (a tarefa), na mesma transação.
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
begin
  select * into v_negocio from public.negocios where id = p_negocio_id;
  if not found then
    raise exception 'Negócio não encontrado';
  end if;

  update public.negocios
  set status = 'perdido', motivo_perda_id = p_motivo_perda_id, reativar_em = p_reativar_em
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

revoke all on function public.marcar_negocio_perdido(uuid, uuid, date) from public;
grant execute on function public.marcar_negocio_perdido(uuid, uuid, date) to authenticated;
