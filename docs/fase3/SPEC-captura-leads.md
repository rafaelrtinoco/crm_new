# Spec: `captura-leads` (Fase 3 recortada)

Módulo 3 de 5 do `docs/fase3/CAPABILITY-MAP.md`. Sem dependência de outro módulo novo — usa `contatos`/`empresas`/`empresa_membros`/`notificacoes` já existentes. PRD §6.10 (formulários, página de captura, webhook de entrada, distribuição/alerta) — **Meta Lead Ads fica fora**, ADR 0004.

## Objetivo

Três portas de entrada de lead que não existem hoje (hoje só há criação manual e importação em lote): formulário embutível, página de captura pública com a marca da empresa, e webhook genérico pra ferramentas de terceiro. As três convergem no mesmo caminho de ingestão — captura UTM/origem, distribui o lead (rodízio ou responsável fixo) e cria o contato como `lead`.

**Reaproveitamento importante:** o alerta "imediato ao responsável" (PRD) já existe — o trigger `notificar_lead_novo()` (1D-5) dispara em `contatos after insert` quando `status='lead'`, notificando o responsável (ou dono/gestor se não tiver). Este módulo não precisa de nenhuma notificação nova, só garantir que o `contato` nasce com `status='lead'` e o `responsavel_id` já resolvido pela distribuição.

## Decisões fechadas com o usuário

- **Webhook de entrada é uma RPC do Postgres**, sem Edge Function — `.../rest/v1/rpc/receber_lead_webhook?apikey=<anon key>`, token do negócio validado dentro da função via parâmetro no corpo. Mesma filosofia da ADR 0005 (Edge Function só quando há necessidade real de sair da rede do banco ou rodar código que o Postgres não roda). Risco documentado: ferramentas de webhook que não permitem configurar query string podem ter dificuldade — raro, mas existe; se aparecer na prática, revisar pra Edge Function dedicada.
- **Sem anti-spam nesta fase** (CAPTCHA/rate limit) — formulário/página de captura são endpoints públicos sem autenticação, então qualquer um que souber a URL pode submeter repetidamente. Aceito como débito conhecido, documentado abaixo em Boundaries — revisitar quando houver tráfego público real.

## Modelo de dados

```sql
-- adiciona slug ao núcleo (não existia) — necessário pra URL pública /p/{empresa}/{pagina}
alter table public.empresas add column slug text unique;

create table public.formularios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  nome text not null,
  campos jsonb not null default '["nome","telefone","email"]'::jsonb, -- quais campos pedir
  distribuicao_tipo text not null default 'rodizio' check (distribuicao_tipo in ('rodizio','fixo')),
  responsavel_fixo_id uuid, -- FK composta abaixo (ADR 0003)
  proximo_indice_rodizio integer not null default 0, -- ponteiro do round-robin
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  deleted_at timestamptz,
  constraint formularios_empresa_responsavel_fixo_id_fkey
    foreign key (empresa_id, responsavel_fixo_id) references public.empresa_membros (empresa_id, usuario_id),
  unique (empresa_id, id) -- alvo de FK composta (paginas_captura.formulario_id)
);

create table public.paginas_captura (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  slug text not null,
  titulo text not null,
  texto text,
  imagem_url text,
  formulario_id uuid, -- FK composta abaixo
  whatsapp_numero text,
  whatsapp_mensagem text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  deleted_at timestamptz,
  constraint paginas_captura_empresa_formulario_id_fkey
    foreign key (empresa_id, formulario_id) references public.formularios (empresa_id, id),
  unique (empresa_id, slug)
);

create table public.integracoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  tipo text not null check (tipo in ('webhook_generico')), -- cresce quando Meta Lead Ads entrar (Fase 2+)
  nome text not null,
  token_hash text not null, -- sha-256 do token; o token em claro só existe na resposta da criação, nunca persistido
  distribuicao_tipo text not null default 'rodizio' check (distribuicao_tipo in ('rodizio','fixo')),
  responsavel_fixo_id uuid, -- FK composta abaixo
  proximo_indice_rodizio integer not null default 0,
  ativo boolean not null default true,
  ultimo_uso_em timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  revogado_em timestamptz,
  constraint integracoes_empresa_responsavel_fixo_id_fkey
    foreign key (empresa_id, responsavel_fixo_id) references public.empresa_membros (empresa_id, usuario_id)
);
```

**Correção pós-revisão (2026-09-23):** `responsavel_fixo_id` (em `formularios` e `integracoes`) e `formulario_id` (em `paginas_captura`) viraram FK composta por `empresa_id` — o spec original (2026-09-16) tinha FK simples pra `auth.users(id)`/`formularios(id)`, desatualizado em relação à ADR 0003 (um dia mais velha que este spec, já aplicada em `negocios`/`tarefas`/`organizacoes` etc.): FK simples deixaria uma empresa apontar `responsavel_fixo_id` pra um usuário sem crachá ali, ou uma página de captura apontar pra um formulário de outra empresa.

RLS: `formularios`/`paginas_captura`/`integracoes` seguem o padrão "qualquer membro lê, só gestor+ escreve" (mesmo grupo de `segmentos`/`tags`/`funis`) — **exceto** que `integracoes.token_hash` nunca deve ir pro cliente em nenhum `select` (nem pra gestor): a política de `select` usa uma coluna computada/omite o hash, ou o hash mora numa tabela separada só acessível por função `security definer`. **Decisão de schema:** `token_hash` fica na mesma tabela mas **nenhuma policy de `select` inclui essa coluna** — o frontend usa uma view (`security_invoker`) `integracoes_publico` sem `token_hash`, mesmo padrão de `membros_empresa` da ADR 0003.

Público (`anon`): sem `select`/`insert` direto em nenhuma tabela do núcleo. Toda escrita pública passa pelas duas funções abaixo.

## Funções

- **`receber_lead(p_empresa_id uuid, p_nome text, p_telefone text, p_email text, p_origem text, p_utm jsonb, p_campos jsonb, p_distribuicao_tipo text, p_responsavel_fixo_id uuid, p_proximo_indice_rodizio integer) returns uuid`** — função interna (`security definer`, não exposta via RPC pública), compartilhada pelos dois pontos de entrada abaixo. Resolve `responsavel_id` (fixo, ou próximo da fila de rodízio entre membros ativos da empresa — dono/gestor/usuário, sem filtro de papel nesta fase) e insere o `contato` (`status='lead'`, `origem`, `utm_*`, `campos`). O trigger `notificar_lead_novo()` já existente cuida do alerta.
- **`submeter_formulario(p_formulario_id uuid, p_dados jsonb, p_utm jsonb) returns void`** — RPC pública (`anon`), `security definer`, `set search_path=''`. Valida `formulario.ativo`, extrai `nome`/`telefone`/`email`/demais campos de `p_dados`, chama `receber_lead` com `origem='formulario'`, avança `proximo_indice_rodizio` se for rodízio.
- **`receber_lead_webhook(p_token text, p_nome text, p_telefone text, p_email text, p_campos jsonb, p_utm jsonb) returns void`** — RPC pública (`anon`), `security definer`. Compara `sha256(p_token)` contra `integracoes.token_hash` (`tipo='webhook_generico'`, `ativo=true`, `revogado_em is null`) — token inválido é **`throws_ok` 42501 explícito**, não silêncio (é o único caminho de erro visível pra quem integrou errado). Atualiza `ultimo_uso_em`, chama `receber_lead` com `origem='webhook'`.
- **`obter_pagina_captura_publica(p_empresa_slug text, p_pagina_slug text) returns table (...)`** — RPC pública (`anon`), `security invoker` (não precisa bypassar nada — só devolve colunas específicas de `paginas_captura` + `nome`/`logo_url`/`cor_primaria` de `empresas`, nunca a linha inteira de nenhuma tabela). É o único jeito de expor branding da empresa pro público sem abrir `select` direto em `empresas` pra `anon`.

## Frontend

`src/features/captura/` (slice novo):
- `api/` — `useFormularios`/`useMutacoesFormulario`, `usePaginasCaptura`/`useMutacoesPaginaCaptura`, `useIntegracoes`/`useCriarIntegracao` (mostra o token em claro só uma vez, no retorno da criação — mesmo padrão de "copiar link" do convite no 1B), `useSubmeterFormularioPublico` (chama a RPC pública, sem `supabase.auth` — cliente anônimo).
- `paginas/ListaFormularios.tsx`, `FormularioFormulario.tsx` (builder de campos + distribuição), `ListaPaginasCaptura.tsx`, `FormularioPaginaCaptura.tsx`, `ListaIntegracoes.tsx` (gera/revoga token de webhook, mostra `curl` de exemplo).
- **Rotas públicas, fora do `AppShell`** (sem sidebar/autenticação): `/f/:empresaSlug/:formularioId` (formulário embutível — página nua, pra `iframe`), `/p/:empresaSlug/:paginaSlug` (página de captura completa, com marca). `FormularioFormulario.tsx` gera o snippet de embed (`<iframe src="…">`) a partir da URL de `/f/...`.
- Rotas autenticadas novas: `/captura/formularios*`, `/captura/paginas*`, `/captura/integracoes*`. **Nav (atualizado 2026-09-23):** o agrupamento "Marketing" já existe (`src/app/AppShell.tsx`, item com `prefixosAtivos`, e `src/app/paginas/Marketing.tsx`), cobrindo hoje Segmentos + Campanhas — era essa a decisão que este spec deixava pendente. `captura-leads` entra no mesmo grupo: acrescentar `/captura` a `prefixosAtivos` e um terceiro card em `Marketing.tsx`.

## Testing Strategy

pgTAP (`supabase/tests/captura_leads.sql`):
- Isolamento multiempresa nas 3 tabelas novas (padrão).
- RLS: `token_hash` nunca aparece em nenhum `select` de `authenticated`, mesmo gestor.
- `submeter_formulario`: cria contato `lead` com `origem='formulario'`, UTM preenchido, responsável certo pra `fixo` e pra `rodizio` (chamar 3x com 3 membros, provar que roda os 3 antes de repetir).
- `receber_lead_webhook`: token certo cria o lead; token errado/revogado lança `42501`; `ultimo_uso_em` atualiza.
- `obter_pagina_captura_publica`: devolve só as colunas esperadas, nada de `empresa_id` de outra empresa vaza por slug adivinhado.

Sem teste Vitest de lógica pura nova relevante (a lógica de negócio mora nas funções SQL, testada via pgTAP).

## Boundaries

- **Sempre:** `token_hash` gerado com `sha256`; token em claro só sai uma vez, na criação; toda escrita pública passa por `receber_lead`, nunca `insert` direto em `contatos` liberado pra `anon`.
- **Perguntar antes:** adicionar rate limit/CAPTCHA (fica pra quando houver sinal de abuso real — ver "Decisões fechadas" acima); mudar `integracoes.tipo` pra incluir Meta Lead Ads (é a próxima fase, não esta).
- **Nunca:** expor `token_hash` em qualquer resposta de API depois da criação; abrir `select` de `anon` direto em `empresas`/`contatos`; pular a checagem de `formulario.ativo`/`pagina.ativo`/`integracao.ativo` (uma URL desativada continua existindo, só para de aceitar escrita).

**Nota de processo:** este módulo mexe em RLS e cria um webhook público autenticado por token — `CLAUDE.md` marca isso como uso obrigatório da skill `security-check` antes de considerar o módulo pronto pra produção. Rodar na Fase 4 (Tasks) antes do merge, não só no final da Fase 3 inteira.

## Success Criteria

- Migration aplicada, `npm run db:types` limpo, pgTAP cobrindo os 5 pontos acima.
- Preencher um formulário em `/f/...` sem estar logado cria um `contato` visível na lista de Contatos, com notificação chegando ao responsável certo (rodízio e fixo, testado manualmente uma vez cada).
- `curl` com token válido contra `receber_lead_webhook` cria lead; com token errado, recebe erro claro.
- `security-check` rodado e sem pendência ALTA aberta.

## Open Questions

Nenhuma pendente — as duas decisões de arquitetura (mecanismo do webhook, ausência de anti-abuso nesta fase) foram fechadas com o usuário antes deste spec.

## Correções aplicadas na implementação

Além das 2 correções de FK composta/nav já registradas acima (aplicadas em 2026-09-23, antes de codar), a exploração ao escrever as funções encontrou mais 4:

1. **`obter_pagina_captura_publica` virou `security definer`**, não `invoker` como o spec propunha — `anon` não tem nenhuma policy de select em `paginas_captura`/`empresas` (só `to authenticated`); invoker rodando como `anon` sempre devolveria zero linhas pra um visitante de verdade.
2. **`obter_formulario_publico` é função nova**, ausente do spec — a rota `/f/:empresaSlug/:formularioId` não tinha nenhuma função pública equivalente à de `/p/...`.
3. **`token_hash` nunca exposto por REVOKE de coluna**, não só pela convenção de view que o spec sugeria (`membros_empresa` existe pra juntar tabelas sem FK direta, não pra esconder coluna — uma view não impede consulta direta na tabela base).
4. **CHECK novo:** `distribuicao_tipo='fixo'` exige `responsavel_fixo_id` preenchido, em `formularios` e `integracoes`.
5. **`definir_slug_empresa` é função nova**, ausente do spec — a única policy de UPDATE em `empresas` é `dono`-only; um gestor não conseguiria configurar a URL pública da própria empresa sem essa função dedicada.

**`security-check` rodado** (2026-09-23) — 1 médio, corrigido antes de fechar: `submeter_formulario` checava `ativo` mas não `deleted_at` — um formulário "excluído" (soft delete) continuava aceitando submissão de quem já tivesse o `formulario_id` salvo, mesmo tendo sumido da lista e do embed público. Corrigido e coberto por pgTAP. Confirmado sem findings adicionais: nenhum caminho de escrita pública escapa de `receber_lead`, token com 256 bits de entropia, RPCs públicas não vazam mais que o pretendido, sem XSS nos campos de branding renderizados.

**259/259 pgTAP** (227 anteriores + 32 novos deste módulo — as 2 falhas de `notificacoes.sql` são pré-existentes, não relacionadas); `lint`/`typecheck`/`test`/`build` limpos. Teste no navegador ainda pendente de confirmação do usuário.
