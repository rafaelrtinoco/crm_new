-- Corrige dois bugs reais em gerar_notificacoes_diarias() (20260915142929_notificacoes.sql):
--
-- 1. A checagem de idempotência comparava `created_at::date = v_hoje`, mas
--    `created_at::date` converte pro fuso da SESSÃO (não o fuso da empresa,
--    `v_empresa.fuso`, que é como `v_hoje` foi calculado). Corrigido comparando
--    `(created_at at time zone v_empresa.fuso)::date`, o mesmo fuso de `v_hoje`.
--
-- 2. Mais grave: `notificacoes.created_at` usa `default now()` (relógio real
--    da transação), enquanto todo o resto da função deriva de `p_agora`
--    (parâmetro pensado pra viabilizar teste determinístico — pgTAP não
--    tem como "congelar" `now()`, ver comentário original da função). Em
--    produção os dois coincidem (o cron sempre chama com `p_agora = now()`
--    implícito), mas qualquer chamada com `p_agora` distante do relógio
--    real — exatamente o caso de uso que o parâmetro existe pra permitir —
--    quebra a idempotência: a segunda chamada não encontra o registro já
--    criado (criado com `created_at` do relógio real, não de `p_agora`) e
--    duplica a notificação. Corrigido gravando `created_at = p_agora`
--    explicitamente nos dois inserts, em vez de depender do default da
--    coluna — sem mudar nada em produção (onde `p_agora` já é `now()`).
--
-- Achado ao investigar `supabase/tests/notificacoes.sql` falhando com
-- `p_agora` fixo bem distante da data real de execução do teste.

create or replace function public.gerar_notificacoes_diarias(p_agora timestamptz default now())
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa record;
  v_hoje date;
  v_membro record;
  v_atrasadas bigint;
begin
  for v_empresa in
    select id, fuso from public.empresas where deleted_at is null
  loop
    if extract(hour from (p_agora at time zone v_empresa.fuso)) <> 8 then
      continue;
    end if;

    v_hoje := (p_agora at time zone v_empresa.fuso)::date;

    for v_membro in
      select usuario_id from public.empresa_membros where empresa_id = v_empresa.id
    loop
      if not exists (
        select 1 from public.notificacoes
        where empresa_id = v_empresa.id
          and destinatario_id = v_membro.usuario_id
          and tipo = 'resumo_diario'
          and (created_at at time zone v_empresa.fuso)::date = v_hoje
      ) then
        insert into public.notificacoes (empresa_id, destinatario_id, tipo, titulo, corpo, url, created_at)
        values (
          v_empresa.id,
          v_membro.usuario_id,
          'resumo_diario',
          'Resumo do dia',
          'Confira as ações de hoje na tela "Hoje".',
          '/',
          p_agora
        );
      end if;

      select count(*) into v_atrasadas
      from public.tarefas
      where empresa_id = v_empresa.id
        and responsavel_id = v_membro.usuario_id
        and concluida_em is null
        and deleted_at is null
        and data_vencimento < v_hoje;

      if v_atrasadas > 0 and not exists (
        select 1 from public.notificacoes
        where empresa_id = v_empresa.id
          and destinatario_id = v_membro.usuario_id
          and tipo = 'follow_up_vencido'
          and (created_at at time zone v_empresa.fuso)::date = v_hoje
      ) then
        insert into public.notificacoes (empresa_id, destinatario_id, tipo, titulo, corpo, url, created_at)
        values (
          v_empresa.id,
          v_membro.usuario_id,
          'follow_up_vencido',
          v_atrasadas || ' tarefa(s) atrasada(s)',
          'Você tem follow-ups atrasados. Confira a lista de tarefas.',
          '/tarefas',
          p_agora
        );
      end if;
    end loop;
  end loop;
end;
$$;
