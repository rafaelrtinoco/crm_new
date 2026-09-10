# 0001 — Isolamento multiempresa via RLS + funções `security definer`

## Status

Aceita — incremento 1A.

## Contexto

Toda tabela de dados do Facility precisa garantir que um usuário de uma empresa nunca leia, altere ou apague dados de outra empresa (regra de ouro do `CLAUDE.md`). A política de RLS mais natural para `empresa_membros` — "sou membro se existir uma linha em `empresa_membros` para mim" — consulta a própria `empresa_membros` dentro da política de `empresa_membros`, o que o Postgres rejeita com `infinite recursion detected in policy for relation "empresa_membros"`.

## Decisão

Três funções auxiliares, criadas em `20260910200245_extensoes_e_helpers.sql`, encapsulam toda checagem de pertencimento/papel:

- `is_membro(empresa_id)` — o usuário atual pertence à empresa.
- `tem_papel(empresa_id, papel)` — hierárquico: `dono` satisfaz `gestor`, que satisfaz `usuario`.
- `carteira_compartilhada(empresa_id)` — lê a flag da empresa.
- `pode_acessar_responsavel(empresa_id, responsavel_id)` — combina as três acima no predicado padrão de tabelas com "responsável" (contatos, vencimentos, negócios, tarefas): gestor/dono vê tudo, carteira compartilhada abre pra todo mundo, senão só quem é responsável. Mesmo predicado para leitura e escrita (`using` e `with check` idênticos).

Todas são `language sql stable security definer set search_path = ''`, com `revoke all ... from public` seguido de `grant execute ... to authenticated`. `security definer` faz a função rodar como o dono (que não sofre RLS), evitando a recursão. `search_path = ''` bloqueia sequestro de função por schema; por isso todo nome dentro do corpo é `public.<algo>` ou `auth.<algo>`, nunca sem qualificação.

Tabelas de configuração compartilhada (tags, funis, etapas, tipos de vencimento, motivos de perda, campos personalizados) usam um padrão mais simples: qualquer membro lê (`is_membro`), só gestor+ escreve (`tem_papel(..., 'gestor')`) — mudar essas tabelas afeta a empresa inteira, então a fasquia de permissão é mais alta que a de "ver meus próprios contatos". Isso é uma decisão de produto tomada por mim (Claude) sem confirmação explícita do PRD, que não detalha quem pode criar tag/funil; revisável quando o dono do produto quiser.

## Consequências

- Nenhuma policy usa `using (true)` exceto `nicho_templates` (dado global, comentário explícito na migration justificando).
- Toda tabela nova que precisar do padrão "responsável" só precisa chamar `pode_acessar_responsavel(empresa_id, responsavel_id)` — não reescrever a lógica.
- `empresas` não tem policy de `insert`: criar a primeira empresa + primeiro membro "dono" é um problema de bootstrap (não há membro ainda para autorizar a si mesmo). Fica para uma função `security definer` de onboarding na Fase 1B.
- Os testes pgTAP em `supabase/tests/` são o portão de aceite: se `npm run test:db` falhar, a tabela não está pronta — não importa o resto.
