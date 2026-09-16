# Spec: `fila-envios` (Fase 3 recortada)

Módulo 1 de 5 do `docs/fase3/CAPABILITY-MAP.md`. Sem dependências de outro módulo novo — usa `contatos`/`consentimentos`/`empresas` do núcleo, já existentes.

## Objetivo

Fundação única por onde toda mensagem (e-mail ou WhatsApp) sai do sistema — campanhas (módulo seguinte) e, mais tarde, automações/réguas (Fase 2) escrevem na fila; nada mais chama um provider diretamente. Garante as regras de ouro do projeto (consentimento, opt-out, horário comercial, janela de 24h) num lugar só, testável, em vez de espalhadas por cada feature que manda mensagem.

**Não** inclui, nesta fase: conta ativa/limite do plano (billing é Fase 4, tabelas não existem), envio real a qualquer provider (Meta/SMTP — ver ADR 0004/0005), UI própria (a UI de "por que não foi enviado" pertence ao módulo `campanhas`, que consome esta fila).

## Decisões que fecham este spec

- ADR 0004 — Fase 2 adiada, Fase 3 usa `EmailProvider`/`WhatsAppProvider` mock.
- ADR 0005 — o worker roda inteiro em Postgres (`pg_cron`), sem Edge Function, enquanto o provider for mock.
- Checagens de "conta ativa"/"limite do plano" (`.claude/rules/Mensageria.md`, itens 1–2) ficam de fora agora — a ordem do worker já nasce preparada pra recebê-las na frente da cadeia quando a Fase 4 existir.
- O mock marca só `enviada`, sincronamente; `entregue`/`lida` ficam `null` até a Fase 2 conectar um provider real com webhook — evita métrica sintética contaminando relatórios.

## Modelo de dados

Tabela nova `fila_envios` (segue o checklist de `.claude/rules/Supabase.md`):

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `uuid default gen_random_uuid()` | PK |
| `empresa_id` | `uuid not null references empresas` | |
| `contato_id` | `uuid not null` | FK composta `(empresa_id, contato_id) → contatos(empresa_id, id)`, padrão da ADR 0003 |
| `canal` | `text not null check (canal in ('email','whatsapp'))` | |
| `finalidade` | `text not null check (finalidade in ('atendimento','marketing'))` | espelha `consentimentos.finalidade` |
| `origem_tipo` | `text not null check (origem_tipo in ('campanha'))` | `check` cresce quando `automacao`/`cadencia` existirem (Fase 2) |
| `origem_id` | `uuid not null` | ex.: `campanha_id` — sem FK física (aponta pra tabela que varia por `origem_tipo`; validado em app/trigger) |
| `chave_idempotencia` | `text not null` | ex.: `campanha:<campanha_id>:contato:<contato_id>` — **`unique (empresa_id, chave_idempotencia)`** |
| `assunto` | `text` | só e-mail |
| `conteudo` | `text not null` | já resolvido (variáveis substituídas — ver regra "variável sem valor bloqueia o envio") |
| `status` | `text not null default 'pendente' check (status in ('pendente','bloqueada','enviada','falhou'))` | sem `enviando` — o worker processa cada linha numa transação curta, não precisa de lock de "em progresso" nesta escala |
| `motivo_bloqueio` | `text` | preenchido quando `status='bloqueada'` — motivo legível (ex.: `sem_consentimento_marketing`, `optout`, `fora_janela_24h`) |
| `agendado_para` | `timestamptz not null default now()` | quando o worker pode tentar; reagendado pra dentro do próximo horário comercial se bloquear por isso |
| `processado_em` | `timestamptz` | quando o worker decidiu o destino final (enviada/bloqueada/falhou) |
| `created_at` | `timestamptz not null default now()` | |
| `created_by` | `uuid references auth.users` | |

Índices: `(empresa_id, status, agendado_para)` (o worker varre por isso), `unique (empresa_id, chave_idempotencia)`.

RLS: `select` para membro da empresa com o mesmo critério de acesso de `consentimentos` (gestor+, carteira compartilhada, ou responsável pelo contato); **sem `insert`/`update`/`delete` direto pra `authenticated`** — só a função `security definer` `enfileirar_envio(...)` escreve, e só o worker (também `security definer`) atualiza status. Espelha o padrão de soft delete via `excluir_registro` da ADR 0003 (escrita canalizada por função, não por UPDATE solto).

## Funções

- **`enfileirar_envio(p_contato_id, p_canal, p_finalidade, p_origem_tipo, p_origem_id, p_chave_idempotencia, p_assunto, p_conteudo, p_agendado_para default now())`** — `security invoker` (quem chama já precisa ter acesso de escrita ao contato); insere em `fila_envios` com `status='pendente'`. Conflito de `chave_idempotencia` é `on conflict do nothing` (idempotência de verdade, não erro).
- **`processar_fila_envios(p_agora timestamptz default now())`** — `security definer`, `set search_path = ''`. Varre `fila_envios` com `status='pendente' and agendado_para <= p_agora`, por linha:
  1. Consentimento: existe `consentimentos` mais recente (`empresa_id, contato_id, finalidade`) com `concedido = true`? Senão → `bloqueada`, motivo `sem_consentimento_<finalidade>`.
  2. Opt-out: existe registro de opt-out mais recente pra esse contato? (reusa a mesma tabela `consentimentos` — opt-out é `concedido=false` pra `finalidade='marketing'`, conforme já modelado) → `bloqueada`, motivo `optout`.
  3. Horário comercial: `agora` (convertido pro fuso da empresa) cai dentro de `empresas.horario_comercial`? Se não, **não bloqueia** — recalcula `agendado_para` pro próximo horário válido e mantém `status='pendente'` (linha é revisitada na próxima execução do cron).
  4. Janela de 24h (só `canal='whatsapp'`): fora de 24h desde a última mensagem *recebida* do contato → nesta fase, sem inbox real (ADR 0004), a janela nunca está aberta por resposta do cliente; toda campanha de WhatsApp mock é tratada como "fora da janela, exige template aprovado" — como não existe integração real com a Meta ainda, essa checagem **passa direto** (documentado como `TODO` explícito no corpo da função, não implementado a fingir) até a Fase 2 trazer `templates_mensagem`/conversas de verdade.
  5. Chama `mock_enviar_mensagem(canal, conteudo)` → sempre sucesso nesta fase → `status='enviada'`, `processado_em=p_agora`.
  Retorna quantas linhas processou, por status (útil pro teste pgTAP e pra um log simples).
- **`mock_enviar_mensagem(p_canal text, p_conteudo text)`** — função interna (não exposta via RPC pública), único ponto que a Fase 2 troca por uma chamada real (ver ADR 0005). Nesta fase, só retorna sucesso.

Agendamento: `cron.schedule('processar-fila-envios', '* * * * *', $$select public.processar_fila_envios()$$)` — a cada minuto, mesmo padrão de granularidade fina já aceitável em Postgres puro (sem custo de rede).

## Convenções de código (herdadas do projeto, não repetidas aqui)

Ver `CLAUDE.md` (comandos, regras de ouro) e `.claude/rules/Supabase.md`/`Mensageria.md`. SQL em `supabase/migrations/`, testes em `supabase/tests/`. Sem frontend próprio neste módulo.

## Testing Strategy

pgTAP (`supabase/tests/fila_envios.sql`), cobrindo pelo menos:
- Isolamento multiempresa (padrão de todo teste novo: usuário da empresa B não lê fila da empresa A).
- `enfileirar_envio` bloqueia escrita direta em `fila_envios` (só a função grava — `update`/`insert` direto devem falhar ou afetar 0 linhas, mesmo padrão da ADR 0003).
- `processar_fila_envios`: contato sem consentimento de marketing → `bloqueada`/`sem_consentimento_marketing`; contato com opt-out → `bloqueada`/`optout`; fora do horário comercial → continua `pendente` com `agendado_para` no futuro; dentro do horário com consentimento → `enviada`.
- Idempotência: chamar `enfileirar_envio` duas vezes com a mesma `chave_idempotencia` não cria duas linhas.
- `p_agora` como parâmetro (mesmo padrão de `gerar_notificacoes_diarias` do 1D-5) pra teste determinístico de horário comercial/fuso.

`npm run test:db` roda o arquivo; sem teste Vitest novo (não há lógica TypeScript neste módulo).

## Boundaries

- **Sempre:** todo envio passa por `enfileirar_envio` — nenhum código novo chama `mock_enviar_mensagem` direto; `search_path = ''` em toda função `security definer`; teste pgTAP de isolamento antes de fechar a migration.
- **Perguntar antes:** mudar o `check` de `origem_tipo`/`status` (schema já pensado pra crescer, mas cada valor novo é uma decisão); mudar a granularidade do `cron.schedule`.
- **Nunca:** o worker chamar um provider real nesta fase; guardar conteúdo de mensagem em log; deixar `update`/`delete` direto em `fila_envios` liberado pra `authenticated`.

## Success Criteria

- Migration aplicada, `npm run db:types` limpo, pgTAP novo passando junto com todo o suite existente (153 + novos).
- `enfileirar_envio` + `processar_fila_envios` cobrem os 4 casos de checagem acima, comprovados por teste, não por leitura de código.
- Nenhuma linha de `fila_envios` gravável fora das duas funções `security definer`/`security invoker` descritas.

## Open Questions

Nenhuma pendente — as três decisões de arquitetura (checagens de plano, status do mock, agendamento) foram fechadas com o usuário antes deste spec (ver ADR 0005 e o resumo em "Decisões que fecham este spec").

## Correções aplicadas na implementação (2026-09-16)

A exploração de código antes de implementar encontrou 5 pontos que este spec não previu corretamente. Documentado aqui porque o spec é um documento vivo — a migration `20260916192944_fila_envios.sql` é a fonte da verdade final.

1. **`enfileirar_envio` é `security definer`, não `security invoker`.** O texto original se contradizia (tabela sem policy de `insert` pra `authenticated`, mas função `invoker` seria barrada pela própria RLS). Corrigido pro mesmo padrão de `excluir_registro`: `security definer` + checagem explícita de `pode_acessar_responsavel` no corpo.
2. **Consentimento por finalidade, decidido com o usuário:** `marketing` exige registro `concedido = true`; `atendimento` passa salvo opt-out explícito (`concedido = false` mais recente). Dois motivos de bloqueio distintos: `sem_consentimento_marketing` (sem registro nenhum) e `optout` (registro mais recente negativo).
3. **Nada no produto criava registros em `consentimentos`** antes desta implementação — a tabela existia desde o 1A sem hook/tela/seed. Resolvido como fatia extra deste módulo: `CardConsentimento` na ficha do contato (`src/features/contatos/components/CardConsentimento.tsx`), com `useConsentimentos`/`useRegistrarConsentimento` em `src/features/contatos/api/useConsentimentos.ts`.
4. **`processar_fila_envios` processa em lote**, `p_limite integer default 200` — decidido com o usuário, evita transação longa e entrega o limite de velocidade do PRD §6.9 de graça.
5. **Dois bloqueios que o spec não previu**, mesma família do bug que a revisão da ADR 0003 encontrou (RLS não protege dentro de função `security definer`): `contato_excluido` (contato soft-deletado depois de enfileirado, antes do worker rodar) e `sem_endereco_email`/`sem_endereco_whatsapp` (contato sem telefone/e-mail no canal do envio).

Também ganhou `updated_at` + trigger (exigido pelo checklist de `.claude/rules/Supabase.md`, omitido no texto original), e dois índices em vez de um (`(empresa_id)` pra leitura via RLS, `(status, agendado_para) where status='pendente'` pro worker — que varre todas as empresas de uma vez, sem filtrar por `empresa_id`).
