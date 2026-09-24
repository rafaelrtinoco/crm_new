-- Fase 3 recortada, módulo 5/5 (último): relatorios-origem
-- (docs/fase3/SPEC-relatorios-origem.md). Depende de captura-leads
-- (origem/UTM dos contatos) e campanhas (metricas_campanha). Sem tabela
-- nova — camada de leitura pura sobre contatos/campanhas, nenhuma escrita.
--
-- Correção em relação ao spec original: as duas funções ganharam
-- p_empresa_id como primeiro parâmetro, que o spec não previa ("a RLS de
-- contatos já limita a quem tem acesso" — verdade, mas RLS restringe por
-- MEMBRESIA, não pela empresa selecionada no frontend; um usuário membro
-- de duas empresas, sem esse filtro explícito, veria leads/campanhas das
-- duas misturados no mesmo relatório). Mesmo padrão já usado em
-- `contar_segmento_provisorio` (segmentos.sql) pra função sem entidade
-- âncora — e a regra de ouro "empresa_id: cinto e suspensório" do
-- CLAUDE.md. RLS continua sendo a segunda trava: se o invoker não for
-- membro de p_empresa_id, o filtro devolve zero linhas de qualquer jeito.

-- ---------------------------------------------------------------------
-- relatorio_leads_por_origem — leads criados no período, agrupados por
-- origem/utm_campaign. "Convertidos" é o estado ATUAL (status='cliente'),
-- não "converteu dentro do período" (spec, Objetivo). security invoker:
-- mesma RLS de `contatos` (contatos_select) protege o que quem chama pode
-- ver; `deleted_at is null` já é reforçado por ela, sem repetir aqui
-- (mesmo padrão de avaliar_segmento/contar_segmento).
-- ---------------------------------------------------------------------
create or replace function public.relatorio_leads_por_origem(
  p_empresa_id uuid,
  p_data_inicio date,
  p_data_fim date
)
returns table (
  origem text,
  utm_campaign text,
  total_leads bigint,
  convertidos bigint,
  taxa_conversao numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    c.origem,
    c.utm_campaign,
    count(*)::bigint as total_leads,
    count(*) filter (where c.status = 'cliente')::bigint as convertidos,
    round(
      count(*) filter (where c.status = 'cliente')::numeric / nullif(count(*), 0),
      4
    ) as taxa_conversao
  from public.contatos c
  where c.empresa_id = p_empresa_id
    and c.created_at::date between p_data_inicio and p_data_fim
  group by c.origem, c.utm_campaign
  order by total_leads desc;
$$;

revoke all on function public.relatorio_leads_por_origem(uuid, date, date) from public;
grant execute on function public.relatorio_leads_por_origem(uuid, date, date) to authenticated;

-- ---------------------------------------------------------------------
-- relatorio_desempenho_campanhas — uma linha por campanha disparada no
-- período, reaproveitando metricas_campanha (módulo campanhas) via
-- lateral join em vez de duplicar a lógica (spec) — na escala de dezenas
-- de campanhas por empresa, não milhares, sem custo de performance
-- relevante. `campanhas` é "configuração compartilhada": RLS não filtra
-- deleted_at (fica pro chamador, mesmo padrão de useCampanhas no
-- frontend) — aqui dentro da função, não existe "cliente" fora dela.
-- ---------------------------------------------------------------------
create or replace function public.relatorio_desempenho_campanhas(
  p_empresa_id uuid,
  p_data_inicio date,
  p_data_fim date
)
returns table (
  campanha_id uuid,
  nome text,
  canal text,
  disparada_em timestamptz,
  enviados bigint,
  bloqueados bigint,
  optouts bigint,
  negocios_gerados bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    c.id as campanha_id,
    c.nome,
    c.canal,
    c.disparada_em,
    m.enviados,
    m.bloqueados,
    m.optouts,
    m.negocios_gerados
  from public.campanhas c
  cross join lateral public.metricas_campanha(c.id) as m
  where c.empresa_id = p_empresa_id
    and c.deleted_at is null
    and c.disparada_em is not null
    and c.disparada_em::date between p_data_inicio and p_data_fim
  order by c.disparada_em desc;
$$;

revoke all on function public.relatorio_desempenho_campanhas(uuid, date, date) from public;
grant execute on function public.relatorio_desempenho_campanhas(uuid, date, date) to authenticated;
