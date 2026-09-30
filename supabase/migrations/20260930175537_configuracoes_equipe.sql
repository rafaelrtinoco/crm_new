-- Configurações da empresa — fatia 3 (Equipe). PRD §6.15/§5.2. Fecha o
-- módulo Configurações. Ver docs/configuracoes/SPEC-configuracoes-equipe.md.
--
-- As fatias 1/2 ficaram de fora desta até agora porque
-- `empresa_membros_gestor_escreve` é `FOR ALL` pra qualquer gestor, sem
-- diferenciar o papel do alvo — sem guarda, uma tela de "trocar papel"/
-- "remover membro" deixaria um gestor promover a si mesmo a dono, ou
-- demover/remover o dono atual. É essa guarda que esta migration fecha.
--
-- Diferente da fatia 2: NÃO dá pra converter `unique(empresa_id,
-- usuario_id)` num índice parcial — `contatos.responsavel_id` e outras 5
-- colunas referenciam `empresa_membros (empresa_id, usuario_id)` via FK
-- composta, e Postgres exige que o alvo de uma FK seja um unique
-- constraint/índice NÃO-parcial. Remover membro continua soft delete
-- puro; reconvidar quem foi removido precisa REATIVAR a mesma linha
-- (ver correção em aceitar_convite, abaixo), nunca inserir outra.
--
-- Desenho em duas camadas, achado revisando o primeiro rascunho: a
-- decisão "quem pode virar dono" tem que ser tomada na CRIAÇÃO do
-- convite (é ali que existe um ator de verdade — o gestor/dono que está
-- convidando), não na ACEITAÇÃO (`aceitar_convite` roda como o próprio
-- convidado, que por definição ainda não é dono — ele não estaria
-- "promovendo a si mesmo", só reivindicando o que já foi autorizado).
-- Por isso: guarda em `convites` na criação (camada 1) + guarda em
-- `empresa_membros` pro caminho de escrita direta, que não passa pelo
-- convite nenhum (camada 2) + uma flag de transação pra `aceitar_convite`
-- não se autobloquear na camada 2 quando a camada 1 já autorizou.

-- ---------------------------------------------------------------------
-- Camada 1: só dono cria (ou edita pra) convite de outro dono.
-- `before insert OR UPDATE` — achado no security-check: um `before
-- insert` sozinho deixava um gestor criar um convite papel='usuario'
-- (permitido) e depois fazer `UPDATE convites SET papel = 'dono'` na
-- mesma linha, sem nenhum trigger barrando — quando aceito, a flag de
-- transação do `aceitar_convite` deixaria passar (achava que a camada 1
-- já tinha autorizado).
--
-- Só dispara numa TRANSIÇÃO de verdade pra 'dono' (insert, ou update
-- onde `OLD.papel` não era 'dono') — mesmo cuidado do trigger de
-- `empresa_membros` acima. Sem isso, `useCancelarConvite` (só muda
-- `status`, nunca `papel`) ficaria bloqueado por qualquer gestor
-- cancelando um convite que já era `dono` de propósito (criado por um
-- dono de verdade) — cancelar não é "virar dono", não deveria exigir
-- ser dono.
-- ---------------------------------------------------------------------
create or replace function public.impedir_convite_dono_por_nao_dono()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if NEW.papel = 'dono'
     and (TG_OP = 'INSERT' or OLD.papel is distinct from 'dono')
     and not public.tem_papel(NEW.empresa_id, 'dono')
  then
    raise exception 'Só o dono da empresa pode convidar outro dono';
  end if;

  return NEW;
end;
$$;

create trigger trg_convites_impedir_dono_por_nao_dono
  before insert or update on public.convites
  for each row
  execute function public.impedir_convite_dono_por_nao_dono();

-- ---------------------------------------------------------------------
-- Camada 2: guarda de escalada de privilégio em `empresa_membros`.
-- `before insert or update or delete` — a RLS `FOR ALL` permite os três
-- caminhos, a guarda precisa cobrir todos.
-- ---------------------------------------------------------------------
create or replace function public.impedir_escalada_privilegio_membro()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_empresa_ja_tem_membro boolean;
  v_donos_restantes bigint;
  v_aceitando_convite boolean;
begin
  v_aceitando_convite := coalesce(current_setting('app.aceitando_convite', true), '') = 'true';

  -- 1. Virar dono por escrita DIRETA exige já ser dono. Só dispara numa
  -- TRANSIÇÃO de verdade pra 'dono' (insert, ou update onde
  -- `OLD.papel` não era 'dono') — sem isso, um UPDATE que só mexe em
  -- `deleted_at` de uma linha que JÁ era 'dono' também cai aqui (NEW.papel
  -- herda o valor antigo, 'dono', sem de fato estar "virando" nada) e
  -- dispara a mensagem errada (achado rodando o pgTAP: "remover o dono"
  -- acusava "promover outro dono"). Duas exceções: (a) bootstrap de
  -- empresa nova (criar_empresa_com_onboarding insere `empresas` e o
  -- primeiro membro `dono` na mesma transação; nesse instante a
  -- contagem é sempre zero, e a regra 3 abaixo garante que uma empresa
  -- existente nunca fica sem dono, então "zero linhas" é sinal seguro e
  -- exclusivo de bootstrap); (b) `aceitar_convite` reivindicando um
  -- convite que a camada 1 já autorizou — a pessoa aceitando não é dono
  -- ainda (é ela mesma quem está entrando), não faz sentido exigir
  -- `tem_papel(dono)` dela.
  if TG_OP in ('INSERT', 'UPDATE') and NEW.papel = 'dono'
     and (TG_OP = 'INSERT' or OLD.papel is distinct from 'dono')
     and not public.tem_papel(NEW.empresa_id, 'dono')
     and not v_aceitando_convite
  then
    select exists (
      select 1 from public.empresa_membros where empresa_id = NEW.empresa_id
    ) into v_empresa_ja_tem_membro;

    if v_empresa_ja_tem_membro then
      raise exception 'Só o dono da empresa pode promover outro dono';
    end if;
  end if;

  -- 2. Mexer numa linha que já é dono exige ser dono. Só protege linha
  -- ATIVA (`OLD.deleted_at is null`) — um dono já removido (soft delete)
  -- não deveria continuar "blindando" a própria linha contra
  -- reativação via `aceitar_convite` (on conflict do update), que roda
  -- como o próprio usuário sendo reativado — nesse momento ele ainda
  -- não é um membro ativo, `tem_papel` daria falso mesmo sendo
  -- legítimo.
  if TG_OP in ('UPDATE', 'DELETE') and OLD.papel = 'dono' and OLD.deleted_at is null
     and not public.tem_papel(OLD.empresa_id, 'dono')
     and not v_aceitando_convite
  then
    raise exception 'Só o dono da empresa pode alterar outro dono';
  end if;

  -- 3. Nunca zero donos — demover, soft delete ou hard delete do último
  -- dono é rejeitado. Sem exceção pra `aceitando_convite`: mesmo
  -- reativando, tirar o último dono continua inválido.
  if
    (TG_OP = 'UPDATE' and OLD.papel = 'dono' and (NEW.papel <> 'dono' or NEW.deleted_at is not null))
    or (TG_OP = 'DELETE' and OLD.papel = 'dono')
  then
    select count(*) into v_donos_restantes
    from public.empresa_membros
    where empresa_id = OLD.empresa_id
      and papel = 'dono'
      and deleted_at is null
      and id <> OLD.id;

    if v_donos_restantes = 0 then
      raise exception 'A empresa precisa de ao menos um dono';
    end if;
  end if;

  if TG_OP = 'DELETE' then
    return OLD;
  end if;
  return NEW;
end;
$$;

create trigger trg_empresa_membros_impedir_escalada
  before insert or update or delete on public.empresa_membros
  for each row
  execute function public.impedir_escalada_privilegio_membro();

-- ---------------------------------------------------------------------
-- aceitar_convite — duas correções:
--
-- 1. `on conflict ... do nothing` → `do update`: sem tela de exclusão,
--    nada jamais setava `deleted_at`, então o conflito de fato nunca
--    acontecia com uma linha excluída. Agora que "remover membro"
--    existe, reconvidar alguém removido caía num `do nothing`
--    silencioso — a pessoa "aceitava" o convite mas `deleted_at`
--    continuava setado, sem acesso e sem erro nenhum.
-- 2. Seta `app.aceitando_convite` (local à transação) antes do insert,
--    pra camada 2 acima não se autobloquear quando o convite já foi
--    autorizado pela camada 1 (ex.: convite de `dono`, criado por quem
--    já era dono).
--
-- `create or replace`, não edita a migration original
-- (20260914132658_onboarding.sql).
-- ---------------------------------------------------------------------
create or replace function public.aceitar_convite(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_convite public.convites%rowtype;
begin
  select * into v_convite
  from public.convites
  where token = p_token
    and status = 'pendente'
    and expira_em > now();

  if not found then
    raise exception 'Convite inválido, expirado ou já utilizado';
  end if;

  if lower(v_convite.email) <> lower((select auth.email())) then
    raise exception 'Este convite foi enviado para outro e-mail';
  end if;

  perform set_config('app.aceitando_convite', 'true', true);

  insert into public.empresa_membros (empresa_id, usuario_id, papel, created_by)
  values (v_convite.empresa_id, auth.uid(), v_convite.papel, auth.uid())
  on conflict (empresa_id, usuario_id) do update
    set papel = excluded.papel,
        deleted_at = null,
        created_by = excluded.created_by;

  update public.convites set status = 'aceito' where id = v_convite.id;

  return v_convite.empresa_id;
end;
$$;
