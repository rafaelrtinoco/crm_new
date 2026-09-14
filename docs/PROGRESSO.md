# Progresso — Facility

Log de continuidade entre máquinas/sessões. Atualize a seção "Estado atual" a cada incremento entregue; não precisa reescrever o histórico abaixo dela.

## Estado atual — 2026-09-14

**Fase 1 — Fundação e núcleo. 1D-4 (Tela "Hoje") implementado — fecha o conteúdo do 1D, só falta o 1D-5 (PWA completo).** Sem migration — tudo leitura sobre tabelas/policies que já existiam. `lint`/`typecheck`/`test` (25/25)/`build`/`npm audit` limpos. **Ainda não testado no navegador nesta sessão** — próximo passo ao retomar.

**Escopo (PRD §6.2), recortado pro que dá pra construir na Fase 1** — decisão tomada com o usuário sobre o checklist "Primeiros passos": só os 3 itens viáveis agora (importar contatos, cadastrar vencimento, convidar equipe); "conectar WhatsApp" e "ativar régua" ficam fora até a Fase 2 existir, pra não ter uma barra que nunca fecha 100% por falta de feature. `src/app/paginas/Inicio.tsx` (rota `/`, item "Início" na nav) deixou de ser placeholder: barra de progresso "Primeiros passos" (some quando completa) + seções de ação por prioridade (leads sem primeiro contato, follow-ups de hoje/atrasados via `ItemTarefa` do 1D-3, negócios com próximo passo vencido — cruzando todos os funis, vencimentos vencendo/atrasados, aniversariantes do dia) + 4 cards de resumo (leads na semana, negócios abertos, vencimentos em 30 dias, taxa de renovação do mês). Seção vazia simplesmente não aparece; estado "nada pendente" tem mensagem própria em vez de tela em branco.

Fora de escopo, de propósito: clientes que responderam a lembrete (precisa de inbox WhatsApp, Fase 2); clientes esfriando (o próprio PRD marca como Fase 5); notificação push de resumo diário (PRD §6.8, é o 1D-5).

**Callback do 1D-3:** a lista de follow-ups da tela "Hoje" reusa `ItemTarefa`/`DialogoTarefa` direto — a UX de concluir/editar/excluir tarefa é a mesma da lista dedicada em `/tarefas`.

<details>
<summary>Histórico — 1D-3: Tarefas (2026-09-14)</summary>

Sem migration — a tabela `tarefas` já existia desde o 1A (RLS e isolamento já cobertos), então essa fatia foi puramente frontend. CRUD de tarefas (tipo, título, data, responsável, vínculo opcional com contato **ou** negócio) + concluir/reabrir, com destaque de atraso (mesmo `--urgencia`/`hojeNoFuso()` já usados em Funis). Sem página de detalhe própria — tarefa é leve o bastante pra ser criada/editada num diálogo (`DialogoTarefa`, mesmo padrão de `DialogoRenovacao`/`DialogoPerda`). Validado no navegador pelo usuário.

O `marcar_negocio_perdido` (1D-2) já criava a tarefa de reativação desde o incremento anterior, mas nada exibia isso em lugar nenhum — a aba "Tarefas" em `DetalheNegocio.tsx` é onde essa tarefa finalmente aparece pra alguém.

</details>

<details>
<summary>Histórico — 1D-2: Funis de venda + retrabalho visual ui-ux-pro-max (2026-09-14)</summary>

**Funis:** validado no navegador pelo usuário (quadro, arrastar card, ganho/perdido, alternância quadro/lista). Schema: trigger `atualizar_entrou_na_etapa()` (reseta a coluna quando `etapa_id` muda — PRD §6.5) + RPCs `marcar_negocio_ganho`/`marcar_negocio_perdido` (`security invoker`, mesmo raciocínio do `renovar_vencimento` do 1C-2). `hojeNoFuso(fuso)` existia desde o 1A e nunca tinha sido usado — `useEmpresas()` ganhou o campo `fuso`.

Bug de teste pgTAP pego antes de fechar (não é bug de produção): a primeira versão de `funis.sql` simulava a corretora Carla (papel `usuario`), mas dois dos negócios do seed têm responsável Gustavo (gestor) — `pode_acessar_responsavel` bloqueia silenciosamente updates fora do próprio responsável pra quem não é gestor+/carteira compartilhada (RLS não gera erro em UPDATE, só afeta 0 linhas), o que mascarou o teste de "perdido sem motivo". Corrigido trocando a simulação pra Gustavo.

**Retrabalho visual — adoção do `ui-ux-pro-max`:** depois de validar o 1D-2, o usuário instalou esse plugin e pediu pra reconstruir a identidade visual do zero com ele, "para que fique um projeto homogêneo desde o começo" — substitui a direção anterior (Fraunces + IBM Plex Sans, desenhada via `frontend-design` no 1D-1). Pesquisa com `search.py --design-system`/`--domain style,color,typography`:
- **Cor:** convergiu de forma independente em duas buscas diferentes no mesmo par **teal `#0D9488` + laranja `#EA580C`** — próximo do que já existia.
- **Estilo:** `data-dense-dashboard` + `Flat Design` (sem sombra decorativa em superfície — `Card`/`CardNegocio` perderam `shadow-sm`; overlays mantiveram sombra funcional).
- **Tipografia:** conflito real entre "seguir o plugin" e a diretriz anterior de evitar fontes genéricas de IA (Inter é citado nominalmente pela skill `frontend-design`) — usuário escolheu seguir o plugin integralmente: **Calistoga** (display) + **Inter** (corpo) + **JetBrains Mono** (rótulos), self-hosted via `@fontsource`.
- **Tokens:** `accent` do shadcn (hover de menu) ficou teal claro — não o laranja do plugin, que mapeia pro token `urgencia` já existente. Dark mode derivado por mim (o plugin não devolveu valores), mesma família de matiz.
- Nenhuma página foi reescrita — todas já usam os tokens semânticos, herdaram a nova identidade só com a troca de `globals.css`/`tailwind.config.ts`.

</details>

<details>
<summary>Histórico — 1D-1: Layout geral da plataforma (2026-09-14)</summary>

Sem mudança de schema. Tipografia Fraunces (display, self-hosted via `@fontsource-variable/fraunces`) + IBM Plex Sans (corpo, `@fontsource/ibm-plex-sans`) — só os subsets `latin`/`latin-ext` (+ `vietnamese`, que vem junto no pacote variable do Fraunces), não `cyrillic`/`greek`, pra não inflar bundle/precache do PWA com scripts que o produto (só PT-BR) nunca usa. Paleta papel/tinta quase-preta com teal profundo de primária e âmbar reservado só pra urgência de vencimento (tokens `--urgencia`, `--sidebar`, claro e escuro). Sidebar fixa no desktop (trocador de empresa + nav + menu de usuário, sem cabeçalho duplicado); barra superior fina + abas fixas embaixo no mobile. `RotaProtegida` virou guarda de autenticação pura; `AppShell` (novo) centraliza o redirect de quem não tem empresa.

</details>

<details>
<summary>Histórico — 1C-3: Importação de planilha (2026-09-14)</summary>

Schema (policy de insert em `importacao_erros`) validado — 82/82 pgTAP; lógica pura de mapeamento de colunas e deduplicação com 11 testes Vitest próprios (25 no total do projeto); `lint`/`typecheck`/`test`/`build` limpos.

Decisão de arquitetura tomada com o usuário: processamento no navegador (não Edge Function + Storage) — mesmo raciocínio do convite manual no 1B. Achado no caminho: a `xlsx` (SheetJS) do npm registry tem duas vulnerabilidades de severidade alta sem correção (`npm audit`); trocada por duas libs mantidas — `papaparse` (CSV) e `exceljs` (XLSX), ambas carregadas via `import()` dinâmico pra não pesar o bundle principal de quem nunca usa a importação (confirmado no build: chunks separados de 18.68 kB e 929.55 kB, bundle principal cresceu só ~12 kB).

</details>

<details>
<summary>Histórico — 1C-2: Vencimentos (2026-09-14)</summary>

Schema (`renovar_vencimento()`) validado — 80/80 pgTAP; frontend (lista com filtros, ficha com mudança de status, diálogo de renovação que sugere a próxima data pra recorrência mensal/anual) confirmado funcionando no navegador pelo usuário.

Bug de teste pgTAP pego antes de fechar (não é bug do código de produção): a primeira asserção do `vencimentos.sql` filtrava por `descricao` sozinha pra checar o vencimento original — depois de `renovar_vencimento()`, existem *duas* linhas com a mesma descrição de propósito (a função copia a descrição pro próximo), então a query virou ambígua (`more than one row returned by a subquery`). Corrigido combinando `descricao` com o `valor` original do seed pra mirar só na linha antiga.

</details>

<details>
<summary>Histórico — 1C-1: Contatos (2026-09-14)</summary>

Schema (trigger `ultimo_contato_em`) validado — 75/75 pgTAP; frontend (lista com filtros, ficha com timeline, formulário com campos personalizados dinâmicos e tags, registro rápido "Como foi?") confirmado funcionando no navegador pelo usuário.

Dois bugs de tipagem pegos pelo `tsc`, corrigidos antes de rodar qualquer coisa:
- `useContatos.ts`: filtro por tag usava um `select()` condicional (string muda conforme o filtro) — o supabase-js não consegue tipar isso em tempo de compilação (`ParserError`). Resolvido buscando os ids em `contato_tags` primeiro e filtrando com `.in("id", ids)` depois, em vez de tentar embutir o join na mesma query.
- `useMembrosEmpresa` (1B, só usado agora): tentava `empresa_membros.select("perfis(nome)")`, mas não há FK direta entre as duas tabelas (as duas só se relacionam via `auth.users`) — o PostgREST não embeda relações transitivas. Resolvido com duas consultas (busca os membros, depois busca os perfis por `id`, junta em memória).

</details>

<details>
<summary>Histórico — 1B: auth, onboarding, convites (2026-09-14)</summary>

72/72 asserções pgTAP (51 do 1A + 21 novas), fluxo real via `curl` contra a API do Supabase local, e teste manual no navegador confirmando cadastro → criar empresa → convidar → aceitar convite funcionando de ponta a ponta.

Quatro bugs de UX encontrados e corrigidos durante o teste manual (não pegos pelos testes automatizados, que não cobrem navegação/React Query):
- Mensagem de erro genérica em `AceitarConvite.tsx` escondia a causa real (token inválido vs. e-mail errado vs. expirado) — agora mostra a mensagem específica que `aceitar_convite()` devolve.
- Não havia botão de logout em lugar nenhum — impossível voltar pra `/entrar`/`/cadastro` depois de logado. Adicionado em `RotaProtegida.tsx` (cabeçalho, aparece em toda rota autenticada).
- Convite pendente não podia ser recuperado nem cancelado depois que o link sumia da tela (ex.: após dar refresh) — `Convidar.tsx` ganhou "Copiar link" e "Cancelar" por convite.
- Corrida de dados: mutações de `useCriarEmpresa`/`useAceitarConvite` invalidavam a query de empresas sem aguardar (`void queryClient.invalidateQueries(...)`), então `navigate()` acontecia antes da lista atualizar e a tela seguinte via "0 empresas" por um instante. Corrigido pra aguardar a invalidação antes de resolver a mutação.
- `Cadastro.tsx` ignorava de onde o usuário veio e sempre mandava pra `/onboarding` — quem clicava "Criar conta" a partir de um link de convite perdia o convite e acabava criando a própria empresa por engano. Agora preserva `location.state.de`, igual o `Entrar.tsx` já fazia.

**Achado de segurança** (skill `security-check`): `aceitar_convite` confia em `auth.email()`, que só é confiável se o Supabase Auth exigir confirmação de e-mail. Localmente `enable_confirmations = false` (de propósito) — em produção isso **precisa** virar `true`. Ver "Pré-requisitos de lançamento" abaixo.

</details>

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

**1C-1 — schema** (`supabase/migrations/20260914163110_contatos_ultimo_contato.sql`):
- Trigger `atualizar_ultimo_contato()` em `atividades after insert` — atualiza `contatos.ultimo_contato_em` quando a atividade tem `contato_id`. `security invoker` (não precisa bypassar RLS).

**1C-1 — frontend:**
- `src/components/ui/` ganhou `table`, `dialog`, `tabs`, `textarea`, `badge` (deps novas: `@radix-ui/react-dialog`, `@radix-ui/react-tabs`).
- `src/features/onboarding/api/useEmpresas.ts` ganhou `useMembrosEmpresa()` — lista membros da empresa com nome, pro seletor de "responsável".
- `src/features/contatos/` — `api/` (`useContatos` com filtros de status/temperatura/tag/busca, `useContato`, `useCamposPersonalizados`, `useTags`/`useTagsDoContato`/`definirTagsDoContato`, `useAtividades`/`useRegistrarAtividade`, `useMutacoesContato` — criar/atualizar/excluir com soft delete), `schemas.ts` (`construirContatoSchema()` monta a validação em runtime a partir dos `campos_personalizados` da empresa), `components/CampoPersonalizado.tsx` (renderiza texto/número/data/seleção/booleano), `components/TimelineContato.tsx`, `paginas/ListaContatos.tsx`, `paginas/FormularioContato.tsx` (criar e editar), `paginas/DetalheContato.tsx` (ficha com abas Dados/Timeline + modal "Como foi?").
- Rotas novas: `/contatos`, `/contatos/novo`, `/contatos/:id`, `/contatos/:id/editar`.
- Fora do escopo, de propósito (ver plano do 1C-1): ações em massa, busca global (Ctrl+K), tarefa real a partir do "próximo passo" do registro rápido (fica texto livre até a tela de tarefas existir no 1D).

**1C-2 — schema** (`supabase/migrations/20260914165753_renovar_vencimento.sql`):
- `renovar_vencimento(vencimento_id, nova_data, novo_valor, novos_campos)` — fecha o vencimento atual (`status = 'renovado'`) e cria o próximo (`status = 'pendente'`) na mesma transação. `security invoker` — não bypassa RLS, o usuário já precisa ter acesso de escrita ao vencimento original.

**1C-2 — frontend:**
- `src/lib/datas.ts` ganhou `somarPeriodo(data, "mes"|"ano", n)` — sugere a próxima data numa renovação mensal/anual.
- `src/lib/camposPersonalizados.ts` (novo) — extraído de `contatos/schemas.ts`: a validação dinâmica de campos personalizados (`validarCamposPersonalizados`) agora é compartilhada entre Contatos e Vencimentos, em vez de duplicada.
- `CampoPersonalizado` (componente) e `useCamposPersonalizados` (hook, ambos em `contatos/`) generalizados: o componente virou genérico em `TFormValues`, o hook ganhou o parâmetro `entidade: "contato" | "vencimento"`. Vencimentos importa os dois de `contatos/` — ainda não relocados pra um lugar neutro (nota de arquitetura, não bloqueante).
- `src/features/vencimentos/` — `api/` (`useVencimentos` com filtros de status/tipo/responsável/período, `useVencimento`, `useVencimentoTipos`, `useMutacoesVencimento` — criar/atualizar/excluir/mudar status/`useRenovarVencimento`), `schemas.ts`, `components/DialogoRenovacao.tsx` (sugere data pra mensal/anual, pede pra escolher em única/personalizada), `paginas/ListaVencimentos.tsx`, `paginas/FormularioVencimento.tsx` (aceita `?contatoId=` pra pré-preencher), `paginas/DetalheVencimento.tsx`.
- `DetalheContato.tsx` ganhou uma aba "Vencimentos" listando os vencimentos daquele contato.
- Rotas novas: `/vencimentos`, `/vencimentos/novo`, `/vencimentos/:id`, `/vencimentos/:id/editar`.
- Fora do escopo, de propósito (decisão tomada com o usuário): visão de calendário, anexos/Supabase Storage. Fora do escopo estrutural (não é decisão, é dependência): card automático no funil de Renovação (precisa de Funis do 1D + `pg_cron` da Fase 2).

**1C-3 — schema** (`supabase/migrations/20260914175322_importacao_erros_insert.sql`):
- Policy de `insert` em `importacao_erros` pra `authenticated` (`is_membro(empresa_id)`) — a migration original (1A) só tinha `select`, porque presumia um worker `service_role`. Decisão desta fase: processamento no navegador, então precisa da policy de verdade.

**1C-3 — frontend:**
- **Dependências:** `xlsx` foi cogitada e descartada (2 vulnerabilidades altas sem correção no npm — ver "Estado atual"); `papaparse` (CSV) + `exceljs` (XLSX) no lugar, ambas com `@types` ou tipagem própria, carregadas via `import()` dinâmico só dentro de `parseArquivo.ts`.
- `src/features/importacao/` — `logica/` (funções puras, sem Supabase, testadas em Vitest): `mapeamentoColunas.ts` (sugestão automática de coluna→campo por sinônimo), `deduplicacao.ts` (compara contra contatos existentes + dedup dentro do próprio arquivo), `processarLinhas.ts` (aplica mapeamento + valida, reusa `validarCPF`/`validarCNPJ`), `parseArquivo.ts` (lê `.csv`/`.xlsx`), `modeloPlanilha.ts` (gera o CSV de exemplo pra download); `api/useImportacao.ts` (cria/finaliza a linha em `importacoes`, registra erro por linha, busca contatos existentes pra dedup); `paginas/ImportarContatos.tsx` (wizard de 4 passos numa página só — Upload → Mapear → Prévia → Resultado — mesmo estilo do `DialogoRenovacao` do 1C-2, sem rota por passo).
- Rota nova: `/contatos/importar`, com link em `ListaContatos.tsx`.
- Contato importado nasce com `status: "cliente"` (não "lead") — julgamento de que importação de planilha normalmente é migração de carteira existente, não captação de leads novos. Revisável.
- Linha com `dataVencimento` preenchida também cria um `vencimento` vinculado (recorrência = a do tipo encontrado por nome, ou "anual" se não achar correspondência).
- Fora de escopo, de propósito (decisão tomada com o usuário): "dados de exemplo removíveis com um clique" do PRD §6.1 — é uma feature de seed de demonstração, conceitualmente separada de "importar minha planilha real".
- Inserção linha a linha (não em lote) — simples e correto, mas arquivos muito grandes demoram mais. Otimização de lote fica pra depois, se precisar.

**1D-1 — layout geral da plataforma:**
- **Dependências:** `@fontsource-variable/fraunces`, `@fontsource/ibm-plex-sans`, `@radix-ui/react-dropdown-menu`. `npm audit` limpo (só a vulnerabilidade moderada já revisada do `uuid` via `exceljs`, sem nada novo).
- `src/app/globals.css` — tokens de cor novos (`--urgencia`, `--sidebar`, claro/escuro) + `@import` dos subsets `latin`/`latin-ext` das fontes (sem `cyrillic`/`greek`, produto é só PT-BR).
- `tailwind.config.ts` — `fontFamily.display` (Fraunces) e `fontFamily.sans` (IBM Plex Sans, substitui o sans padrão), cores `urgencia`/`sidebar`.
- `src/components/ui/dropdown-menu.tsx` (novo, escrito à mão como os outros).
- `src/app/AppShell.tsx` (novo) — sidebar fixa no desktop (trocador de empresa só aparece com mais de uma empresa, nav Início/Contatos/Vencimentos, menu de usuário com "Sair"); barra superior + abas fixas no mobile. Redireciona pra `/onboarding` se `empresas.length === 0`.
- `src/app/RotaProtegida.tsx` — simplificado pra guarda de autenticação pura.
- `src/app/router.tsx` — reestruturado: `RotaProtegida` (auth) por fora; dentro, `/onboarding` solto e um segundo nível `AppShell` envolvendo `/`, `/contatos*`, `/vencimentos*`, `/convidar`.
- `src/app/paginas/Inicio.tsx` — removido o redirect (foi pro `AppShell`) e os botões de navegação ad-hoc (viraram nav de verdade na sidebar/abas).
- Fora de escopo, de propósito: busca global Ctrl+K (PRD §4, ciclo próprio); itens de nav pra Funis/Tarefas (entram só quando essas telas existirem no 1D-2/1D-3, pra não ter link morto).

**1D-2 — funis de venda (kanban):**
- **Dependência nova:** `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`. `npm audit` limpo (mesma vulnerabilidade moderada já revisada, nada novo).
- `supabase/migrations/20260914191220_funis_negocios.sql` — trigger `atualizar_entrou_na_etapa()` (reseta a coluna ao mudar de etapa) + RPCs `marcar_negocio_ganho`/`marcar_negocio_perdido` (ambas `security invoker`, mesmo raciocínio do `renovar_vencimento` do 1C-2).
- `src/features/onboarding/api/useEmpresas.ts` — `EmpresaMembro` ganhou `fuso` (não era selecionado antes; Funis é a primeira tela que precisa de "hoje" de verdade).
- `src/features/funis/` — `api/` (`useFunis`, `useEtapas`, `useMotivosPerda`, `useNegocios`/`useNegocio`/`useNegociosDoContato`, `useMutacoesNegocio` — criar/atualizar/excluir, `useMoverNegocio` grava atividade `mudanca_etapa` na timeline, `useMarcarGanho`/`useMarcarPerdido` chamam as RPCs), `schemas.ts`, `components/` (`QuadroFunil` com dnd-kit, `CardNegocio`, `DialogoProximoPasso` — confirma/troca o próximo passo ao mover um card, `DialogoPerda`, `ListaNegocios`), `paginas/` (`Funil` — quadro/lista alternáveis, lista é o padrão no mobile, `FormularioNegocio`, `DetalheNegocio` — ações de ganho/perda).
- `src/app/AppShell.tsx` — item "Funis" na nav (sidebar e abas).
- Rotas novas: `/funis`, `/funis/negocios/novo`, `/funis/negocios/:id`, `/funis/negocios/:id/editar`.
- `DetalheContato.tsx` ganhou aba "Negócios", no mesmo molde da aba "Vencimentos" do 1C-2.
- Fora de escopo, de propósito (decisão tomada com o usuário): edição de funis/etapas (vai pra uma futura fatia de Configurações, PRD §8, junto com tipos de vencimento/campos personalizados/tags/motivos de perda — mesmo problema, mesma solução).
- Fora de escopo, estrutural (não é decisão, é dependência): card automático no funil de Renovação a partir de vencimentos (PRD §6.4) — precisa de `pg_cron`, Fase 2.

**1D-3 — tarefas:**
- **Sem migration.** `tarefas` já existia desde o 1A (RLS `tarefas_por_responsavel` + isolamento em `isolamento_multiempresa.sql`) — fatia puramente frontend.
- `src/lib/vocabulario.ts` — ganhou `tarefa`/`tarefaPlural`.
- `src/features/tarefas/` (slice novo) — `api/` (`useTarefas`/`useTarefa` com filtros de status/tipo/responsável/contato/negócio, `useMutacoesTarefa` — criar/atualizar/excluir e `useAlternarConclusaoTarefa`, update direto de `concluida_em`, sem RPC porque é escrita de uma coluna só), `schemas.ts`, `components/` (`DialogoTarefa` — criar/editar em diálogo, não página própria; `ItemTarefa` — checkbox de concluir/reabrir, ícone por tipo, destaque em `--urgencia` quando atrasada), `paginas/ListaTarefas.tsx` (agrupada em Atrasadas/Hoje/Próximas quando o filtro é "pendentes").
- `src/app/AppShell.tsx` — item "Tarefas" na nav. Rota nova: `/tarefas`.
- `DetalheContato.tsx`/`DetalheNegocio.tsx` — aba/seção "Tarefas". É aqui que a tarefa de reativação criada pelo `marcar_negocio_perdido` do 1D-2 finalmente fica visível em algum lugar.
- Fora de escopo, de propósito: Cadências (PRD §6.6, depende de templates de mensagem — Fase 2); tela "Hoje" (1D-4); notificação de tarefa (depende de push, 1D-5).

**1D-4 — tela "Hoje":**
- **Sem migration.** Tudo leitura sobre `contatos`/`vencimentos`/`negocios`/`tarefas`/`empresa_membros`, tabelas e RLS que já existiam.
- `src/features/hoje/` (slice novo) — `api/useResumoHoje.ts` (`useLeadsSemContato`, `useNegociosVencidos` — variante de negócios sem exigir `funilId`, diferente de `useNegocios` que é por funil, `useVencimentosPendentesHoje`, `useAniversariantesHoje` — filtro de mês/dia no cliente, `useResumoNumeros` — 5 contagens via `count: "exact", head: true`, `usePrimeirosPassos` — 3 contagens), `components/` (`SecaoAcoesHoje`/`ItemAcao` — wrapper genérico que some quando a seção está vazia, `CardsResumo`, `BarraPrimeirosPassos` — some quando os 3 itens estão completos).
- `src/app/paginas/Inicio.tsx` — deixou de ser placeholder; reusa `ItemTarefa`/`DialogoTarefa` do 1D-3 pra seção de follow-ups (mesma UX de `/tarefas`, sem duplicar código).
- **Decisão tomada com o usuário:** checklist "Primeiros passos" só com os 3 itens viáveis na Fase 1 (importar contatos, cadastrar vencimento, convidar equipe) — "conectar WhatsApp" e "ativar régua" entram quando a Fase 2 existir.
- Fora de escopo, de propósito: clientes que responderam a lembrete (inbox WhatsApp, Fase 2); clientes esfriando (PRD marca como Fase 5); notificação push do resumo diário (1D-5).

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
5. **1C-3 (Importação de planilha) não foi testado no navegador ainda** — a lógica pura (mapeamento, dedup) tem 11 testes Vitest, o schema tem pgTAP, e `lint`/`typecheck`/`build` passam, mas o fluxo completo (upload real de um .csv/.xlsx, mapeamento, prévia, criação em massa) só foi verificado por leitura de código nesta sessão.
6. **1D-1 (Layout geral) validado no navegador pelo usuário** — sidebar, abas mobile, tema e trocador de empresa confirmados funcionando.
7. **1D-2 (Funis) validado no navegador pelo usuário** — quadro, arrastar card, ganho/perdido confirmados funcionando.
8. **Achado de UX corrigido:** `/onboarding` não tinha botão de "Sair" (fica fora do `AppShell`, que é quem tem o menu de usuário) — sessão inválida (ex.: usuário apagado por `db:reset` local) prendia quem estava ali sem jeito de deslogar pela interface. Corrigido em `CriarEmpresa.tsx` com um botão "Sair" próprio.
9. **Retrabalho visual (adoção do `ui-ux-pro-max`) validado no navegador pelo usuário** — paleta, tipografia e alternância de tema claro/escuro confirmados funcionando (o alternador só foi ligado ao menu de usuário depois de o usuário notar que não achava onde trocar — `useTema()` existia desde o 1A mas nunca tinha sido chamado por nenhum componente).
10. **1D-3 (Tarefas) validado no navegador pelo usuário.**
11. **1D-4 (Tela "Hoje") não foi testado no navegador ainda** — sem migration, `lint`/`typecheck`/`test`/`build` passam, mas as seções de ação, a barra "Primeiros passos" e os cards de resumo só foram verificados por leitura de código nesta sessão.

## Próximos passos imediatos (ao retomar, nesta ordem)

1. `git clone` (ou `pull`) o repositório na máquina nova.
2. Abrir o **Docker Desktop** — pré-requisito para tudo abaixo.
3. `npm install`.
4. Criar `.env.example` (conteúdo acima) e `.env.local` (mesmo formato, com valores reais — rode `npm run supabase:start` e use a `API_URL`/`ANON_KEY` que ele imprimir).
5. `npm run db:reset` — aplica as 11 migrations + seed do zero.
6. `npm run test:db` — roda os 8 arquivos pgTAP (92 asserções). **Portão de aceite.**
7. `npm run db:types` — regenera `src/types/database.ts` (já commitado, mas regenere se mudar alguma migration).
8. `npm run dev` — testar no navegador o fluxo de Importação: em `/contatos/importar`, baixar o modelo, preencher com uma linha válida + uma com CPF inválido + uma duplicada de um contato do seed, subir o CSV, conferir o mapeamento automático, a prévia com os três status, confirmar, e checar que só a válida virou contato (e vencimento, se a coluna de data foi preenchida).
9. Resolver a pendência de lançamento (`enable_confirmations`) **antes** de criar qualquer projeto Supabase de staging/produção.
10. **1D-2, 1D-3 e o retrabalho visual (`ui-ux-pro-max`) já validados no navegador.**
11. Testar o **1D-4** no navegador: abrir `/` (empresa Alfa, que tem leads sem contato, negócios vencidos e vencimentos espalhados no tempo); conferir a barra "Primeiros passos" (incompleta com o seed); testar WhatsApp/Ver em um lead sem contato; concluir um follow-up direto da lista; abrir um negócio vencido e um vencimento a partir da tela; conferir os 4 cards de resumo; testar com uma empresa sem pendências pra ver o estado vazio.
12. Depois de validado, seguir pro **1D-5** (PWA completo com push) — fecha o incremento 1D inteiro.

## Roteiro dos incrementos da Fase 1

(1C dividido em três fatias — 1C-1 Contatos, 1C-2 Vencimentos, 1C-3 Importação — cada uma com seu próprio ciclo de plano, como 1A/1B/1C-1 tiveram.)

- **1A — fundação** (este documento): schema, RLS, isolamento. Implementado e validado (51/51 pgTAP).
- **1B — entrada:** auth Supabase (e-mail+senha), onboarding com `criar_empresa_com_onboarding()`/`aplicar_template()`, convites (link manual). Implementado e validado (72/72 pgTAP + fluxo real via curl). Checklist "Primeiros passos" **adiado pro 1D** de propósito (decisão tomada com o usuário — a maioria dos itens depende de telas que só existem em 1C/1D).
- **1C-1 — Contatos:** lista com filtros, ficha com timeline, campos personalizados dinâmicos, tags, registro rápido "Como foi?". Implementado e validado (pgTAP + navegador).
- **1C-2 — Vencimentos:** lista com filtros, ficha, renovação (`renovar_vencimento()` + diálogo de confirmação). Implementado e validado (pgTAP + navegador).
- **1C-3 — Importação de planilha:** CSV/XLSX, mapeamento automático, dedup (PRD §6.1). Processamento no navegador (decisão tomada com o usuário). Implementado, validado por pgTAP + Vitest + lint/typecheck/build; teste no navegador pendente. **1C inteiro fechado com esta fatia.**
- **1D — operação** (dividido em cinco fatias, mesmo padrão de 1A/1B/1C):
  - **1D-1 — Layout geral:** sidebar (desktop)/abas (mobile), trocador de empresa, tema visual do produto inteiro (Fraunces + IBM Plex Sans, paleta papel/teal/âmbar-urgência). Implementado e validado no navegador.
  - **1D-2 — Funis:** kanban com dnd-kit + visão em lista, negócios, próximo passo obrigatório, ganho/perda. Implementado e validado no navegador. Edição de funis/etapas fica pra uma futura fatia de Configurações.
  - **Retrabalho visual (`ui-ux-pro-max`):** depois do 1D-2 validado, o usuário instalou o plugin `ui-ux-pro-max` e pediu pra reconstruir a identidade visual do 1D-1+1D-2 com ele, pra ficar homogêneo desde o início — substitui a direção anterior (Fraunces/IBM Plex Sans) por Calistoga/Inter/JetBrains Mono + paleta teal/laranja. Detalhes no "Estado atual" acima e na memória `project_1d_visual_design`. Aplicado via troca de tokens (`globals.css`/`tailwind.config.ts`), sem reescrever páginas. Implementado e validado no navegador (inclusive o alternador de tema claro/escuro, ligado ao `useTema()` que existia desde o 1A mas nunca tinha sido chamado por nada).
  - **1D-3 — Tarefas:** CRUD de tarefas (diálogo, não página própria) + concluir/reabrir, vínculo opcional com contato ou negócio, destaque de atraso. Sem migration (schema/RLS já existiam desde o 1A). Implementado e validado no navegador. Cadências ficam pra Fase 2 (dependem de templates de mensagem).
  - **1D-4 — Tela "Hoje":** substitui o placeholder de `Inicio.tsx` — leads sem primeiro contato, follow-ups de hoje/atrasados, negócios com próximo passo vencido, vencimentos pendentes, aniversariantes, cards de resumo, checklist "Primeiros passos" (só os 3 itens viáveis na Fase 1 — decisão tomada com o usuário). Sem migration. Implementado, validado por lint/typecheck/test/build; teste no navegador pendente.
  - **1D-5 — PWA completo com push** (depende de infra de notificação que ainda não existe). Não iniciado. Última fatia do 1D.
  - **Diretriz do usuário pro visual (vale pro 1D inteiro, não só 1D-1):** atual, sem cara de IA, padrão de produto SaaS de verdade — não os defaults genéricos do shadcn/ui. Registrada na memória de projeto `project_1d_visual_design`.
