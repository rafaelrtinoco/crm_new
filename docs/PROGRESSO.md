# Progresso — Facility

Log de continuidade entre máquinas/sessões. Atualize a seção "Estado atual" a cada incremento entregue; não precisa reescrever o histórico abaixo dela.

## Estado atual — 2026-09-14

**Fase 1 — Fundação e núcleo, incremento 1B (entrada: auth, onboarding, convites) implementado e validado, inclusive no navegador pelo usuário.** 72/72 asserções pgTAP (51 do 1A + 21 novas), fluxo real via `curl` contra a API do Supabase local, e teste manual no navegador confirmando cadastro → criar empresa → convidar → aceitar convite funcionando de ponta a ponta.

Três bugs de UX encontrados e corrigidos durante o teste manual (não pegos pelos testes automatizados, que não cobrem navegação/React Query):
- Mensagem de erro genérica em `AceitarConvite.tsx` escondia a causa real (token inválido vs. e-mail errado vs. expirado) — agora mostra a mensagem específica que `aceitar_convite()` devolve.
- Não havia botão de logout em lugar nenhum — impossível voltar pra `/entrar`/`/cadastro` depois de logado. Adicionado em `RotaProtegida.tsx` (cabeçalho, aparece em toda rota autenticada).
- Convite pendente não podia ser recuperado nem cancelado depois que o link sumia da tela (ex.: após dar refresh) — `Convidar.tsx` ganhou "Copiar link" e "Cancelar" por convite.
- Corrida de dados: mutações de `useCriarEmpresa`/`useAceitarConvite` invalidavam a query de empresas sem aguardar (`void queryClient.invalidateQueries(...)`), então `navigate()` acontecia antes da lista atualizar e a tela seguinte via "0 empresas" por um instante. Corrigido pra aguardar a invalidação antes de resolver a mutação.
- `Cadastro.tsx` ignorava de onde o usuário veio e sempre mandava pra `/onboarding` — quem clicava "Criar conta" a partir de um link de convite perdia o convite e acabava criando a própria empresa por engano. Agora preserva `location.state.de`, igual o `Entrar.tsx` já fazia.

**Achado de segurança a resolver antes de qualquer ambiente real** (skill `security-check`, rodada nesta sessão): `aceitar_convite` confia em `auth.email()`, que só é confiável se o Supabase Auth exigir confirmação de e-mail. Localmente `enable_confirmations = false` (de propósito, pra agilizar dev) — em produção isso **precisa** virar `true`, senão qualquer pessoa pode se cadastrar com um e-mail que não é dela e resgatar convites endereçados a esse e-mail. Ver "Pré-requisitos de lançamento" abaixo.

<details>
<summary>Histórico — validação do 1A (2026-09-11)</summary>

`npm run db:reset` aplica as 6 migrations + seed sem erro; `npm run test:db` passou com as 51 asserções pgTAP (0 falhas); `npm run lint`, `npm run typecheck` e `npm run test` (14/14) passaram com `src/types/database.ts` gerado de verdade.

A primeira rodada contra Postgres real encontrou 2 bugs reais, já corrigidos:
- **`seed.sql`**: um `update` de backfill de `created_by` também sobrescrevia `responsavel_id` de todos os contatos da empresa Alfa, quebrando o teste de carteira compartilhada (Carla via 0 contatos em vez de 3). Corrigido para só tocar `created_by`.
- **`supabase/tests/*.sql`**: os testes usavam `is(...)` sem o `select` na frente (erro de sintaxe) e o padrão `(update ... returning id) x` como subquery em `FROM`, que o Postgres não aceita — uma CTE que modifica dados (`update`/`delete ... returning`) só pode estar no nível raiz da instrução. Também corrigido um teste que esperava exceção (`throws_ok`, SQLSTATE `42501`) num `update` de `nicho_templates` que na verdade é bloqueado silenciosamente (0 linhas afetadas) por não ter nenhuma policy de `update`.

</details>

### Pré-requisitos de lançamento (não é dev local — bloqueia qualquer ambiente real)

1. **`supabase/config.toml` → `auth.email.enable_confirmations` precisa ser `true`** no projeto Supabase de staging/produção (o `false` local é intencional, só pra dev). Sem isso, `aceitar_convite` (que compara `auth.email()` com `convites.email`) pode ser contornado por alguém que se cadastra com um e-mail que não possui. Achado 🟠 ALTO do `security-check` em 2026-09-14 — ver detalhes no relatório da sessão (não persistido em arquivo, só no chat; resumo fica aqui).

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

**1B — schema** (`supabase/migrations/20260914132658_onboarding.sql`):
- `perfis` — 1:1 com `auth.users` (nome/telefone do cadastro, que não têm onde morar em `auth.users`). Populada por trigger `criar_perfil()` em `auth.users after insert`. RLS: vê o próprio perfil sempre; vê perfil de quem compartilha empresa.
- `aplicar_template(empresa_id, nicho)` — copia `nicho_templates` (vencimento_tipos, funis+etapas, motivos_perda, tags, vocabulário) pra dentro da empresa. Não idempotente (nota MÉDIA do security-check — ver acima).
- `criar_empresa_com_onboarding(nome, nicho, aceite_termos)` — bootstrap: cria empresa, vira dono, aplica template, registra aceite de termos em `audit_log`. `security definer`, só cria empresa nova (nunca aceita `empresa_id` existente).
- `aceitar_convite(token)` — valida token/expiração/e-mail, cria `empresa_membros`, marca convite como aceito. `security definer`.
- `nicho_templates.funis` (seed) populado com os funis "Venda nova" (7 etapas) e "Renovação" (5 etapas) do PRD §3.3 — antes estava vazio.
- `supabase/config.toml`: `auth.site_url`/`additional_redirect_urls` corrigidos de `:3000` pra `:5173` (porta real do Vite).

**1B — frontend:**
- `src/components/ui/` — primeiros componentes shadcn/ui do projeto (`button`, `input`, `label`, `card`, `select`, `checkbox`), escritos à mão porque o `npx shadcn add` travou numa confirmação interativa (não roda bem via shell não-interativo).
- `src/features/auth/` — `AuthProvider`/`useAuth()` (sessão via `supabase.auth.onAuthStateChange`), telas `Entrar`/`Cadastro` (e-mail+senha, RHF+Zod).
- `src/features/onboarding/` — `useEmpresas`/`useEmpresaAtual` (lista + seleção persistida em `localStorage`, só o UUID), `useCriarEmpresa`/`useAceitarConvite`/`useConvites`/`useCriarConvite` (chamam as funções RPC acima), telas `CriarEmpresa`/`Convidar`/`AceitarConvite`.
- `src/app/RotaProtegida.tsx`/`RotaPublica.tsx` — guards client-side (só UX; a RLS é quem protege de verdade), `paginas/Inicio.tsx` (placeholder pós-login, some no 1D), `paginas/Termos.tsx`/`Privacidade.tsx` (texto legal pendente — PRD §5.4 marca como "fornecido pelo dono do produto", não inventei conteúdo).
- `providers.tsx` ganhou `AuthProvider` e um `VocabularioProvider` que resolve o vocabulário da empresa atual (`src/lib/vocabulario.ts` ganhou `mesclarVocabulario()`).
- `src/app/paginas/Smoke.tsx` removida — substituída pela rota `/` de verdade (`Inicio.tsx`).

### Pendências conhecidas

1. **`.env.example` ainda não existe.** Mesmo motivo da sessão anterior (deny de `.claude/settings.json` bloqueia `Write`/`Edit` em `**/.env.*`, sem distinguir `.env.example`). `.env.local` já foi criado manualmente pelo usuário com os valores do Supabase local (confirmado no chat, não verificável por mim — leitura de `.env.local` também é negada pela mesma regra). Conteúdo do `.env.example` que falta criar:
   ```
   # .env.example (raiz, sem valores, vai pro git)
   # Copie para .env.local (gitignored) e preencha com os valores do seu Supabase
   # local (saída de `npm run supabase:start`) ou do projeto de staging/produção.
   # Nunca coloque a service_role aqui — ela só existe em Edge Functions.

   VITE_SUPABASE_URL=
   VITE_SUPABASE_ANON_KEY=
   ```
2. **Decisões de produto não confirmadas** (documentadas na ADR 0001): quem pode criar/editar tags vs. funis/etapas/motivos de perda/tipos de vencimento. Hoje: tags abertas a qualquer membro; o resto restrito a gestor+. Revisável.
3. **Trial de 14 dias é placeholder** (`criar_empresa_com_onboarding`) — PRD §7 não define a duração real (`[PREENCHER]`).
4. **`Convidar.tsx` gera o link mas não envia e-mail** — decisão tomada na sessão do 1B (entrega manual, sem Edge Function de e-mail). Revisar quando a infra de mensageria (Fase 2) existir.

## Próximos passos imediatos (ao retomar, nesta ordem)

1. `git clone` (ou `pull`) o repositório na máquina nova.
2. Abrir o **Docker Desktop** — pré-requisito para tudo abaixo.
3. `npm install`.
4. Criar `.env.example` (conteúdo acima) e `.env.local` (mesmo formato, com valores reais — rode `npm run supabase:start` e use a `API_URL`/`ANON_KEY` que ele imprimir).
5. `npm run db:reset` — aplica as 7 migrations + seed do zero.
6. `npm run test:db` — roda os 4 arquivos pgTAP (72 asserções). **Portão de aceite.**
7. `npm run db:types` — regenera `src/types/database.ts` (já commitado, mas regenere se mudar alguma migration).
8. `npm run dev` — testar no navegador o fluxo completo: cadastro → aceitar termos → criar empresa → convidar → aceitar convite em aba anônima.
9. Resolver a pendência de lançamento (`enable_confirmations`) **antes** de criar qualquer projeto Supabase de staging/produção.
10. Só depois disso, seguir para o incremento **1C** (contatos, vencimentos, importação de planilha).

## Roteiro dos incrementos da Fase 1

(Como planejado originalmente; 1B–1D ainda não foram detalhados em plano de execução — fazer isso ao chegar em cada um.)

- **1A — fundação** (este documento): schema, RLS, isolamento. Implementado e validado (51/51 pgTAP).
- **1B — entrada:** auth Supabase (e-mail+senha), onboarding com `criar_empresa_com_onboarding()`/`aplicar_template()`, convites (link manual). Implementado e validado (72/72 pgTAP + fluxo real via curl). Checklist "Primeiros passos" **adiado pro 1D** de propósito (decisão tomada com o usuário — a maioria dos itens depende de telas que só existem em 1C/1D).
- **1C — núcleo de dados:** contatos com timeline, vencimentos com recorrência, importação guiada de planilha com deduplicação.
- **1D — operação:** funis kanban (dnd-kit) com próximo passo obrigatório, tarefas, tela "Hoje" (com o checklist "Primeiros passos" completo), PWA completo com push.
