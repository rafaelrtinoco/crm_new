# Progresso — Facility

Log de continuidade entre máquinas/sessões. Atualize a seção "Estado atual" a cada incremento entregue; não precisa reescrever o histórico abaixo dela.

## Estado atual — 2026-09-11

**Fase 1 — Fundação e núcleo, incremento 1A (schema, RLS, isolamento) implementado e validado.** `npm run db:reset` aplica as 6 migrations + seed sem erro; `npm run test:db` passa com as 51 asserções pgTAP (0 falhas); `npm run lint`, `npm run typecheck` e `npm run test` (14/14) passam com `src/types/database.ts` gerado de verdade (não é mais o placeholder).

A primeira rodada contra Postgres real encontrou 2 bugs reais, já corrigidos:
- **`seed.sql`**: um `update` de backfill de `created_by` também sobrescrevia `responsavel_id` de todos os contatos da empresa Alfa, quebrando o teste de carteira compartilhada (Carla via 0 contatos em vez de 3). Corrigido para só tocar `created_by`.
- **`supabase/tests/*.sql`**: os testes usavam `is(...)` sem o `select` na frente (erro de sintaxe) e o padrão `(update ... returning id) x` como subquery em `FROM`, que o Postgres não aceita — uma CTE que modifica dados (`update`/`delete ... returning`) só pode estar no nível raiz da instrução (`with x as (update ...) select is((select count(*) from x), ...)`), nunca aninhada dentro do argumento de outra função. Também corrigido um teste que esperava exceção (`throws_ok`, SQLSTATE `42501`) num `update` de `nicho_templates` que na verdade é bloqueado silenciosamente (0 linhas afetadas) por não ter nenhuma policy de `update` — `throws_ok` só é o comportamento certo quando há `revoke` explícito no nível de GRANT (caso do `audit_log`) ou em `insert` bloqueado por `with check`.

### O que existe

**Scaffold frontend** (`package.json`, `vite.config.ts`, `tsconfig*.json`, `eslint.config.js`, `.prettierrc.json`, `tailwind.config.ts`, `postcss.config.js`, `components.json`, `index.html`):
- Vite + React 18 + TypeScript strict + Tailwind + shadcn/ui (config pronta, nenhum componente copiado ainda) + TanStack Query + React Router + React Hook Form/Zod (deps instaladas, não usadas ainda) + `vite-plugin-pwa`.
- `src/app/` — `App.tsx`, `router.tsx` (uma rota `/` de smoke test), `providers.tsx` (QueryClient + VocabularioContext), `useTema.ts` (dark mode), `globals.css` (variáveis shadcn), `paginas/Smoke.tsx`.
- `src/lib/` — `supabase.ts` (cliente, lança erro se faltar env var), `datas.ts` (hoje no fuso, formatação BR, diferença em dias — testado), `formatadores.ts` (BRL, telefone, CEP, CPF/CNPJ com validação de dígito verificador — **14 testes em `formatadores.test.ts`, todos passando**), `vocabulario.ts` (contrato da regra "nada de nicho no código"), `utils.ts` (`cn()`).
- `src/types/database.ts` — **gerado de verdade** via `npm run db:types` (1306 linhas, todas as tabelas do 1A). Não editar à mão.
- `npm run lint`, `npm run typecheck`, `npm run test` (14/14) e `npm run build` (gera PWA com service worker) — todos verificados passando com o schema real.

**Schema Supabase** (`supabase/migrations/`, 6 arquivos, ordem cronológica no nome):
1. `..._extensoes_e_helpers.sql` — extensão `pgcrypto`, `empresas`, `empresa_membros`, e as 4 funções de isolamento (`is_membro`, `tem_papel`, `carteira_compartilhada`, `pode_acessar_responsavel`) — todas `security definer` com `search_path = ''`. Ver `docs/decisoes/0001-isolamento-multiempresa.md` para o porquê.
2. `..._plataforma.sql` — `convites`, `plataforma_admins` (sem `empresa_id` de propósito).
3. `..._nicho_templates.sql` — catálogo global de templates de nicho, somente leitura.
4. `..._nucleo.sql` — `contatos`, `campos_personalizados`, `tags`, `contato_tags`, `vencimento_tipos`, `vencimentos`, `funis`, `etapas`, `motivos_perda`, `negocios` (próximo passo obrigatório, perdido exige motivo), `atividades` (timeline append-only), `tarefas`.
5. `..._sistema.sql` — `consentimentos` (append-only), `audit_log` (append-only, `revoke update/delete` explícito).
6. `..._importacoes.sql` — `importacoes`, `importacao_erros`.

Toda tabela de dados tem RLS habilitada e política — nenhuma usa `using (true)` exceto `nicho_templates` (justificado em comentário na própria migration: dado global, sem `empresa_id` por natureza).

**Seed** (`supabase/seed.sql`): duas empresas fictícias — **Seguros Alfa** (carteira não compartilhada) e **Seguros Beta** (carteira compartilhada) — com usuários (dono/gestor/usuario), funis+etapas, tipos de vencimento, motivos de perda, tags, contatos, vencimentos espalhados no tempo, negócios em etapas variadas (um ganho, um perdido) e tarefas. Login de teste: qualquer e-mail semeado (ex.: `dono@segurosalfa.test`), senha `facility123`.

**Testes pgTAP** (`supabase/tests/`, 51 asserções, todas passando):
- `isolamento_multiempresa.sql` (43 asserções) — para praticamente toda tabela com `empresa_id`, prova que um usuário da Alfa não lê/altera/apaga/insere dados da Beta (e vice-versa via setup). Usa `throws_ok` com SQLSTATE `42501` só para INSERT bloqueado por `with check` e para `update`/`delete` em tabela com `revoke` explícito (`audit_log`); as demais checagens de `update`/`delete` verificam `0` linhas afetadas via CTE no nível raiz.
- `carteira_compartilhada.sql` (5 asserções) — papel `usuario` sem carteira compartilhada só vê o que é seu; gestor vê tudo por papel; `usuario` na empresa com carteira compartilhada vê tudo mesmo sem ser responsável.
- `plataforma_admins.sql` (3 asserções) — isolamento por linha própria (tabela sem `empresa_id`).

**Documentação:**
- `docs/decisoes/0001-isolamento-multiempresa.md` — por que `security definer`, o padrão `pode_acessar_responsavel`, e a decisão (não confirmada pelo dono do produto) de restringir escrita de tags/funis/etapas/motivos/tipos de vencimento a gestor+.
- `docs/decisoes/0002-interface-de-comandos.md` — por que npm scripts + Makefile fino (sem `make` no Windows local).
- `CLAUDE.md` e `README.md` atualizados com o estado atual e os comandos reais.
- `Makefile` (delega para npm scripts).

### Pendências conhecidas

1. **`.env.example` e `.env.local` ainda não existem no repo/máquina.** O `.claude/settings.json` bloqueia `Write`/`Edit` em qualquer `**/.env.*` — o `deny` sempre vence sobre `allow` neste harness (não é sobre especificidade de glob), então uma exceção só pra `.env.example` exige reescrever o `deny` de um jeito que não afrouxe proteção de outros arquivos (`.env.production`, `.env.staging`) sem essa decisão ser explicitamente sua. Ficou combinado que você cria os dois arquivos manualmente. Conteúdo:
   ```
   # .env.example (raiz, sem valores, vai pro git)
   # Copie para .env.local (gitignored) e preencha com os valores do seu Supabase
   # local (saída de `npm run supabase:start`) ou do projeto de staging/produção.
   # Nunca coloque a service_role aqui — ela só existe em Edge Functions.

   VITE_SUPABASE_URL=
   VITE_SUPABASE_ANON_KEY=
   ```
   ```
   # .env.local (raiz, gitignored, valores do supabase local desta sessão)
   VITE_SUPABASE_URL=http://127.0.0.1:54321
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
   ```
   A `ANON_KEY` acima é a chave de demo fixa que o Supabase CLI sempre usa em ambiente local (não muda entre `db reset`) — só muda se você rodar `supabase start` numa porta/projeto diferente, caso em que a saída do próprio comando traz a chave certa.
2. **`npm run dev` de ponta a ponta ainda não foi confirmado nesta sessão** — depende do item 1. Depois de criar os `.env*`, rodar `npm run dev` e conferir a rota `/`.
3. **`aplicar_template()` (função que copia `nicho_templates` para as tabelas da empresa no onboarding) ainda não existe** — planejada para o incremento 1B.
4. **Decisões de produto não confirmadas** (documentadas na ADR 0001): quem pode criar/editar tags vs. funis/etapas/motivos de perda/tipos de vencimento. Hoje: tags abertas a qualquer membro; o resto restrito a gestor+. Revisável.

## Próximos passos imediatos (ao retomar, nesta ordem)

1. `git clone` (ou `pull`) o repositório na máquina nova.
2. Abrir o **Docker Desktop** — pré-requisito para tudo abaixo.
3. `npm install`.
4. Criar `.env.example` e `.env.local` manualmente (conteúdo na seção "Pendências conhecidas" acima — se já tiver rodado `supabase start` na máquina nova, use a `ANON_KEY` que ele imprimir).
5. `npm run db:reset` — aplica as 6 migrations + seed do zero.
6. `npm run test:db` — roda os 3 arquivos pgTAP (51 asserções). **Isso é o portão de aceite do incremento 1A.**
7. `npm run db:types` — regenera `src/types/database.ts` (já commitado, mas regenere se mudar alguma migration).
8. `npm run dev` — confirma a rota `/` carregando com Supabase local no ar.
9. Só depois disso, seguir para o incremento **1B**.

## Roteiro dos incrementos da Fase 1

(Como planejado originalmente; 1B–1D ainda não foram detalhados em plano de execução — fazer isso ao chegar em cada um.)

- **1A — fundação** (este documento): schema, RLS, isolamento. Implementado e validado (51/51 pgTAP).
- **1B — entrada:** auth Supabase, convites, onboarding com `aplicar_template()`, checklist "Primeiros passos".
- **1C — núcleo de dados:** contatos com timeline, vencimentos com recorrência, importação guiada de planilha com deduplicação.
- **1D — operação:** funis kanban (dnd-kit) com próximo passo obrigatório, tarefas, tela "Hoje", PWA completo com push.
