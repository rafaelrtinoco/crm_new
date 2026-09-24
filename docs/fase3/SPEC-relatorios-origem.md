# Spec: `relatorios-origem` (Fase 3 recortada)

Módulo 5 de 5 do `docs/fase3/CAPABILITY-MAP.md`. Depende de `captura-leads` (origem/UTM dos contatos) e `campanhas` (`metricas_campanha`). Último módulo do ciclo — só faz sentido depois dos outros quatro existirem. PRD §6.12, recorte "por origem" (ADR 0004: "entram, mas rodando só sobre dados de origem manual/formulário/webhook genérico; sem atribuição vinda da Meta até essa integração existir").

## Objetivo

Responder duas perguntas que os módulos anteriores tornaram possíveis, mas que hoje não têm nenhuma tela: **de onde vêm os leads** (origem/UTM) e **como as campanhas performam**. Só isso — o resto do PRD §6.12 (conversão por etapa, tempo de fechamento, motivos de perda, taxa de renovação, follow-ups atrasados, clientes sem contato) fica de fora, é um módulo de relatórios maior que não foi recortado pra esta fase.

## Assunções

1. **Escopo estritamente "por origem/campanha"**, conforme o capability map — os outros relatórios do PRD §6.12 ficam pra uma fase de relatórios completa, fora deste ciclo.
2. **Exportação XLSX incluída** (reaproveita `exceljs`, já é dependência do projeto desde a Importação — 1C-3, custo marginal baixo, mesmo padrão de `import()` dinâmico). **PDF fica de fora** — não há dependência de geração de PDF no projeto hoje, e adicionar uma só pra este recorte não se justifica; entra quando o módulo de relatórios completo existir.
3. **Sem tabela nova** — é uma camada de leitura sobre `contatos` (origem/UTM/status, já existentes) e `campanhas`/`campanha_envios` (módulo anterior). Nenhuma escrita.

## Funções (sem migration de tabela — só funções/`security_invoker`)

- **`relatorio_leads_por_origem(p_data_inicio date, p_data_fim date) returns table (origem text, utm_campaign text, total_leads bigint, convertidos bigint, taxa_conversao numeric)`** — agrupa `contatos` criados no período por `origem`/`utm_campaign`; `convertidos` conta quem tem `status='cliente'` hoje (não "converteu dentro do período", é o estado atual); `taxa_conversao = convertidos::numeric / nullif(total_leads,0)`. `security_invoker` — a RLS de `contatos` já limita a quem tem acesso.
- **`relatorio_desempenho_campanhas(p_data_inicio date, p_data_fim date) returns table (campanha_id uuid, nome text, canal text, disparada_em timestamptz, enviados bigint, bloqueados bigint, optouts bigint, negocios_gerados bigint)`** — uma linha por campanha disparada no período, reaproveitando a mesma lógica de `metricas_campanha` (módulo `campanhas`) em vez de duplicá-la — implementado como uma consulta que chama `metricas_campanha` por campanha (nesta escala, dezenas de campanhas por empresa, não milhares, um `lateral join` resolve sem problema de performance; revisar se algum dia isso virar um relatório de milhares de linhas).

## Frontend

`src/features/relatorios/` (slice novo):
- `api/` — `useRelatorioLeadsPorOrigem`, `useRelatorioDesempenhoCampanhas` (ambos com filtro de período, padrão `date`/`date` já usado em `useVencimentos`).
- `logica/exportarXlsx.ts` — gera a planilha a partir do resultado da consulta, `import()` dinâmico do `exceljs` (mesmo padrão de `parseArquivo.ts` da Importação).
- `paginas/RelatorioLeadsOrigem.tsx` (tabela + gráfico simples de barras por origem — reaproveita o padrão de card com gráfico já usado na tela Início), `RelatorioDesempenhoCampanhas.tsx`.
- Rotas novas: `/relatorios/leads-origem`, `/relatorios/campanhas`. Nav: entram sob o mesmo item "Marketing" definido no spec de `campanhas`, ou um item "Relatórios" próprio — decisão de UI a confirmar na revisão deste spec (baixo risco, não é arquitetural).

## Testing Strategy

pgTAP (`supabase/tests/relatorios_origem.sql`):
- Isolamento multiempresa nas duas funções (contato/campanha de outra empresa não aparece).
- `relatorio_leads_por_origem`: cenário com leads de 2 origens diferentes, alguns convertidos, período que inclui/exclui certos contatos por `created_at` — números batem.
- `relatorio_desempenho_campanhas`: cenário reaproveitando o mesmo setup de `campanhas.sql` (módulo anterior), conferindo que os totais batem com `metricas_campanha` chamada direto.

Sem migration nova — sem risco de RLS além do já coberto pelos módulos de origem dos dados.

## Boundaries

- **Sempre:** toda função aqui é `security_invoker`, nunca bypassa a RLS de `contatos`/`campanhas`.
- **Perguntar antes:** adicionar qualquer um dos outros relatórios do PRD §6.12 a este módulo (é escopo novo, não recorte já decidido); adicionar exportação em PDF.
- **Nunca:** este módulo escrever em qualquer tabela — é puramente leitura.

## Success Criteria

- `npm run db:types` limpo (funções novas aparecem nos tipos), pgTAP cobrindo os 3 cenários acima.
- Duas telas novas mostrando dado real do ambiente de teste (seed ou dados criados manualmente), com exportação XLSX funcionando — validado no navegador.

## Open Questions

- ~~Posição na navegação~~ — resolvido na implementação: dois cards novos no índice de "Marketing" (não item próprio), ver "Correções aplicadas na implementação".

## Correções aplicadas na implementação

1. **`p_empresa_id` explícito nas duas funções** — o spec original propunha `security_invoker` sozinho ("a RLS de contatos já limita a quem tem acesso"), mas isso é incompleto: a RLS de `contatos`/`campanhas` restringe por MEMBRESIA (`is_membro`), não pela empresa selecionada no frontend. Um usuário membro de duas empresas, sem esse filtro, veria leads/campanhas das duas misturados no mesmo relatório. Corrigido acrescentando `p_empresa_id uuid` como primeiro parâmetro nas duas funções — mesmo padrão já usado em `contar_segmento_provisorio` (`segmentos.sql`) para função sem entidade âncora, e a regra "empresa_id: cinto e suspensório" do CLAUDE.md. pgTAP cobre o cenário concreto: um gestor da Alfa que também é membro (comum) da Beta pedindo relatório com `p_empresa_id` da Alfa não vê o contato da Beta.
2. **Navegação: cards no índice de "Marketing"**, não item de sidebar próprio — a sidebar mobile já tem 6 itens (Início/Contatos/Vencimentos/Funis/Tarefas/Marketing); um item "Relatórios" a mais apertaria a barra inferior sem necessidade, já que os dois relatórios deste recorte são leitura sobre dado de Marketing (leads de captura + campanhas). `AppShell.tsx`: `/relatorios` entrou em `prefixosAtivos` do item "Marketing", pra ele continuar aceso nessas rotas.
3. **`relatorio_desempenho_campanhas` filtra `deleted_at is null` explicitamente** — `campanhas` é "configuração compartilhada" (RLS não filtra `deleted_at`, fica pro chamador, mesmo padrão de `useCampanhas` no frontend); sem esse filtro, campanha excluída (soft delete) apareceria no relatório.
4. **`npm run db:reset && npm run db:types && npm run test:db` não rodaram nesta sessão** — ambiente sem Docker Desktop disponível. `lint`, `typecheck` (exceto os 2 novos RPCs, que só existem depois de `db:types`) e `test` (32/32 Vitest) foram confirmados; `build`/`typecheck` completos e o teste no navegador ficam pendentes de rodar numa máquina com Docker aberto, seguindo os passos de "Success Criteria".
