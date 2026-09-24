<!--
Lido pelo Claude Code no início de toda sessão. Mantenha curto (< 200 linhas) e humano.
Regras determinísticas: .claude/settings.json e hooks.
Regras por área (carregam só ao mexer nos arquivos): .claude/rules/.
Procedimentos sob demanda: .claude/skills/.
Comentários HTML como este não entram no contexto do Claude.
-->

# Facility — CRM SaaS de relacionamento

CRM multiempresa para corretores de seguros (nicho de lançamento) e, depois, outros negócios do ramo administrativo. Foco: leads, funil, vencimentos com lembretes automáticos, follow-up e campanhas. **Não** é sistema de gestão de apólices, financeiro ou comissões.

> **Ciclo atual:** Fase 3 recortada (5 módulos em `docs/fase3/`).
> Fase 2 (WhatsApp) adiada — ADR 0004.
>
> **Leia `docs/PROGRESSO.md` antes de retomar** — módulo entregue, pendências
> e próximo passo ficam lá, não aqui.
>
> **Pendência de lançamento:** `auth.email.enable_confirmations` precisa virar
> `true` antes de qualquer Supabase de staging/produção.

- **Especificação:** `docs/PRD.md` — leia apenas a seção do que estiver implementando.
- **Ciclo atual: Fase 3 recortada.** Não implemente módulo de outro ciclo sem eu pedir.
- **Decisões de arquitetura:** `docs/decisoes/NNNN-titulo.md` (ADR curta, uma por arquivo).
- **Identidade visual:** `docs/design-system.md` ("Soft Professional") — confira antes de inventar cor, raio ou peso de fonte.
- **Specs do ciclo atual:** `docs/fase3/CAPABILITY-MAP.md` + `docs/fase3/SPEC-<modulo>.md`.
- **Regras por área:** `.claude/rules/` (`Supabase.md`, `Frontend.md`, `Mensageria.md`) — carregam sozinhas ao mexer nos paths correspondentes.
- **Sobre este repositório:** o `README.md` documenta o produto; a documentação original do starter pack (hooks, skills, permissões) está em `docs/starter-pack.md`.

## Stack

- **Backend:** Supabase — Postgres + RLS, Auth, Storage, Edge Functions (Deno), pg_cron, filas (pgmq), Realtime
- **Frontend:** React + Vite + TypeScript strict, Tailwind + shadcn/ui, TanStack Query, React Hook Form + Zod, React Router, PWA
- **Infra:** Vercel (frontend) + projetos Supabase separados para local, staging e produção
- **Padrão:** SaaS multiempresa; vertical slices em `src/features/<slice>`

## Arquitetura — invariantes do núcleo

Acertos do redesenho arquitetural (ADR 0003) e do ciclo atual (ADR 0005) que uma migration ou query escrita "do jeito óbvio" desfaz em silêncio.

- **Toda FK é composta.** `(empresa_id, <fk>) references <tabela> (empresa_id, id)`, nunca `references <tabela>(id)`. `responsavel_id` referencia `empresa_membros (empresa_id, usuario_id)`, não `auth.users`. A RLS valida quem escreve na linha, não para onde as colunas apontam — FK simples deixa a empresa A apontar para dados da B. Tabela nova precisa de `unique (empresa_id, id)` para servir de alvo. Ver `docs/decisoes/0003-integridade-multiempresa-por-chave-composta.md`.
- **Dois padrões de RLS — escolha explícita.** *Tabelas com dono* (`contatos`, `vencimentos`, `negocios`, `tarefas`, `organizacoes`): `pode_acessar_responsavel(...)` + `deleted_at is null` na policy de SELECT, **4 policies separadas** (select/insert/update/delete, nunca `FOR ALL`), exclusão só via RPC `excluir_registro`/`restaurar_registro` — `UPDATE deleted_at` direto é rejeitado de propósito. *Configuração compartilhada* (`funis`, `tags`, `motivos_perda`, `vencimento_tipos`, `segmentos`): qualquer membro lê, gestor+ escreve, sem `deleted_at` na policy — filtro fica no cliente. Misturar os dois reabre a armadilha de auto-bloqueio de `FOR ALL` + `deleted_at is null` (RLS reaplica a `USING` de SELECT contra a linha nova em todo UPDATE).
- **A timeline é automática.** `atividades` é escrita por trigger do banco (mudança de etapa, ganho, perda, tarefa concluída, vencimento renovado). Não insira `atividades` do cliente — duplica. Mover negócio é um RPC só (`mover_negocio_etapa`).
- **O worker da fila roda em Postgres.** `processar_fila_envios` (plpgsql + pg_cron a cada minuto) + `mock_enviar_mensagem`, sem Edge Function e sem pg_net enquanto os providers forem mock. Enfileirar é `enfileirar_envio` (RPC). Ver `docs/decisoes/0005-fila-envios-worker-em-postgres.md`.
- **`empresa_id` no frontend: cinto e suspensório.** A RLS já isola, mas toda query também filtra `.eq("empresa_id", empresaId)` explicitamente. `queryKey` segue `["entidade", empresaId, ...filtros]`, pro cache não vazar entre empresas ao trocar de contexto. A empresa selecionada vem de `useEmpresaAtual()` (`src/features/onboarding/api/useEmpresas.ts`), persistida como UUID em `localStorage` — só o UUID, nunca dado pessoal.
- **Providers globais** em `src/app/providers.tsx`, nesta ordem: `QueryClientProvider` → `AuthProvider` → `VocabularioProvider`. É esse encadeamento que faz `useVocabulario()` resolver os rótulos da empresa corrente.

## Comandos essenciais

`npm run <script>` é a fonte da verdade (funciona em qualquer máquina com Node); `make <alvo>` é um atalho fino que delega para o mesmo script — ver `docs/decisoes/0002-interface-de-comandos.md`. `dev`, `db-reset`, `db-types` e `test-db` exigem o Docker Desktop aberto.

```bash
# Setup
npm install              # make install
npm run dev               # make dev — sobe Supabase local + Vite juntos (precisa do Docker aberto)
npm run functions         # make functions — Edge Functions locais
npm run supabase:stop     # para o Supabase local

# Build e testes de app
npm run build              # tsc -b (3 projetos: app, node, sw) + vite build
npm run test:watch          # vitest em modo watch

# Banco
npm run db:migration -- <nome>   # make migration name=<nome>
npm run db:reset          # make db-reset — recria o banco LOCAL (migrations + seed)
npm run db:types          # make db-types — regenera src/types/database.ts

# Qualidade
npm run lint               # make lint
npm run typecheck          # make typecheck — tsc -b sobre tsconfig.app/node/sw.json
npm run test                # make test — vitest
npm run test:db             # make test-db — pgTAP: RLS e isolamento entre empresas

# Rodar um teste único
npx vitest run <arquivo>              # um arquivo de teste
npx vitest run -t "<nome do teste>"   # um teste pelo nome
npx supabase test db --file supabase/tests/<arquivo>.sql   # um pgTAP

# Deploy — alvos existem no Makefile mas ainda não implementados (saem com erro)
make deploy-staging
make deploy-prod
```

`src/sw.ts` (service worker do PWA — push + notificationclick) fica fora do projeto TS `app` de propósito; é compilado à parte pelo `injectManifest` do `vite-plugin-pwa` (`vite.config.ts`), com `tsconfig.sw.json` próprio.

Não existe `vitest.config.ts` — a config do Vitest é a chave `test` do próprio `vite.config.ts` (jsdom, `globals: true`, setup em `src/test/setup.ts`). Testes de app ficam co-localizados com o código (`*.test.ts`); a maior parte da cobertura é pgTAP.

## Regras de ouro

- **Isolamento entre empresas é inegociável.** Toda tabela de dados tem `empresa_id` e RLS, e toda FK entre tabelas com `empresa_id` é composta (ver "Arquitetura" acima). Tabela nova só está pronta com política RLS, FK composta onde aplicável e teste pgTAP de isolamento.
- **Nada de nicho no código.** Rótulos, campos, funis, tipos de vencimento e mensagens vêm do template da empresa. Nunca escreva "apólice", "segurado" ou "corretor" em componente — use `useVocabulario()`.
- **Datas de calendário são `date`.** Vencimento e aniversário não são `timestamptz`. Régua e "hoje" são calculados no fuso da empresa, nunca no do servidor ou do navegador.
- **Toda mensagem sai pela fila de envios** (`enfileirar_envio` → `processar_fila_envios`). Endereço válido, consentimento, opt-out e horário comercial são checados em um único lugar, nesta ordem; fora do horário comercial reagenda, não bloqueia. Limite de envios do plano e janela de 24h do WhatsApp são desenho de fase futura, ainda não implementados — não checar duas vezes nem assumir que já existem.
- **Integrações externas só via providers** em `supabase/functions/_shared/providers/`, quando deixarem de ser mock — hoje o worker da fila roda inteiro em Postgres (ver "Arquitetura"), sem Edge Function.
- **`service_role` só em Edge Functions**, com filtro explícito de `empresa_id` em toda query.

## Convenções

- **Branches:** `feat/<slice>-<short-desc>`, `fix/<short-desc>`, `chore/<short-desc>`
  - Slices: `onboarding`, `contatos`, `vencimentos`, `funis`, `tarefas`, `hoje`, `notificacoes`, `segmentos`, `whatsapp`, `automacoes`, `campanhas`, `captura`, `billing`, `admin`
- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`), descrição em português
- **PRs:** Sempre referencie a issue, descreva o "porquê", não só o "o quê"
- **Tests:** TDD onde a complexidade pede; testes lêem como spec. Obrigatório em: cálculo de réguas e recorrência, regras da fila de envios e isolamento RLS
- **Idioma:** UI em pt-BR. Nomes de domínio em português, espelhando o banco (`contatos`, `Vencimento`, `useNegocios`); termos técnicos genéricos em inglês (`utils`, `hooks`, `components`)
- **Imports:** alias `@/` aponta pra `src/` (`tsconfig.app.json` + `vite.config.ts`) — sempre usar, nunca `../../..`.
- **TypeScript além do `strict`:** `noUncheckedIndexedAccess` (acesso a array/objeto por índice devolve `T | undefined`), `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`.

## Estrutura

```
docs/
  PRD.md                # spec do produto (§9 = fases); leia só a seção do que estiver fazendo
  PROGRESSO.md          # log de continuidade entre sessões — fonte da verdade do estado
  design-system.md      # "Soft Professional" (indigo/emerald/amber, Plus Jakarta Sans)
  fase3/                # capability map + SPEC-<modulo>.md dos 5 módulos do ciclo atual
  decisoes/             # ADRs 0001–0005
src/
  app/                  # router, AppShell, providers, guards (RotaProtegida/RotaPublica), globals.css
  features/<slice>/     # api/ (hooks TanStack Query), components/, paginas/, schemas.ts, logica/ (regra pura testável)
                         # 12 slices: auth, onboarding, contatos, vencimentos, importacao,
                         # funis, tarefas, hoje, notificacoes, segmentos, campanhas, captura
  components/ui/        # shadcn/ui, sem regra de negócio (14 componentes)
  lib/                  # supabase, datas, formatadores BR, vocabulario, camposPersonalizados
  sw.ts                 # service worker do PWA (push + notificationclick) — tsconfig próprio
  types/database.ts     # GERADO — use npm run db:types
supabase/
  migrations/           # 23 migrations, em ordem cronológica; nunca editar uma já aplicada
  functions/            # enviar-notificacoes-push/ + _shared/ (supabaseAdmin, providers/tipos)
  tests/                # 17 arquivos pgTAP — isolamento, integridade, soft delete, por slice
  seed.sql              # duas empresas fictícias (Alfa e Beta), nenhum dado real
.claude/rules/          # regras por path: Supabase.md, Frontend.md, Mensageria.md
```

## Quando pedir ajuda

- Antes de codar uma feature nova sem spec clara: invoque `spec-driven-development`.
- Para decisões não triviais ou de alto risco (RLS, billing, operações irreversíveis): invoque `doubt-driven-development`.
- Para construir/ajustar UI: invoque `frontend-ui-engineering`; antes de criar tela nova, consulte `docs/design-system.md`.
- Se houver suspeita de regressão de performance ou N+1: invoque `performance-optimization`.
- Para revisão: invoque a skill `code-review-b2` — o checklist foi escrito para Python/Flask + Next.js; aplique o espírito (VSA, DDD, Security by Design), não a stack literal.
- Para auditoria de segurança: invoque a skill `security-check` — obrigatório ao mexer em RLS, auth, webhooks ou billing.
- Dúvida de regra de negócio: consulte a seção correspondente do `docs/PRD.md`; se não estiver lá, pergunte antes de decidir.
- Para regras determinísticas (formatação, secrets, comandos perigosos): já há hooks rodando.


## O que NÃO fazer

- Não criar nem editar arquivos `.env*` (exceto `.env.example`, sem valores) — use Supabase secrets e env vars da Vercel.
- Não usar `any` em TypeScript sem comentário justificando.
- Não fazer `git push --force` em `main`.
- Não adicionar deps sem rodar audit primeiro.
- Não editar migration já aplicada — crie uma nova.
- Não editar `src/types/database.ts` à mão.
- Não rodar comandos de banco contra projetos remotos fora de `make deploy-*`.
- Não usar bibliotecas não oficiais de WhatsApp.
- Não guardar dados pessoais de contatos em `localStorage`, URLs ou logs.
- Não inserir `atividades` do cliente — o trigger do banco já faz isso (ver "Arquitetura").
- Não escrever FK simples entre tabelas com `empresa_id` — sempre composta.
- Nunca parecer que o sistema foi criado por uma IA. 