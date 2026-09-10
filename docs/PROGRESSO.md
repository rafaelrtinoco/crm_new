# Progresso — Facility

Log de continuidade entre máquinas/sessões. Atualize a seção "Estado atual" a cada incremento entregue; não precisa reescrever o histórico abaixo dela.

## Estado atual — 2026-09-10

**Fase 1 — Fundação e núcleo, incremento 1A (schema, RLS, isolamento) implementado, não validado.**

O SQL das migrations, o seed e os testes pgTAP foram escritos e revisados, mas **nunca rodaram contra um Postgres real** — a máquina onde foram escritos tinha o Docker Desktop instalado mas com o daemon parado, então `supabase start`/`db reset` não puderam ser executados. Isso é o primeiro passo ao retomar (ver "Próximos passos imediatos" abaixo).

### O que existe

**Scaffold frontend** (`package.json`, `vite.config.ts`, `tsconfig*.json`, `eslint.config.js`, `.prettierrc.json`, `tailwind.config.ts`, `postcss.config.js`, `components.json`, `index.html`):
- Vite + React 18 + TypeScript strict + Tailwind + shadcn/ui (config pronta, nenhum componente copiado ainda) + TanStack Query + React Router + React Hook Form/Zod (deps instaladas, não usadas ainda) + `vite-plugin-pwa`.
- `src/app/` — `App.tsx`, `router.tsx` (uma rota `/` de smoke test), `providers.tsx` (QueryClient + VocabularioContext), `useTema.ts` (dark mode), `globals.css` (variáveis shadcn), `paginas/Smoke.tsx`.
- `src/lib/` — `supabase.ts` (cliente, lança erro se faltar env var), `datas.ts` (hoje no fuso, formatação BR, diferença em dias — testado), `formatadores.ts` (BRL, telefone, CEP, CPF/CNPJ com validação de dígito verificador — **14 testes em `formatadores.test.ts`, todos passando**), `vocabulario.ts` (contrato da regra "nada de nicho no código"), `utils.ts` (`cn()`).
- `src/types/database.ts` — **placeholder manual**, marcado "GERADO — não edite à mão". Precisa ser substituído por `npm run db:types` assim que o banco local estiver de pé.
- `npm run lint`, `npm run typecheck`, `npm run test` (14/14) e `npm run build` (gera PWA com service worker) — todos verificados passando nesta sessão.

**Schema Supabase** (`supabase/migrations/`, 6 arquivos, ordem cronológica no nome):
1. `..._extensoes_e_helpers.sql` — extensão `pgcrypto`, `empresas`, `empresa_membros`, e as 4 funções de isolamento (`is_membro`, `tem_papel`, `carteira_compartilhada`, `pode_acessar_responsavel`) — todas `security definer` com `search_path = ''`. Ver `docs/decisoes/0001-isolamento-multiempresa.md` para o porquê.
2. `..._plataforma.sql` — `convites`, `plataforma_admins` (sem `empresa_id` de propósito).
3. `..._nicho_templates.sql` — catálogo global de templates de nicho, somente leitura.
4. `..._nucleo.sql` — `contatos`, `campos_personalizados`, `tags`, `contato_tags`, `vencimento_tipos`, `vencimentos`, `funis`, `etapas`, `motivos_perda`, `negocios` (próximo passo obrigatório, perdido exige motivo), `atividades` (timeline append-only), `tarefas`.
5. `..._sistema.sql` — `consentimentos` (append-only), `audit_log` (append-only, `revoke update/delete` explícito).
6. `..._importacoes.sql` — `importacoes`, `importacao_erros`.

Toda tabela de dados tem RLS habilitada e política — nenhuma usa `using (true)` exceto `nicho_templates` (justificado em comentário na própria migration: dado global, sem `empresa_id` por natureza).

**Seed** (`supabase/seed.sql`): duas empresas fictícias — **Seguros Alfa** (carteira não compartilhada) e **Seguros Beta** (carteira compartilhada) — com usuários (dono/gestor/usuario), funis+etapas, tipos de vencimento, motivos de perda, tags, contatos, vencimentos espalhados no tempo, negócios em etapas variadas (um ganho, um perdido) e tarefas. Login de teste: qualquer e-mail semeado (ex.: `dono@segurosalfa.test`), senha `facility123`.

**Testes pgTAP** (`supabase/tests/`, ~55 asserções):
- `isolamento_multiempresa.sql` — para praticamente toda tabela com `empresa_id`, prova que um usuário da Alfa não lê/altera/apaga/insere dados da Beta (e vice-versa via setup). Usa `throws_ok` com SQLSTATE `42501` para os casos de INSERT bloqueado (RLS gera erro, não filtro silencioso — diferente de SELECT/UPDATE/DELETE).
- `carteira_compartilhada.sql` — papel `usuario` sem carteira compartilhada só vê o que é seu; gestor vê tudo por papel; `usuario` na empresa com carteira compartilhada vê tudo mesmo sem ser responsável.
- `plataforma_admins.sql` — isolamento por linha própria (tabela sem `empresa_id`).

**Documentação:**
- `docs/decisoes/0001-isolamento-multiempresa.md` — por que `security definer`, o padrão `pode_acessar_responsavel`, e a decisão (não confirmada pelo dono do produto) de restringir escrita de tags/funis/etapas/motivos/tipos de vencimento a gestor+.
- `docs/decisoes/0002-interface-de-comandos.md` — por que npm scripts + Makefile fino (sem `make` no Windows local).
- `CLAUDE.md` e `README.md` atualizados com o estado atual e os comandos reais.
- `Makefile` (delega para npm scripts).

### Pendências conhecidas

1. **`.env.example` não foi criado.** O `.claude/settings.json` bloqueava `Write`/`Edit` em qualquer `**/.env.*`, inclusive `.env.example` (que o `CLAUDE.md` sempre permitiu como exceção). Corrigi o `settings.json` adicionando `Write(**/.env.example)` e `Edit(**/.env.example)` ao `allow`, mas a mudança só vale a partir de uma sessão nova do Claude Code (permissões carregam uma vez no início da sessão). Se ainda não existir, crie `.env.example` na raiz com:
   ```
   # Copie para .env.local (gitignored) e preencha com os valores do seu Supabase
   # local (saída de `npm run supabase:start`) ou do projeto de staging/produção.
   # Nunca coloque a service_role aqui — ela só existe em Edge Functions.

   VITE_SUPABASE_URL=
   VITE_SUPABASE_ANON_KEY=
   ```
2. **Migrations e seed nunca rodaram.** Podem ter erro de sintaxe, ordem de dependência entre tabelas, ou algo que só aparece em `db reset`. Trate como não validado até `npm run test:db` passar.
3. **`aplicar_template()` (função que copia `nicho_templates` para as tabelas da empresa no onboarding) ainda não existe** — planejada para o incremento 1B.
4. **Decisões de produto não confirmadas** (documentadas na ADR 0001): quem pode criar/editar tags vs. funis/etapas/motivos de perda/tipos de vencimento. Hoje: tags abertas a qualquer membro; o resto restrito a gestor+. Revisável.

## Próximos passos imediatos (ao retomar, nesta ordem)

1. `git clone` (ou `pull`) o repositório na máquina nova.
2. Abrir o **Docker Desktop** — pré-requisito para tudo abaixo.
3. `npm install`.
4. Criar `.env.example` se não existir (conteúdo acima) e copiar para `.env.local`.
5. `npm run db:reset` — aplica as 6 migrations + seed do zero. Se falhar, o erro do `psql`/`supabase` aponta a migration e a linha.
6. `npm run test:db` — roda os 3 arquivos pgTAP. **Isso é o portão de aceite do incremento 1A** — só considerar 1A pronto se tudo passar.
7. `npm run db:types` — gera `src/types/database.ts` de verdade, substituindo o placeholder.
8. Preencher `.env.local` com a saída de `npm run supabase:start` (API URL e anon key locais) para o frontend conseguir falar com o banco.
9. `npm run dev` — confirma a rota `/` carregando com Supabase local no ar.
10. Só depois disso, seguir para o incremento **1B**.

## Roteiro dos incrementos da Fase 1

(Como planejado originalmente; 1B–1D ainda não foram detalhados em plano de execução — fazer isso ao chegar em cada um.)

- **1A — fundação** (este documento): schema, RLS, isolamento. Implementado, pendente de validação.
- **1B — entrada:** auth Supabase, convites, onboarding com `aplicar_template()`, checklist "Primeiros passos".
- **1C — núcleo de dados:** contatos com timeline, vencimentos com recorrência, importação guiada de planilha com deduplicação.
- **1D — operação:** funis kanban (dnd-kit) com próximo passo obrigatório, tarefas, tela "Hoje", PWA completo com push.
