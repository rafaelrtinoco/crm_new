-- Fase 3 recortada, módulo 2/5: segmentos dinâmicos salvos (PRD §6.9,
-- docs/fase3/SPEC-segmentos.md). Filtro nomeado e reutilizável sobre a
-- base de contatos, avaliado ao vivo (nunca materializado) — insumo do
-- módulo `campanhas` (5/5), e já útil sozinho pra contar/listar
-- contatos que batem com um critério.
--
-- RLS segue o padrão de "configuração compartilhada" já usado por
-- funis/motivos_perda (não o de contatos/vencimentos): qualquer membro
-- lê, só gestor+ escreve — sem `deleted_at is null` na policy (mesmo
-- raciocínio de funis: essa combinação com FOR ALL é o que causou o
-- bug de auto-bloqueio documentado em soft_delete_e_dedup.sql). O
-- filtro de `deleted_at` fica por conta do client, como useFunis.ts já
-- faz.

-- ---------------------------------------------------------------------
-- validar_criterios_segmento — valida o conjunto fechado de `campo`
-- aceito na DSL de `criterios`, direto no CHECK da tabela (rejeita na
-- hora de salvar, não só quando alguém tentar avaliar o segmento).
-- ---------------------------------------------------------------------
create or replace function public.validar_criterios_segmento(p_criterios jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    bool_and(
      (regra ->> 'campo') in (
        'status', 'temperatura', 'tags', 'origem', 'cidade', 'idade',
        'responsavel_id', 'sem_contato_dias', 'vencimento_tipo_mes', 'personalizado'
      )
    ),
    true
  )
  from jsonb_array_elements(coalesce(p_criterios -> 'regras', '[]'::jsonb)) as regra;
$$;

revoke all on function public.validar_criterios_segmento(jsonb) from public;
grant execute on function public.validar_criterios_segmento(jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- segmentos
-- ---------------------------------------------------------------------
create table public.segmentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  nome text not null,
  criterios jsonb not null default '{"regras": []}'::jsonb
    check (public.validar_criterios_segmento(criterios)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  deleted_at timestamptz,
  unique (empresa_id, nome),
  unique (empresa_id, id) -- alvo de FK composta pra campanhas.segmento_id (módulo seguinte, ADR 0003)
);

create index idx_segmentos_empresa on public.segmentos (empresa_id);

create trigger trg_segmentos_updated_at
  before update on public.segmentos
  for each row execute function public.set_updated_at();

alter table public.segmentos enable row level security;

create policy "segmentos_select_membro"
  on public.segmentos for select
  to authenticated
  using (public.is_membro(empresa_id));

create policy "segmentos_gestor_escreve"
  on public.segmentos for all
  to authenticated
  using (public.tem_papel(empresa_id, 'gestor'))
  with check (public.tem_papel(empresa_id, 'gestor'));

-- ---------------------------------------------------------------------
-- contato_bate_criterios — avalia um contato contra a DSL de
-- `criterios`, sem SQL dinâmico (cada `campo` é um `case` fixo; nenhum
-- nome de coluna nem trecho de SQL vem do JSON, só valores comparados
-- por parâmetro). `security invoker` de propósito: os sub-selects em
-- `contato_tags`/`vencimentos`/`empresas` respeitam a RLS de quem está
-- avaliando, então dois usuários diferentes podem legitimamente ver
-- resultados diferentes pro mesmo segmento — mesma garantia que
-- `avaliar_segmento` documenta pro nível de contato.
-- `campo`/`operador` fora do conjunto fechado levantam exceção — nunca
-- excluem o contato em silêncio.
-- ---------------------------------------------------------------------
create or replace function public.contato_bate_criterios(p_contato_id uuid, p_criterios jsonb)
returns boolean
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_contato record;
  v_empresa_id uuid;
  v_fuso text;
  v_hoje date;
  v_regra jsonb;
  v_campo text;
  v_operador text;
  v_valor jsonb;
begin
  select c.empresa_id, c.status, c.temperatura, c.origem, c.responsavel_id,
         c.nascimento, c.ultimo_contato_em, (c.endereco ->> 'cidade') as cidade, c.campos
    into v_contato
  from public.contatos c
  where c.id = p_contato_id;

  if not found then
    return false;
  end if;

  v_empresa_id := v_contato.empresa_id;

  select fuso into v_fuso from public.empresas where id = v_empresa_id;
  v_fuso := coalesce(v_fuso, 'America/Sao_Paulo');
  v_hoje := (now() at time zone v_fuso)::date;

  for v_regra in select * from jsonb_array_elements(coalesce(p_criterios -> 'regras', '[]'::jsonb))
  loop
    v_campo := v_regra ->> 'campo';
    v_operador := v_regra ->> 'operador';
    v_valor := v_regra -> 'valor';

    case v_campo
      when 'status' then
        if v_operador <> 'em' then
          raise exception 'Operador "%" inválido pra campo "status"', v_operador;
        end if;
        if v_contato.status not in (select jsonb_array_elements_text(v_valor)) then
          return false;
        end if;

      when 'temperatura' then
        if v_operador <> 'em' then
          raise exception 'Operador "%" inválido pra campo "temperatura"', v_operador;
        end if;
        if v_contato.temperatura is null
          or v_contato.temperatura not in (select jsonb_array_elements_text(v_valor))
        then
          return false;
        end if;

      when 'origem' then
        if v_operador <> 'em' then
          raise exception 'Operador "%" inválido pra campo "origem"', v_operador;
        end if;
        if v_contato.origem is null
          or v_contato.origem not in (select jsonb_array_elements_text(v_valor))
        then
          return false;
        end if;

      when 'responsavel_id' then
        if v_operador <> 'em' then
          raise exception 'Operador "%" inválido pra campo "responsavel_id"', v_operador;
        end if;
        if v_contato.responsavel_id is null
          or v_contato.responsavel_id::text not in (select jsonb_array_elements_text(v_valor))
        then
          return false;
        end if;

      when 'cidade' then
        if v_operador <> 'igual' then
          raise exception 'Operador "%" inválido pra campo "cidade"', v_operador;
        end if;
        if v_contato.cidade is null or v_contato.cidade <> (v_regra ->> 'valor') then
          return false;
        end if;

      when 'idade' then
        if v_operador <> 'entre' then
          raise exception 'Operador "%" inválido pra campo "idade"', v_operador;
        end if;
        if v_contato.nascimento is null then
          return false;
        end if;
        if extract(year from age(v_hoje, v_contato.nascimento)) < (v_valor ->> 0)::int
          or extract(year from age(v_hoje, v_contato.nascimento)) > (v_valor ->> 1)::int
        then
          return false;
        end if;

      when 'sem_contato_dias' then
        if v_operador <> 'maior_ou_igual' then
          raise exception 'Operador "%" inválido pra campo "sem_contato_dias"', v_operador;
        end if;
        -- nunca contatado conta como satisfazendo qualquer limite (o
        -- caso mais extremo de "sem contato" — decisão do spec).
        if v_contato.ultimo_contato_em is not null
          and (v_hoje - (v_contato.ultimo_contato_em at time zone v_fuso)::date) < (v_regra ->> 'valor')::int
        then
          return false;
        end if;

      when 'tags' then
        if v_operador <> 'contem_algum' then
          raise exception 'Operador "%" inválido pra campo "tags"', v_operador;
        end if;
        if not exists (
          select 1 from public.contato_tags ct
          where ct.contato_id = p_contato_id
            and ct.tag_id::text in (select jsonb_array_elements_text(v_valor))
        ) then
          return false;
        end if;

      when 'vencimento_tipo_mes' then
        if v_operador <> 'igual' then
          raise exception 'Operador "%" inválido pra campo "vencimento_tipo_mes"', v_operador;
        end if;
        if not exists (
          select 1 from public.vencimentos v
          where v.contato_id = p_contato_id
            and v.deleted_at is null
            and v.vencimento_tipo_id = (v_valor ->> 'vencimento_tipo_id')::uuid
            and extract(month from v.data_vencimento) = (v_valor ->> 'mes')::int
        ) then
          return false;
        end if;

      when 'personalizado' then
        declare
          v_chave text := v_regra ->> 'chave';
          v_tipo text;
          v_bruto text := v_contato.campos ->> (v_regra ->> 'chave');
        begin
          select cp.tipo into v_tipo
          from public.campos_personalizados cp
          where cp.empresa_id = v_empresa_id and cp.entidade = 'contato' and cp.chave = v_chave;

          if v_bruto is null then
            return false;
          end if;

          if v_tipo = 'numero' then
            if v_operador = 'entre' then
              if v_bruto::numeric < (v_valor ->> 0)::numeric or v_bruto::numeric > (v_valor ->> 1)::numeric then
                return false;
              end if;
            elsif v_operador = 'maior_ou_igual' then
              if v_bruto::numeric < (v_regra ->> 'valor')::numeric then return false; end if;
            elsif v_operador = 'menor_ou_igual' then
              if v_bruto::numeric > (v_regra ->> 'valor')::numeric then return false; end if;
            else
              raise exception 'Operador "%" inválido pra campo personalizado numérico', v_operador;
            end if;
          elsif v_tipo = 'data' then
            if v_operador = 'entre' then
              if v_bruto::date < (v_valor ->> 0)::date or v_bruto::date > (v_valor ->> 1)::date then
                return false;
              end if;
            elsif v_operador = 'maior_ou_igual' then
              if v_bruto::date < (v_regra ->> 'valor')::date then return false; end if;
            elsif v_operador = 'menor_ou_igual' then
              if v_bruto::date > (v_regra ->> 'valor')::date then return false; end if;
            else
              raise exception 'Operador "%" inválido pra campo personalizado de data', v_operador;
            end if;
          elsif v_tipo = 'booleano' then
            if v_operador <> 'igual' then
              raise exception 'Operador "%" inválido pra campo personalizado booleano', v_operador;
            end if;
            if v_bruto::boolean <> (v_regra ->> 'valor')::boolean then return false; end if;
          else -- texto/selecao
            if v_operador = 'igual' then
              if v_bruto <> (v_regra ->> 'valor') then return false; end if;
            elsif v_operador = 'em' then
              if v_bruto not in (select jsonb_array_elements_text(v_valor)) then return false; end if;
            else
              raise exception 'Operador "%" inválido pra campo personalizado de texto/seleção', v_operador;
            end if;
          end if;
        end;

      else
        raise exception 'Campo de segmento desconhecido: "%"', v_campo;
    end case;
  end loop;

  return true;
end;
$$;

revoke all on function public.contato_bate_criterios(uuid, jsonb) from public;
grant execute on function public.contato_bate_criterios(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- avaliar_segmento / contar_segmento / prever_contato_segmento —
-- security invoker: a RLS de `contatos` já filtra o que quem chama
-- pode ver, então o resultado nunca vaza contato fora do alcance de
-- quem pediu, mesmo que o segmento em si seja legível por todo mundo.
-- ---------------------------------------------------------------------
create or replace function public.avaliar_segmento(p_segmento_id uuid)
returns setof uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select c.id
  from public.segmentos s
  join public.contatos c on c.empresa_id = s.empresa_id
  where s.id = p_segmento_id
    and public.contato_bate_criterios(c.id, s.criterios);
$$;

revoke all on function public.avaliar_segmento(uuid) from public;
grant execute on function public.avaliar_segmento(uuid) to authenticated;

create or replace function public.contar_segmento(p_segmento_id uuid)
returns bigint
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*) from public.avaliar_segmento(p_segmento_id);
$$;

revoke all on function public.contar_segmento(uuid) from public;
grant execute on function public.contar_segmento(uuid) to authenticated;

create or replace function public.prever_contato_segmento(p_segmento_id uuid)
returns public.contatos
language sql
stable
security invoker
set search_path = ''
as $$
  select c.*
  from public.contatos c
  where c.id in (select public.avaliar_segmento(p_segmento_id))
  limit 1;
$$;

revoke all on function public.prever_contato_segmento(uuid) from public;
grant execute on function public.prever_contato_segmento(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- contar_segmento_provisorio — mesma lógica de contar_segmento, mas
-- contra `criterios` ainda não salvos (o construtor no frontend precisa
-- mostrar "X contatos" enquanto o usuário edita regras, antes de
-- existir uma linha em `segmentos` pra apontar). security invoker:
-- mesma garantia de RLS de contatos que as funções acima.
-- ---------------------------------------------------------------------
create or replace function public.contar_segmento_provisorio(p_empresa_id uuid, p_criterios jsonb)
returns bigint
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*)
  from public.contatos c
  where c.empresa_id = p_empresa_id
    and public.contato_bate_criterios(c.id, p_criterios);
$$;

revoke all on function public.contar_segmento_provisorio(uuid, jsonb) from public;
grant execute on function public.contar_segmento_provisorio(uuid, jsonb) to authenticated;
