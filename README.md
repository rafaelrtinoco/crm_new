# Facility

CRM SaaS multiempresa de relacionamento, focado em leads, funil de vendas, vencimentos com lembretes automáticos, follow-up e campanhas.

**Nicho de lançamento:** corretores de seguros (seguros, planos de saúde, odonto, consórcio). O modelo é genérico por arquitetura — outros negócios administrativos (contabilidade, imobiliária, despachante) entram só com configuração, nunca com código específico de nicho.

**O que o Facility não é:** sistema de gestão de apólices, financeiro, comissões, sinistros, cotação ou emissão. Ele convive com os sistemas que o cliente já usa, recebendo a carteira por importação de planilha.

## Estado atual

**Fase 1 fechada.** Ciclo atual: **Fase 3 recortada** (5 módulos especificados em `docs/fase3/`). Fase 2 (WhatsApp e réguas) foi adiada — ver `docs/decisoes/0004-fase2-adiada-fase3-sem-integracoes-externas.md`. Estado exato do ciclo (módulo entregue, pendências, próximo passo) vive em `docs/PROGRESSO.md` — é lá que se atualiza a cada incremento, não aqui.

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
