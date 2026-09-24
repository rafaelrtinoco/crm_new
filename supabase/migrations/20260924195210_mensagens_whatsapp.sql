-- Simulação de chat WhatsApp (mock) — docs/whatsapp-mock/SPEC-chat-whatsapp-mock.md,
-- decisão de arquitetura em docs/decisoes/0006-chat-whatsapp-mock-reaproveita-atividades.md.
-- Fase 2 (conexão real com a Meta) continua adiada — ADR 0004. Sem tabela
-- nova: `atividades` já reserva `tipo='mensagem'` desde a Fase 1 e já tem
-- RLS completa; só faltava algo gravando nela.
--
-- Mensagem "saída" (campanha WhatsApp mock enviou): gravada por este
-- trigger, nunca pelo cliente — mesma regra de ouro da timeline
-- automática (mudança de etapa, tarefa concluída, vencimento renovado).
-- Mensagem "entrada" (resposta simulada pelo usuário): insert direto do
-- cliente, mesmo caminho já usado por nota/ligação (useRegistrarAtividade)
-- — RLS de atividades_insert já cobre, sem mudança nenhuma aqui.

-- ---------------------------------------------------------------------
-- registrar_mensagem_whatsapp_enviada — security definer: o mesmo motivo
-- de processar_fila_envios/disparar_campanhas_agendadas (ADR 0005,
-- correção 1 de campanhas.sql) — este trigger pode disparar via pg_cron,
-- sem sessão de usuário (auth.uid() seria null, a RLS normal de
-- atividades_insert bloquearia). responsavel_id vem do responsável do
-- CONTATO, não de auth.uid(), por isso mesmo motivo: não existe um
-- "usuário logado" confiável no contexto do cron.
-- ---------------------------------------------------------------------
create or replace function public.registrar_mensagem_whatsapp_enviada()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contato public.contatos%rowtype;
  v_campanha_id uuid;
begin
  select * into v_contato from public.contatos where id = new.contato_id;
  if not found then
    -- Contato sumiu entre o enfileiramento e o envio (não devia
    -- acontecer, FK é on delete cascade) — não derruba o envio por causa
    -- da timeline.
    return new;
  end if;

  v_campanha_id := case when new.origem_tipo = 'campanha' then new.origem_id else null end;

  insert into public.atividades (empresa_id, contato_id, tipo, responsavel_id, created_by, conteudo)
  values (
    new.empresa_id,
    new.contato_id,
    'mensagem',
    v_contato.responsavel_id,
    v_contato.responsavel_id,
    jsonb_build_object(
      'texto', new.conteudo,
      'direcao', 'saida',
      'canal', 'whatsapp',
      'campanha_id', v_campanha_id
    )
  );

  return new;
end;
$$;

create trigger trg_fila_envios_mensagem_whatsapp
  after update of status on public.fila_envios
  for each row
  when (new.canal = 'whatsapp' and new.status = 'enviada' and old.status is distinct from 'enviada')
  execute function public.registrar_mensagem_whatsapp_enviada();
