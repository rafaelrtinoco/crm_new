# Spec: `campanhas` (Fase 3 recortada)

Módulo 4 de 5 do `docs/fase3/CAPABILITY-MAP.md`. Depende de `fila-envios` (todo envio sai por ali) e `segmentos` (todo público-alvo vem de lá). PRD §6.9; ADR 0004 (WhatsApp entra contra provider mock, sem conexão real com a Meta).

## Objetivo

Disparo de mensagens em massa (e-mail ou WhatsApp) pra um segmento salvo, com prévia, agendamento e métricas — sem nenhuma mensagem real saindo nesta fase (`EmailProvider`/`WhatsAppProvider` mock, herdado de `fila-envios`/ADR 0005). Uma campanha não implementa checagem própria de consentimento/opt-out/horário comercial — delega inteiramente pra `fila-envios`, que já é a autoridade única disso.

## Assunções

1. **Uma campanha, um canal.** PRD lista WhatsApp e e-mail como opções de canal da campanha, não como algo simultâneo numa campanha só — mandar nos dois canais é duas campanhas.
2. **Editor de e-mail "simples com blocos"** = lista ordenada de blocos `texto`/`imagem` (sem drag-and-drop visual nem HTML livre) — o mínimo que atende "editor com blocos" do PRD sem construir um page builder.
3. **"Negócios gerados em até X dias"** (métrica) — janela fixa de 30 dias nesta fase, não configurável por campanha. Revisar se o usuário quiser ajustar por campanha.
4. **Entregue/lido ficam sempre vazios nas métricas**, herdado da decisão de `fila-envios` (mock só confirma "enviada") — a UI de métricas mostra esses dois como "—", não como zero, pra não parecer que a mensagem foi confirmadamente não-entregue.

## Modelo de dados

```sql
create table public.templates_mensagem (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  nome text not null,
  canal text not null check (canal in ('whatsapp','email')),
  conteudo text not null, -- com {{variavel}}; pra email, é o corpo-base fora do editor de blocos (ver campanhas.blocos)
  variaveis jsonb not null default '[]'::jsonb, -- nomes esperados, pra validar preview
  status text not null default 'rascunho' check (status in ('rascunho','aprovado')), -- 'aprovado' simula aprovação Meta no mock
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  deleted_at timestamptz
);

create table public.campanhas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  nome text not null,
  canal text not null check (canal in ('whatsapp','email')),
  segmento_id uuid not null, -- FK composta (empresa_id, segmento_id) -> segmentos
  template_id uuid, -- obrigatório se canal='whatsapp'; FK composta -> templates_mensagem
  assunto text, -- só email
  blocos jsonb not null default '[]'::jsonb, -- só email: [{tipo:'texto'|'imagem', conteudo:'...'}]
  status text not null default 'rascunho' check (
    status in ('rascunho','agendada','enviando','concluida','cancelada')
  ),
  agendado_para timestamptz, -- null = dispara na confirmação, sem esperar cron
  disparada_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  deleted_at timestamptz,
  check (canal <> 'whatsapp' or template_id is not null)
);

create table public.campanha_envios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  campanha_id uuid not null, -- FK composta -> campanhas
  contato_id uuid not null, -- FK composta -> contatos
  fila_envios_id uuid not null, -- FK composta -> fila_envios (1:1 — cada linha de campanha_envios tem exatamente uma linha na fila)
  created_at timestamptz not null default now(),
  unique (empresa_id, campanha_id, contato_id)
);
```

Todas as três seguem o padrão de FK composta por `empresa_id` da ADR 0003. RLS: mesmo grupo de `segmentos` — qualquer membro lê, só gestor+ escreve/dispara (mandar campanha em massa é uma ação de risco equivalente a mudar configuração da empresa inteira).

## Funções

- **`disparar_campanha(p_campanha_id uuid) returns void`** — `security invoker` (quem chama precisa poder escrever a campanha, então já é gestor+ pela RLS). Valida `status in ('rascunho','agendada')`; se `canal='whatsapp'`, exige `template_id` com `status='aprovado'`. Muda `status='enviando'`, `disparada_em=now()`; chama `avaliar_segmento(segmento_id)` (módulo `segmentos`) e, pra cada `contato_id`, chama `enfileirar_envio(...)` (módulo `fila-envios`) com `origem_tipo='campanha'`, `origem_id=p_campanha_id`, `chave_idempotencia='campanha:'||p_campanha_id||':contato:'||contato_id`, `conteudo` resolvido (template com variáveis substituídas, ou `blocos` renderizado pra texto simples no caso e-mail) — variável sem valor **bloqueia só aquele contato** (grava em `campanha_envios` mas a linha de fila nasce com motivo de bloqueio, não trava a campanha inteira). Cria a linha correspondente em `campanha_envios`.
- **`disparar_campanhas_agendadas(p_agora timestamptz default now()) returns void`** — `security definer`, chamada pelo mesmo `pg_cron` a cada minuto (extensão do agendamento já criado em `fila-envios`, ver ADR 0005): varre `campanhas` com `status='agendada' and agendado_para <= p_agora`, chama `disparar_campanha` pra cada uma.
- **`atualizar_status_campanhas() returns void`** — chamada em seguida a `processar_fila_envios()` no mesmo `cron.schedule` (fila-envios): campanha em `enviando` sem nenhuma linha de `fila_envios` associada ainda `pendente` vira `concluida`.
- **`metricas_campanha(p_campanha_id uuid) returns table (enviados bigint, entregues bigint, lidos bigint, bloqueados bigint, optouts bigint, negocios_gerados bigint)`** — `security invoker`. `entregues`/`lidos` sempre `0`, documentado como limitação do mock (ver Assunções). `negocios_gerados` conta `negocios` cujo `contato_id` está em `campanha_envios` dessa campanha e `created_at` caiu nos 30 dias após o envio daquele contato.
- **`preview_campanha(p_campanha_id uuid) returns table (contato_id uuid, conteudo_resolvido text)`** — usa `prever_contato_segmento` (módulo `segmentos`) + resolve variáveis contra aquele contato real, sem gravar nada — é a "prévia com dados reais" do PRD.

## Frontend

`src/features/campanhas/` (slice novo):
- `api/` — `useCampanhas`/`useCampanha`, `useMutacoesCampanha` (criar/editar/cancelar — sem excluir campanha já disparada, só cancelar), `useDispararCampanha`, `usePreviewCampanha`, `useMetricasCampanha`, `useTemplates`/`useMutacoesTemplate`.
- `components/EditorBlocos.tsx` (lista ordenada de blocos texto/imagem — reordenar, adicionar, remover), `SeletorTemplate.tsx` (só pra canal WhatsApp), `CardMetricasCampanha.tsx`.
- `paginas/ListaCampanhas.tsx`, `FormularioCampanha.tsx` (escolhe canal → segmento → template ou blocos → agendar ou enviar agora, com preview antes de confirmar disparo — confirmação explícita, ação irreversível), `DetalheCampanha.tsx` (métricas + lista de `campanha_envios` com status/motivo de bloqueio, útil pra depurar "por que não enviou pra fulano"), `ListaTemplates.tsx`, `FormularioTemplate.tsx`.
- Rotas novas: `/campanhas`, `/campanhas/novo`, `/campanhas/:id`, `/campanhas/:id/editar`, `/campanhas/templates*`. **Decisão de navegação final**: os itens de `segmentos`, `captura-leads` e `campanhas` se agrupam sob um item de nav "Marketing" no `AppShell` (submenu ou página índice) — fecha a pendência de IA adiada nos dois specs anteriores.

## Testing Strategy

pgTAP (`supabase/tests/campanhas.sql`):
- Isolamento multiempresa nas 3 tabelas novas.
- RLS: membro comum lê, não dispara; gestor dispara.
- `disparar_campanha` WhatsApp sem template aprovado → erro explícito, nada é enfileirado.
- `disparar_campanha` enfileira exatamente os contatos que `avaliar_segmento` retorna, com `chave_idempotencia` correta (chamar duas vezes não duplica `fila_envios`, mesma garantia do módulo `fila-envios`).
- Variável sem valor bloqueia só aquele contato, não a campanha inteira.
- `metricas_campanha`: cenário fim-a-fim (segmento com 3 contatos, 1 sem consentimento, 1 com opt-out, 1 ok) → `bloqueados`/`optouts`/`enviados` batem.
- `disparar_campanhas_agendadas`/`atualizar_status_campanhas` com `p_agora` como parâmetro (mesmo padrão determinístico de `gerar_notificacoes_diarias`/`processar_fila_envios`).

## Boundaries

- **Sempre:** disparo passa por `enfileirar_envio`, nunca grava direto em `fila_envios`; confirmação explícita na UI antes de `disparar_campanha` (ação em massa, sem desfazer).
- **Perguntar antes:** mudar a janela de 30 dias de `negocios_gerados` pra configurável por campanha; permitir excluir (não só cancelar) campanha já disparada.
- **Nunca:** duplicar a checagem de consentimento/opt-out/horário comercial aqui — isso é responsabilidade só de `fila-envios`; se este módulo achar que precisa reimplementar alguma dessas checagens, é sinal de que `fila-envios` está com a interface errada, não que `campanhas` deve compensar.

## Success Criteria

- Migration aplicada, `npm run db:types` limpo, pgTAP cobrindo os cenários acima.
- Criar uma campanha de e-mail pra um segmento de teste, ver a prévia com dado real, disparar, e ver as linhas aparecerem em `fila_envios` e serem processadas pelo worker existente (sem mudar nada em `fila-envios`) — validado no navegador.
- Mesma coisa pra WhatsApp, com template aprovado.
- `security-check` rodado (campanha em massa é uma superfície de risco — mesmo raciocínio de `captura-leads`, ainda que sem endpoint público novo aqui).

## Open Questions

Nenhuma pendente — as assunções da seção acima ficam sujeitas à revisão deste spec, mas nenhuma delas é uma bifurcação de arquitetura (diferente das decisões dos módulos anteriores).
