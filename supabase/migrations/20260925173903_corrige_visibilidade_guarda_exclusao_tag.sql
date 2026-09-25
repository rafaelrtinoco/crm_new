-- Corrige um gap real achado no security-check da fatia 2 (Núcleo):
-- `impedir_exclusao_tag_em_uso()` (20260925172529_configuracoes_nucleo.sql)
-- não é `security definer`, então a `SELECT COUNT(*)` dentro dela roda com
-- as privilégios de quem disparou o UPDATE — sujeita à RLS de
-- `contatos`/`contato_tags` de quem chama.
--
-- Para as outras 4 tabelas (funis/etapas/motivos_perda/vencimento_tipos)
-- isso não importa: só gestor+ pode escrever nelas (`*_gestor_escreve`),
-- e `pode_acessar_responsavel` sempre retorna true pra gestor+,
-- independente de `carteira_compartilhada` — a contagem sempre vê tudo.
--
-- `tags` é diferente: `tags_membro` permite qualquer membro excluir,
-- inclusive um "usuario" comum. Pra esse papel, `pode_acessar_responsavel`
-- só retorna true se for o próprio responsável do contato ou se
-- `carteira_compartilhada` estiver ativa — sem isso, um "usuario" só
-- enxerga (e portanto só conta) os PRÓPRIOS contatos. Resultado: um
-- usuário comum podia excluir uma tag que ainda está em uso em contatos
-- de outro colega, porque a contagem de uso via RLS subestimava o total
-- (via, não vazamento entre empresas — a tag e os contatos continuam
-- todos na mesma empresa do usuário).
--
-- Corrigido tornando a função `security definer`, mesmo raciocínio de
-- `carteira_compartilhada()`/`pode_acessar_responsavel()`: precisa
-- enxergar o fato verdadeiro (a tag está em uso em QUALQUER contato da
-- empresa), não o que a RLS deixaria o chamador ver.

create or replace function public.impedir_exclusao_tag_em_uso()
returns trigger
language plpgsql
security definer
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
