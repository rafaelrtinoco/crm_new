<!--
Lido pelo Claude Code no início de toda sessão. Mantenha curto (< 200 linhas) e humano.
Regras determinísticas: .claude/settings.json e hooks.
Regras por área (carregam só ao mexer nos arquivos): .claude/rules/.
Procedimentos sob demanda: .claude/skills/.
Comentários HTML como este não entram no contexto do Claude.
-->

# Facility — CRM SaaS de relacionamento

CRM multiempresa para corretores de seguros (nicho de lançamento) e, depois, outros negócios do ramo administrativo. Foco: leads, funil, vencimentos com lembretes automáticos, follow-up e campanhas. **Não** é sistema de gestão de apólices, financeiro ou comissões.

> **Estado atual:** Fase 1C completa — 1A (fundação), 1B (auth/onboarding/convites), 1C-1 (Contatos), 1C-2 (Vencimentos) e 1C-3 (Importação) implementados; 1C-1/1C-2 testados no navegador, 1C-3 ainda pendente de teste no navegador. **1D-1 (layout)**, **1D-2 (Funis de venda)**, a **identidade visual (`ui-ux-pro-max`)**, **1D-3 (Tarefas)** e **1D-4 (Tela "Hoje")** implementados e validados no navegador. **Correções de layout pós-1D-4** (duas rodadas) e **1D-5 (Notificações — central no app + push)** implementados — 102/102 pgTAP, lint/typecheck/test/build limpos, teste no navegador pendente (1D-5 precisa das chaves VAPID em `.env.local`/`supabase/functions/.env` primeiro — ver `docs/PROGRESSO.md`). **1D inteiro fechado — e a Fase 1 inteira.** Redesenho arquitetural do núcleo (integridade multiempresa por FK composta) e retrabalho visual completo ("Soft Professional" — paleta indigo/emerald/amber, Plus Jakarta Sans) concluídos em seguida, com relógio/calendário na topbar. **Fase 2 (WhatsApp) adiada por decisão do usuário** — próximo ciclo é uma **Fase 3 recortada** (sem campanhas por WhatsApp nem Meta Lead Ads, dados de captura manuais/webhook genérico por enquanto). Detalhe: `docs/decisoes/0004-fase2-adiada-fase3-sem-integracoes-externas.md`. **Planejamento (Specify) da Fase 3 recortada completo** — capability map + 5 specs de módulo em `docs/fase3/` (`fila-envios`, `segmentos`, `captura-leads`, `campanhas`, `relatorios-origem`); ver `docs/decisoes/0005-fila-envios-worker-em-postgres.md` pra uma decisão de arquitetura que sai desse planejamento. **Módulo 1/5 (`fila-envios`) implementado** — 192/192 pgTAP, lint/typecheck/test/build limpos, teste no navegador da fatia extra de consentimento pendente. **Módulo 2/5 (`segmentos`) implementado e validado no navegador** — 203/203 pgTAP, lint/typecheck/test/build limpos, `security-check` sem bloqueadores; `campanhas` (módulo 4/5) já tem as duas dependências prontas. Detalhes: `docs/PROGRESSO.md`. **Pendência de lançamento:** `auth.email.enable_confirmations` precisa virar `true` antes de qualquer Supabase de staging/produção. Detalhes: `docs/PROGRESSO.md`.

- **Especificação:** `docs/PRD.md` — leia apenas a seção do que estiver implementando.
- **Fase atual: 1 — Fundação e núcleo.** Não implemente nada de fases futuras sem eu pedir.
- **Decisões de arquitetura:** `docs/decisoes/NNNN-titulo.md` (ADR curta, uma por arquivo).
- **Sobre este repositório:** o `README.md` documenta o produto; a documentação original do starter pack (hooks, skills, permissões) está em `docs/starter-pack.md`.

## Stack

- **Backend:** Supabase — Postgres + RLS, Auth, Storage, Edge Functions (Deno), pg_cron, filas (pgmq), Realtime
- **Frontend:** React + Vite + TypeScript strict, Tailwind + shadcn/ui, TanStack Query, React Hook Form + Zod, React Router, PWA
- **Infra:** Vercel (frontend) + projetos Supabase separados para local, staging e produção
- **Padrão:** SaaS multiempresa; vertical slices em `src/features/<slice>`

## Comandos essenciais

`npm run <script>` é a fonte da verdade (funciona em qualquer máquina com Node); `make <alvo>` é um atalho fino que delega para o mesmo script — ver `docs/decisoes/0002-interface-de-comandos.md`. `dev`, `db-reset`, `db-types` e `test-db` exigem o Docker Desktop aberto.

```bash
# Setup
npm install              # make install
npm run dev               # make dev — sobe Supabase local + Vite juntos (precisa do Docker aberto)
npm run functions         # make functions — Edge Functions locais

# Banco
npm run db:migration -- <nome>   # make migration name=<nome>
npm run db:reset          # make db-reset — recria o banco LOCAL (migrations + seed)
npm run db:types          # make db-types — regenera src/types/database.ts

# Qualidade
npm run lint               # make lint
npm run typecheck          # make typecheck
npm run test                # make test — vitest
npm run test:db             # make test-db — pgTAP: RLS e isolamento entre empresas

# Rodar um teste único
npx vitest run <arquivo>              # um arquivo de teste
npx vitest run -t "<nome do teste>"   # um teste pelo nome
npx supabase test db --file supabase/tests/<arquivo>.sql   # um pgTAP

# Deploy — ainda não configurado (entra quando houver staging/produção)
make deploy-staging
make deploy-prod
```

## Regras de ouro

- **Isolamento entre empresas é inegociável.** Toda tabela de dados tem `empresa_id` e RLS. Tabela nova só está pronta com política RLS e teste pgTAP de isolamento.
- **Nada de nicho no código.** Rótulos, campos, funis, tipos de vencimento e mensagens vêm do template da empresa. Nunca escreva "apólice", "segurado" ou "corretor" em componente — use `useVocabulario()`.
- **Datas de calendário são `date`.** Vencimento e aniversário não são `timestamptz`. Régua e "hoje" são calculados no fuso da empresa, nunca no do servidor ou do navegador.
- **Toda mensagem sai pela fila de envios.** Consentimento, opt-out, horário comercial, janela de 24h e limite do plano são checados em um único lugar.
- **Integrações só via providers** em `supabase/functions/_shared/providers/`. Em dev e testes, o mock é o padrão.
- **`service_role` só em Edge Functions**, com filtro explícito de `empresa_id` em toda query.

## Convenções

- **Branches:** `feat/<slice>-<short-desc>`, `fix/<short-desc>`, `chore/<short-desc>`
  - Slices: `onboarding`, `contatos`, `vencimentos`, `funis`, `tarefas`, `hoje`, `whatsapp`, `automacoes`, `campanhas`, `captura`, `billing`, `admin`
- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`), descrição em português
- **PRs:** Sempre referencie a issue, descreva o "porquê", não só o "o quê"
- **Tests:** TDD onde a complexidade pede; testes lêem como spec. Obrigatório em: cálculo de réguas e recorrência, regras da fila de envios e isolamento RLS
- **Idioma:** UI em pt-BR. Nomes de domínio em português, espelhando o banco (`contatos`, `Vencimento`, `useNegocios`); termos técnicos genéricos em inglês (`utils`, `hooks`, `components`)

## Estrutura

```
docs/
  PRD.md
  decisoes/
src/
  app/                  # rotas, layouts, providers globais, guards (RotaProtegida/RotaPublica)
  features/<slice>/     # api/ (hooks TanStack Query), components/, schemas.ts, páginas — existe: auth, onboarding, contatos, vencimentos, importacao
  components/ui/        # shadcn/ui — existe: button, input, label, card, select, checkbox
  lib/                  # cliente supabase, datas, formatadores BR, vocabulário
  types/database.ts     # GERADO — use npm run db:types
supabase/
  migrations/           # 10 migrations (1A: fundação; 1B: onboarding; 1C-1: ultimo_contato_em; 1C-2: renovar_vencimento; 1C-3: importacao_erros insert)
  functions/_shared/    # providers, fila de envios, validação — chega na Fase 2 (WhatsApp)
  tests/                # pgTAP — isolamento multiempresa, carteira compartilhada, plataforma_admins, onboarding, contatos, vencimentos, importacao
  seed.sql              # duas empresas fictícias (Alfa e Beta), nenhum dado real
tests/e2e/              # smoke tests — ainda não existe
```

## Quando pedir ajuda

- Antes de codar uma feature nova sem spec clara: invoque `spec-driven-development`.
- Para decisões não triviais ou de alto risco (RLS, billing, operações irreversíveis): invoque `doubt-driven-development`.
- Para construir/ajustar UI: invoque `frontend-ui-engineering`.
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
- Nunca parecer que o sistema foi criado por uma IA. 