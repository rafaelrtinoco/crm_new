# Spec: `segmentos` (Fase 3 recortada)

Módulo 2 de 5 do `docs/fase3/CAPABILITY-MAP.md`. Sem dependência de outro módulo novo — lê `contatos`/`campos_personalizados`/`tags`/`vencimentos`/`empresa_membros`, todos já existentes. PRD §6.9.

## Objetivo

Segmento dinâmico salvo: um filtro nomeado e reutilizável sobre a base de contatos, avaliado sob demanda (nunca materializado). É o insumo de `campanhas` (módulo seguinte) — "mandar campanha pro segmento X" — e serve sozinho já nesta fase pra contar/listar contatos que batem com um critério, sem precisar de campanha nenhuma.

**Critérios suportados** (PRD §6.9, literal): status, temperatura, tags, origem, tipo e mês de vencimento, cidade, faixa de idade, responsável, sem contato há X dias, campos personalizados.

## Assunções (a confirmar na revisão deste spec)

1. **Combinador único: E (AND) entre critérios diferentes; OU (OR) dentro do mesmo critério multi-valor** (ex.: `tags em [A, B]` = tem A ou B; `status em [lead, cliente]` = é lead ou cliente). Sem agrupamento nem OR entre critérios diferentes nesta fase — PRD não pede isso explicitamente, e um construtor de grupos aninhados é bem mais complexo pra UI/schema. Se o usuário realmente precisar de "quente OU sem contato há 60 dias" como um segmento só, isso fica pra depois.
2. **Sem materialização.** Segmento é avaliado ao vivo (`avaliar_segmento(segmento_id)`) toda vez que é consultado — contagem/lista sempre reflete o estado atual da base. Quando `campanhas` disparar um envio de verdade, é responsabilidade daquele módulo tirar o "retrato" da lista de contatos naquele instante (ver nota de fronteira abaixo) — `segmentos` não guarda histórico de quem já esteve nele.
3. **Critério "sem contato há X dias" conta contato nunca contatado** (`ultimo_contato_em is null`) como satisfazendo qualquer limite — é o caso mais extremo de "sem contato".

## Modelo de dados

```sql
create table public.segmentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  nome text not null,
  criterios jsonb not null default '{"regras": []}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  deleted_at timestamptz
);
```

RLS: mesmo padrão de `tags`/`funis`/`motivos_perda` — qualquer membro lê (`select` com `is_membro`), só gestor+ escreve (`tem_papel(empresa_id,'gestor')`). Justificativa: um segmento mal configurado dispara campanha pra base errada; escrita fica no mesmo nível de risco que mexer no funil da empresa inteira.

### DSL de `criterios`

```json
{
  "regras": [
    { "campo": "status", "operador": "em", "valor": ["lead", "cliente"] },
    { "campo": "temperatura", "operador": "em", "valor": ["quente"] },
    { "campo": "tags", "operador": "contem_algum", "valor": ["<tag_id>", "<tag_id>"] },
    { "campo": "origem", "operador": "em", "valor": ["site", "indicacao"] },
    { "campo": "cidade", "operador": "igual", "valor": "São Paulo" },
    { "campo": "idade", "operador": "entre", "valor": [30, 45] },
    { "campo": "responsavel_id", "operador": "em", "valor": ["<usuario_id>"] },
    { "campo": "sem_contato_dias", "operador": "maior_ou_igual", "valor": 30 },
    { "campo": "vencimento_tipo_mes", "operador": "igual", "valor": { "vencimento_tipo_id": "<id>", "mes": 9 } },
    { "campo": "personalizado", "chave": "profissao", "operador": "igual", "valor": "corretor" }
  ]
}
```

`campo`/`operador` são um conjunto fechado, validado por `check` via função (não string livre — ver Boundaries). `personalizado` resolve `chave` contra `contatos.campos ->> chave`, com o `operador` permitido dependendo do `campos_personalizados.tipo` daquela chave (texto/selecao → `igual`/`em`; numero/data → `entre`/`maior_ou_igual`/`menor_ou_igual`; booleano → `igual`).

## Funções

- **`avaliar_segmento(p_segmento_id uuid) returns setof uuid`** (ids de `contatos`) — `security invoker`: a RLS de `contatos` já filtra o que quem chama pode ver, então o resultado nunca vaza contato fora do alcance de quem pediu, mesmo que o segmento em si seja legível por todo mundo. Implementação: **sem SQL dinâmico** — percorre `criterios->'regras'` em `plpgsql`, e cada `campo` tem um `case` próprio que aplica o filtro correspondente contra `contatos`/`tags`/`vencimentos` (evita qualquer superfície de injeção: nenhum nome de coluna nem trecho de SQL vem do JSON, só valores comparados por parâmetro).
- **`contar_segmento(p_segmento_id uuid) returns bigint`** — `count(*)` sobre `avaliar_segmento`. Alimenta o preview "X contatos" no construtor.
- **`prever_contato_segmento(p_segmento_id uuid) returns contatos`** — um contato real que bate com o segmento (ou nenhum), pra prévia com dado real que o PRD pede (usada por `campanhas` pra montar a prévia da mensagem).

## Frontend

`src/features/segmentos/` (slice novo):
- `api/` — `useSegmentos`, `useSegmento`, `useMutacoesSegmento` (criar/atualizar/excluir — soft delete via padrão `excluir_registro` já existente), `useContagemSegmento` (chama `contar_segmento`, debounced enquanto o usuário edita regras).
- `schemas.ts` — Zod pro array de regras, com validação condicional por `campo` (mesmo espírito de `construirContatoSchema` dinâmico do módulo `contatos`).
- `components/ConstrutorRegras.tsx` — lista de regras (campo → operador → valor, o input de valor muda de tipo conforme o campo, mesmo padrão de `CampoPersonalizado.tsx`), com contagem ao vivo.
- `paginas/ListaSegmentos.tsx`, `paginas/FormularioSegmento.tsx`.
- Rota nova: `/segmentos`, `/segmentos/novo`, `/segmentos/:id/editar`. Nav: item "Segmentos" no `AppShell` (ou agrupado sob um item "Campanhas" quando esse módulo existir — decisão de nav adiada pro spec de `campanhas`, que vai definir a IA da seção de marketing inteira).

## Testing Strategy

pgTAP (`supabase/tests/segmentos.sql`):
- Isolamento multiempresa (padrão).
- RLS: membro comum lê, não escreve; gestor escreve.
- Um caso por `campo` suportado (status, temperatura, tags, origem, cidade, idade, responsável, sem-contato-dias, vencimento-tipo-mês, personalizado) provando que `avaliar_segmento` inclui/exclui o contato certo — não só "não dá erro".
- Combinação de 2+ regras provando o AND entre critérios e o OR dentro de um `em`.
- `avaliar_segmento` respeita RLS de `contatos` (usuário sem carteira compartilhada não vê contato de outro responsável mesmo que bata com o segmento).

Sem migration nova além da criação de `segmentos` — reaproveita `contatos`/`vencimentos`/`campos_personalizados`/`tags` como estão.

## Boundaries

- **Sempre:** `campo`/`operador` validados contra um conjunto fechado (função rejeita valor fora da lista, não silenciosamente ignora); teste pgTAP por `campo` antes de fechar.
- **Perguntar antes:** adicionar um `campo` novo à DSL (schema fechado, cada um é uma decisão); mudar o combinador pra suportar grupos/OR entre critérios (mudança de schema retroativamente incompatível).
- **Nunca:** montar a avaliação de `criterios` com SQL dinâmico/`execute` concatenando valor do JSON — todo campo é um `case` fixo em `plpgsql`, nunca `format('... %s ...', valor_do_json)`.

## Success Criteria

- Migration aplicada, `npm run db:types` limpo, pgTAP cobrindo os 10 campos da DSL + isolamento + RLS.
- Tela `/segmentos` permite criar um segmento com 2+ regras, ver a contagem mudar ao vivo, salvar, editar e excluir — validado no navegador.
- `avaliar_segmento`/`contar_segmento` chamados a partir de `campanhas` (módulo seguinte) sem precisar de nenhuma mudança neste módulo.

## Open Questions

- As duas assunções da seção acima (combinador AND-only, sem materialização) — se o usuário discordar na revisão, isso muda o schema da DSL antes de codar, não depois.
