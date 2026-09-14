-- PRD §6.4: "Ao marcar renovado, criar automaticamente o próximo
-- vencimento conforme a recorrência, perguntando se os dados mudaram."
-- O "perguntando" é responsabilidade do frontend (diálogo de
-- confirmação); esta função só garante que as duas escritas (fechar o
-- atual, abrir o próximo) acontecem juntas, na mesma transação.
--
-- SECURITY INVOKER (padrão) — não precisa bypassar RLS: quem chama já
-- tem acesso de escrita ao vencimento atual via pode_acessar_responsavel,
-- e o insert do próximo é pra a mesma empresa/contato, então passa pela
-- mesma policy.
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
    data_vencimento, valor, recorrencia, status, responsavel_id, campos
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
    coalesce(p_novos_campos, v_atual.campos)
  )
  returning id into v_novo_id;

  return v_novo_id;
end;
$$;

revoke all on function public.renovar_vencimento(uuid, date, numeric, jsonb) from public;
grant execute on function public.renovar_vencimento(uuid, date, numeric, jsonb) to authenticated;
