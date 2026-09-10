---
paths:
  - "supabase/**"
---

# Banco, RLS e Edge Functions

## Checklist de tabela nova

1. `make migration name=<descricao>`.
2. Colunas padrão: `id uuid default gen_random_uuid()`, `empresa_id uuid not null references empresas`, `created_at`, `updated_at`, `created_by`; `deleted_at` nas entidades principais.
3. `enable row level security` + políticas com `is_membro(empresa_id)` / `tem_papel(empresa_id, papel)`. Nunca `using (true)`.
4. Índice em `empresa_id` e compostos para filtros frequentes (ex.: `(empresa_id, data_vencimento)`).
5. Trigger de `updated_at`.
6. Teste pgTAP em `supabase/tests/` provando que um usuário de outra empresa não lê, insere, altera nem apaga.
7. `make db-reset && make db-types && make test-db`.

## Convenções de schema

- Tabelas no plural, `snake_case` em português (`contatos`, `vencimentos`); FKs como `<entidade>_id`.
- Status e tipos fixos como `text` + `check` (mais fácil de evoluir que enum).
- Dinheiro em `numeric(12,2)`; datas de calendário em `date`; eventos em `timestamptz`.
- Funções `security definer` só quando indispensável, com `set search_path = ''` e checagem explícita de `empresa_id`.
- Views com `security_invoker = true` para respeitar a RLS.
- Storage organizado em `{empresa_id}/...`, com políticas por pasta.
- Templates de nicho são dados globais (sem `empresa_id`), somente leitura para usuários comuns.

## Edge Functions

- Código compartilhado em `supabase/functions/_shared/` (providers, cliente admin, schemas Zod).
- Webhooks: validar assinatura ou token antes de processar; idempotência pelo ID externo (unique constraint); responder rápido e mandar o trabalho pesado para a fila.
- Com `service_role` a RLS não protege: toda query filtra `empresa_id` explicitamente.
- Logs com `empresa_id` e ID de correlação; nunca registrar conteúdo de mensagens nem dados pessoais completos.