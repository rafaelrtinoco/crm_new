# Spec: `configuracoes` — fatia 1 (Empresa)

Fora do capability map da Fase 3 (fechado). Recorte de PRD §6.15 (Configurações da
empresa), pedido do usuário depois de auditar o que ficou pendente entre fases. Sem
dependência de módulo novo — só de `empresas`, já existente desde a fundação.

## Objetivo

Dar a um gestor/dono o controle, pela interface, sobre os dados da própria empresa que
hoje só nascem uma vez em `aplicar_template()` (onboarding) e nunca mais podem ser
mudados: nome, fuso, horário comercial, slug, logo e cor primária.

**Por que agora, e não junto de outra coisa:** dois recursos do produto já dependem de
campos que ninguém consegue editar.
1. `processar_fila_envios` reagenda mensagem fora de `dentro_horario_comercial` (fila-envios,
   `20260916192944_fila_envios.sql`) — uma empresa com horário diferente do padrão do
   template (`seg_sex 08:00–18:00`, sáb/dom fechado) fica presa a ele.
2. `logo_url`/`cor_primaria` já são lidos e renderizados por `obter_pagina_captura_publica`/
   `PaginaCapturaPublica.tsx` (captura-leads), mas nunca foram preenchidos por nada — é
   recurso morto desde que foi escrito.

**Não é:** editor de `vocabulario` (rótulos de nicho — fatia futura própria, é o coração da
regra "nada de nicho fixo no código"); tela de equipe/papéis (fatia 3, bloqueada por um
furo de RLS — ver Boundaries); CRUD de funis/etapas/tipos de vencimento/campos
personalizados/motivos de perda (fatia 2 — RLS já pronta, só falta UI).

## Mapa das três fatias (registrado aqui pra não se perder; só a 1 entra nesta rodada)

| Fatia | Escopo | Bloqueio |
|---|---|---|
| **1 — Empresa** (esta) | nome, fuso, horário comercial, slug, logo, cor primária, carteira compartilhada | nenhum |
| 2 — Núcleo | CRUD de funis/etapas, tipos de vencimento, campos personalizados, tags, motivos de perda | nenhum (RLS `*_gestor_escreve` já existe desde `20260910200256_nucleo.sql`); `useVencimentoTipos`/`useCamposPersonalizados`/`useTags` não filtram `deleted_at` no client — corrigir antes de expor exclusão |
| 3 — Equipe | trocar papel de membro, remover membro | `empresa_membros_gestor_escreve` é `FOR ALL` pra gestor — hoje nada na UI alcança isso; expor sem guarda deixaria um gestor promover a si mesmo a `dono` ou rebaixar o dono atual |

## Assunções

1. **Só `gestor`/`dono` acessam** — item de menu invisível pra usuário comum; rota
   redireciona; toda escrita valida `tem_papel(..., 'gestor')` no banco (guard de cliente é
   só UX, mesma nota de `Convidar.tsx`).
2. **`carteira_compartilhada` fica fora da RPC nova** — muda quem lê contato de quem
   (`pode_acessar_responsavel`, usada pela RLS de `contatos`/`vencimentos`/`negocios`/
   `tarefas`/`fila_envios`/`campanhas`), risco maior que os outros campos. Continua
   `dono`-only, pela policy `empresas_update_dono` já existente — sem RPC nova, `.update()`
   direto, campo só renderizado quando `papel === "dono"`.
3. **`slug` continua por `definir_slug_empresa`** (já existe, `captura_leads.sql:67`) —
   não duplicado na função nova; a tela chama as duas RPCs.
4. **Logo via Supabase Storage**, bucket público `logos` — decisão do usuário (não campo de
   URL solto). Primeira vez que o projeto usa Storage.
5. **`vocabulario` fora desta fatia** — nenhuma tela mexe nele ainda; segue só o que
   `aplicar_template()` gravou no onboarding.

## Modelo de dados

Sem tabela nova. `empresas` já tem todas as colunas (`nome`, `fuso`, `horario_comercial`,
`logo_url`, `cor_primaria`, `slug`, `carteira_compartilhada`) desde
`20260910200245_extensoes_e_helpers.sql`. Bucket novo de Storage: `logos` (público, path
`{empresa_id}/<arquivo>`, conforme `.claude/rules/Supabase.md`).

## Banco

### `atualizar_configuracoes_empresa`

```sql
atualizar_configuracoes_empresa(
  p_empresa_id uuid, p_nome text, p_fuso text,
  p_horario_comercial jsonb, p_logo_url text, p_cor_primaria text
) returns void
```

`security definer` (mesmo motivo de `definir_slug_empresa`: `authenticated` não tem UPDATE
em `empresas` pra gestor, só `dono` pela policy nativa), `set search_path = ''`. Primeira
linha: `if not tem_papel(p_empresa_id, 'gestor') then raise exception`. `revoke all from
public` + `grant execute to authenticated`.

### Trigger de validação em `empresas`

Validar só dentro da RPC não basta — `dono` grava direto em `empresas` pela policy nativa
`empresas_update_dono` e escaparia de qualquer checagem só-da-função. `before insert or
update on public.empresas`, cobrindo os dois caminhos:

- `fuso` precisa existir em `pg_timezone_names` (fuso inválido faz
  `dentro_horario_comercial` estourar em runtime dentro do worker do `pg_cron`).
- `horario_comercial` precisa ter exatamente as chaves `seg_sex`/`sab`/`dom`, cada uma
  `null` ou array de 2 strings `HH:MM` com início < fim.
- `cor_primaria` `null` ou hex `^#[0-9A-Fa-f]{6}$`.

### Bucket `logos`

- `insert into storage.buckets (id, name, public) values ('logos', 'logos', true) on
  conflict (id) do nothing` — público porque a página de captura é anônima.
- Policies em `storage.objects` (`bucket_id = 'logos'`): insert/update/delete só quando
  `tem_papel((storage.foldername(name))[1]::uuid, 'gestor')`, com guarda de formato de
  uuid antes do cast (objeto malformado deve ser negado, não estourar a avaliação da
  policy). Leitura pública, sem policy de select (bucket já é `public = true`).
- `allowed_mime_types`: `image/png`, `image/jpeg`, `image/webp` — **sem SVG**, servido de
  bucket público é vetor de XSS quando aberto direto pela URL. Limite de tamanho: 2 MiB
  (logo, não banner).

## Frontend

`src/features/configuracoes/` (slice novo):
- `logica/horarioComercial.ts` — conversão pura `jsonb ↔ estado do formulário` e validação
  de início < fim (mesmas regras do trigger). Testado em Vitest co-localizado.
- `schemas.ts` — Zod espelhando o trigger (fuso, janelas, hex da cor).
- `api/useConfiguracoesEmpresa.ts`:
  - `useEmpresa(empresaId)` — leitura, `queryKey: ["empresa", empresaId]`.
  - `useAtualizarEmpresa()` — chama a RPC nova.
  - `useDefinirSlug()` — chama `definir_slug_empresa` (já existe).
  - `useAlternarCarteiraCompartilhada()` — `.update()` direto em `empresas`, só exposto ao
    `dono`.
  - `useUploadLogo()` — `supabase.storage.from("logos").upload(...)`, resolve
    `publicUrl`, grava via `useAtualizarEmpresa`.
- `components/CampoHorarioComercial.tsx` — três linhas (seg-sex/sáb/dom), toggle "fechado"
  + dois horários cada.
- `components/CampoLogo.tsx` — prévia, input de arquivo, upload, remover.
- `paginas/ConfiguracoesEmpresa.tsx` — formulário, `max-w-2xl` (largura padrão de
  formulário de coluna única no projeto).
- `src/app/paginas/Configuracoes.tsx` — índice do grupo, molde de `Marketing.tsx`; nesta
  fatia só um card ("Empresa") — sem link morto pras fatias 2/3, mesma regra que o 1D-1
  seguiu com Funis/Tarefas antes de essas telas existirem.

## Navegação

- `router.tsx`: `/configuracoes` (índice) e `/configuracoes/empresa`, dentro do `AppShell`.
- `AppShell.tsx`: `<DropdownMenuItem disabled>Configurações</DropdownMenuItem>` (linha 167,
  reservado desde o 1D-1) vira link ativo, renderizado só quando `papel !== "usuario"`.
- Guard de página: usuário comum é redirecionado pra `/` — mesma nota de `Convidar.tsx`
  ("o guard de papel aqui é só UX; quem protege de verdade é a RLS/RPC").

## Code Style

Mesmo padrão de `useSegmentos.ts`/`Marketing.tsx`/`Convidar.tsx` já usados no projeto:
hooks TanStack Query com `queryKey` incluindo `empresaId`, React Hook Form + Zod, guard de
papel client-side documentado como UX-only. Nomes em português espelhando o banco.

## Testing Strategy

pgTAP novo em `supabase/tests/configuracoes_empresa.sql`:
- Gestor da Alfa atualiza `atualizar_configuracoes_empresa` e o valor muda.
- Usuário comum da Alfa recebe exceção (`42501` ou a exceção custom da função).
- Gestor da Beta não altera a Alfa (isolamento multiempresa, obrigatório por
  `.claude/rules/Supabase.md`).
- Fuso inválido rejeitado pelo trigger.
- `horario_comercial` malformado (chave faltando, horário fora do formato, início >= fim)
  rejeitado pelo trigger.
- **`dono` escrevendo direto em `empresas`** (sem passar pela RPC) também é barrado pelo
  trigger — prova que a validação não ficou só do lado da função.
- Policies do bucket `logos`: gestor insere na própria pasta (`{empresa_id}/...`); usuário
  de outra empresa não insere na pasta alheia; objeto com pasta que não é uuid é negado sem
  estourar a avaliação da policy.

Vitest para `logica/horarioComercial.ts`.

`security-check` obrigatório (CLAUDE.md: mudança em RLS/auth) — superfícies novas: função
`security definer`, trigger em `empresas`, bucket público e policies de Storage.

## Boundaries

- **Sempre:** validação de `fuso`/`horario_comercial`/`cor_primaria` no trigger da tabela,
  não só na RPC — cobre os dois caminhos de escrita (`dono` direto, gestor via função).
- **Sempre:** guard client-side de papel documentado como UX-only, nunca única proteção.
- **Perguntar antes:** expor `carteira_compartilhada` pra gestor (hoje `dono`-only, decisão
  deliberada — muda quem lê contato de quem); começar as fatias 2/3 sem revisão própria.
- **Nunca:** afrouxar `empresas_update_dono` pra cobrir mais colunas em vez de criar função
  dedicada — é a armadilha que `definir_slug_empresa` já evitou uma vez; aceitar SVG no
  bucket `logos` (vetor de XSS em bucket público).

## Success Criteria

- `npm run db:reset && npm run db:types && npm run test:db` limpos, incluindo
  `configuracoes_empresa.sql` novo.
- `npm run lint && npm run typecheck && npm run test && npm run build` limpos.
- No navegador, como gestor: mudar horário comercial pra uma janela já encerrada, disparar
  campanha de WhatsApp, e ver em `fila_envios` que a mensagem foi **reagendada** (não
  bloqueada) pro próximo horário — fecha o bug original desta fatia. Subir logo + cor e
  conferir que aparecem em `/p/{slug}/{pagina}` **sem sessão** (aba anônima).
- Como usuário comum: item "Configurações" não aparece no menu; URL direta redireciona.
- Como dono: toggle de carteira compartilhada aparece (some pra gestor).
- `security-check` rodado, sem crítico/alto pendente.

## Open Questions

Nenhuma — recorte, acesso (só gestor+) e forma do logo (upload via Storage) já fechados
com o usuário via `AskUserQuestion` antes deste documento.

## Correções aplicadas na implementação (2026-09-25)

**Implementado.** `supabase/migrations/20260925130602_configuracoes_empresa.sql`.

1. **Bug real, não relacionado, corrigido antes de começar (Passo 0 do plano):**
   `supabase/tests/notificacoes.sql` falhava 2/10 desde 16/09. A causa raiz era dupla —
   corrigida em `supabase/migrations/20260925130243_corrige_idempotencia_notificacoes_diarias.sql`
   (`create or replace function`, não migration da tabela): (a) a checagem de idempotência
   comparava `created_at::date` (fuso da sessão) contra `v_hoje` (fuso da empresa); (b)
   mais grave, `notificacoes.created_at` usava `default now()` (relógio real), enquanto o
   resto da função deriva de `p_agora` — qualquer chamada com `p_agora` distante do
   relógio real (exatamente o caso de uso que o parâmetro existe pra permitir) duplicava a
   notificação, porque a segunda chamada não encontrava o registro criado com `created_at`
   do relógio real. Corrigido gravando `created_at = p_agora` explicitamente. Sem impacto
   em produção (onde `p_agora` já é `now()` por padrão).
2. **`p_logo_url`/`p_cor_primaria` como `string` (não `string | null`) no tipo gerado.** O
   gerador de tipos do Supabase não marca parâmetro de função `plpgsql` como nullable, só o
   tipo base — mesmo a RPC aceitando `null` de verdade (colunas são nullable). Contornado
   com um cast pontual e comentado em `useAtualizarConfiguracoesEmpresa`, sem mudar a RPC.
3. **Slug reaproveita o hook existente, não duplica.** `useDefinirSlugEmpresa` já existia em
   `src/features/captura/api/usePaginasCaptura.ts` (criado no módulo `captura-leads`,
   usado em `ListaPaginasCaptura.tsx`). A tela de Configurações/Empresa importa esse hook
   direto (cross-slice, mesmo padrão de outros `api/` já reusados entre slices) em vez de
   recriar a chamada à RPC `definir_slug_empresa`.
4. **Fusos horários: primeira vez que o produto deixa alguém escolher.** Nenhuma tela
   anterior editava `fuso` (nasce fixo em `America/Sao_Paulo` pelo default da coluna, via
   onboarding). Curadoria de 15 fusos oficiais do Brasil em
   `src/features/configuracoes/logica/fusos.ts` — o trigger aceita qualquer fuso de
   `pg_timezone_names`, a lista é só curadoria do seletor, não restrição de banco.

`security-check` rodado — 0 crítico/alto/médio, 2 info aceitos (ver auditoria: `logo_url`
sem validação de formato, mesmo padrão já existente em `paginas_captura.imagem_url`; sem
limite de tamanho em `nome`, consistente com o resto do schema).

`npm run db:reset && npm run db:types && npm run test:db` (291/291, primeira vez limpo
desde 16/09) / `npm run lint && npm run typecheck && npm run test` (40/40 Vitest) /
`npm run build` confirmados limpos nesta sessão. **Testado no navegador pelo usuário —
funcionou.**
