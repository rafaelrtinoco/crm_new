-- PRD §6.3: "ultimo_contato_em atualizado automaticamente a cada
-- interação". Dispara em toda atividade vinculada a um contato — não
-- precisa SECURITY DEFINER: quem insere a atividade já passou pela RLS
-- de `atividades`, que por sua vez já valida acesso ao contato.

create or replace function public.atualizar_ultimo_contato()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.contato_id is not null then
    update public.contatos set ultimo_contato_em = new.created_at where id = new.contato_id;
  end if;
  return new;
end;
$$;

create trigger trg_atividades_ultimo_contato
  after insert on public.atividades
  for each row execute function public.atualizar_ultimo_contato();
