# Facility

CRM SaaS multiempresa de relacionamento, focado em leads, funil de vendas, vencimentos com lembretes automáticos, follow-up e campanhas.

**Nicho de lançamento:** corretores de seguros (seguros, planos de saúde, odonto, consórcio). O modelo é genérico por arquitetura — outros negócios administrativos (contabilidade, imobiliária, despachante) entram só com configuração, nunca com código específico de nicho.

**O que o Facility não é:** sistema de gestão de apólices, financeiro, comissões, sinistros, cotação ou emissão. Ele convive com os sistemas que o cliente já usa, recebendo a carteira por importação de planilha.

## Estado atual

**Fase 1 — Fundação e núcleo** (ver `docs/PRD.md` seção 9): **1A, 1B e 1C completos** (schema/RLS; auth/onboarding/convites; contatos, vencimentos e importação de planilha) — 1A/1B/1C-1/1C-2 validados no navegador, **1C-3 (Importação)** concluído com 82 testes pgTAP + 25 Vitest, teste no navegador pendente. Do **1D** (funis, tarefas, tela "Hoje", PWA completo e layout geral da plataforma): **1D-1 (layout)**, **1D-2 (Funis de venda)** e a identidade visual (plugin `ui-ux-pro-max`, Calistoga + Inter, paleta teal/laranja) implementados e validados no navegador. **1D-3 (Tarefas)** implementado, teste no navegador pendente. Faltam 1D-4 (tela "Hoje") e 1D-5 (PWA completo com push).

## Stack

- **Backend:** Supabase — Postgres + RLS, Auth, Storage, Edge Functions (Deno), pg_cron, filas (pgmq), Realtime
- **Frontend:** React + Vite + TypeScript strict, Tailwind + shadcn/ui, TanStack Query, React Hook Form + Zod, React Router, PWA
- **Infra:** Vercel (frontend) + projetos Supabase separados para local, staging e produção

## Documentação

| Onde | O que tem |
|---|---|
| `CLAUDE.md` | Contexto do projeto para o Claude Code: stack, comandos, regras de ouro e convenções. |
| `docs/PRD.md` | Especificação completa do produto, por módulo e por fase de entrega. |
| `.claude/rules/` | Regras por área (Supabase/RLS, frontend, mensageria), carregadas sob demanda. |
| `docs/starter-pack.md` | Documentação do [Claude Code Starter Pack — B2 Tech](https://github.com/brunobracaioli/claude-code-starter-pack) que serve de base de hooks, skills e permissões deste repositório. |
| `docs/PROGRESSO.md` | Log de continuidade: o que já foi feito, pendências e os próximos passos exatos para retomar em outra máquina. |

## Créditos

A configuração de Claude Code deste repositório (hooks, skills, permissões, `.claude-plugin/`) parte do **Claude Code Starter Pack — B2 Tech Edition**, de [Bruno Bracaioli](https://b2tech.io), licenciado em MIT.
