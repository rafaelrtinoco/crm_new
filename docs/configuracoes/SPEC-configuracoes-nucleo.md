# Spec: `configuracoes` — fatia 2 (Núcleo)

Continuação de `docs/configuracoes/SPEC-configuracoes-empresa.md` (fatia 1, implementada).
PRD §6.15. Sem dependência de módulo novo — todas as tabelas (`funis`, `etapas`,
`vencimento_tipos`, `campos_personalizados`, `tags`, `motivos_perda`) existem desde
`20260910200256_nucleo.sql`.

## Objetivo

CRUD pra seis entidades de configuração que hoje só nascem uma vez em `aplicar_template()`
(onboarding) e nunca mais podem ser mudadas pela interface: funis e suas etapas, tipos de
vencimento, campos personalizados, tags e motivos de perda. A RLS de escrita (`*_gestor_escreve`,
`FOR ALL`, gestor+; `tags_membro`, qualquer membro) já existe pra todas desde a fundação —
o trabalho real é a UI, mais duas correções de banco que a exploração encontrou antes de
qualquer tela existir pra expô-las.

## Achados antes de codar

1. **Quatro hooks de leitura não filtram `deleted_at`.** `useVencimentoTipos`,
   `useCamposPersonalizados`, `useTags`, `useMotivosPerda` — só `useFunis`/`useEtapas`
   filtram certo. Sem tela de exclusão, isso nunca importou; com uma, um item "excluído"
   continuaria aparecendo nos seletores de contato/vencimento/negócio. Corrigido nesta
   rodada, nos quatro hooks.
2. **`unique(empresa_id, nome)` (e variantes) são constraints simples, não índices
   parciais.** Diferente do padrão que a ADR 0003 já estabeleceu pra CPF/CNPJ de
   `contatos` (`soft_delete_e_dedup.sql`), as seis tabelas de núcleo nunca precisaram de
   índice parcial porque nada excluía essas linhas até agora. Com exclusão liberada pela
   UI, excluir um funil "Vendas Diretas" e tentar criar outro com o mesmo nome falharia
   pra sempre (a linha excluída continua reservando o nome). Corrigido convertendo as 6
   constraints (`funis_empresa_id_nome_key`, `etapas_funil_id_nome_key`,
   `vencimento_tipos_empresa_id_nome_key`, `motivos_perda_empresa_id_nome_key`,
   `tags_empresa_id_nome_key`, `campos_personalizados_empresa_id_entidade_chave_key`) em
   índices únicos parciais `where deleted_at is null`.

## Decisão fechada com o usuário

**Excluir é uma ação só, bloqueada quando o item está em uso** (não duas ações
"desativar"/"excluir"). `funis`/`vencimento_tipos`/`motivos_perda` têm uma coluna `ativo`
que nenhuma tela jamais escreveu — fica de fora desta rodada, é dívida técnica registrada
aqui, não um recurso "pausar sem excluir" ativado agora. Se um dia fizer sentido expor
"desativar" como conceito próprio (parar de oferecer um funil pra negócio novo sem apagar
histórico), é uma decisão nova, não implícita neste spec.

O bloqueio de uso é reforçado no banco (trigger), não só no cliente — mesmo raciocínio do
trigger de `empresas` da fatia 1: quem escreve direto (`.update()` do RLS `FOR ALL`) não
pode escapar da checagem.

## Modelo de dados

Sem tabela nova. Migration só ajusta as 6 tabelas existentes:

```sql
-- por tabela: drop da constraint simples, cria índice único parcial
alter table public.funis drop constraint funis_empresa_id_nome_key;
create unique index funis_empresa_id_nome_key on public.funis (empresa_id, nome) where deleted_at is null;
-- ... mesma forma pras outras 5
```

## Banco — triggers de bloqueio de uso

Um trigger por tabela referenciada por FK, `before update ... when (NEW.deleted_at is not
null and OLD.deleted_at is null)`, checando linhas **não excluídas** que referenciam o
registro:

| Tabela | Checa | Contra |
|---|---|---|
| `funis` | `negocios.funil_id = OLD.id` | `negocios.deleted_at is null` |
| `etapas` | `negocios.etapa_id = OLD.id` | `negocios.deleted_at is null` |
| `motivos_perda` | `negocios.motivo_perda_id = OLD.id` | `negocios.deleted_at is null` |
| `vencimento_tipos` | `vencimentos.vencimento_tipo_id = OLD.id` | `vencimentos.deleted_at is null` |
| `tags` | `contato_tags.tag_id = OLD.id` (join com `contatos` pelo `contato_id`) | `contatos.deleted_at is null` |

**`campos_personalizados` fica de fora do bloqueio.** O valor de um campo personalizado
vive dentro de `contatos.campos`/`vencimentos.campos` (jsonb, sem FK) — checar uso exigiria
varrer a tabela inteira por uma chave dentro do jsonb, sem índice, numa ação de admin de
baixa frequência. Custo/benefício não fecha nesta rodada; excluir um campo personalizado
em uso continua "silencioso" (o dado antigo persiste no jsonb do contato, só some de
formulários/segmentos novos) — mesmo comportamento de hoje, só que agora alcançável pela
UI. Registrado como boundary, não como bug.

Sem RPC nova — todo CRUD é `.insert()/.update()` direto do client contra a RLS `*_gestor_escreve`/
`tags_membro` que já existe, mesmo padrão de `useSegmentos.ts`.

## Frontend

`src/features/configuracoes/` (mesma slice da fatia 1), hooks novos em
`api/useFunisConfig.ts`, `api/useEtapasConfig.ts`, `api/useVencimentoTiposConfig.ts`,
`api/useCamposPersonalizadosConfig.ts`, `api/useTagsConfig.ts`, `api/useMotivosPerdaConfig.ts`
(nomeados `*Config` pra não colidir com os hooks de leitura já existentes em
`funis`/`vencimentos`/`contatos`, que continuam como estão — esta fatia não os reaproveita
porque eles leem só as colunas que a tela de origem precisa, não o suficiente pra editar).

Padrão único pras 5 telas: **lista (Table) + Dialog de criar/editar**, RHF + Zod (não o
`useState` solto de `DialogoPerda.tsx` — regra do `.claude/rules/Frontend.md`). Exclusão
com `window.confirm` simples (mesmo nível de risco que excluir uma tag hoje) e mensagem de
erro do banco repassada quando o trigger bloquear ("Não é possível excluir: ainda em uso
por N negócio(s)/vencimento(s)/contato(s)").

- `paginas/ListaFunis.tsx` — nome, tipo, ordem. Cada linha tem um botão "Etapas" que abre
  um segundo Dialog (`components/DialogoEtapas.tsx`) listando as etapas daquele funil
  (nome, tipo, ordem) com CRUD inline — não uma rota própria, pra não fragmentar "editar
  funil" e "editar etapas" em duas navegações.
- `paginas/ListaVencimentoTipos.tsx` — nome, recorrência padrão. **`regua_sugerida`
  (jsonb) fica de fora** — é a régua de lembrete automático, PRD §6.4/§6.8, depende de
  automações (Fase 2, adiada pela ADR 0004). Campo já existe no schema com default `'[]'`,
  não editável por esta tela.
- `paginas/ListaCamposPersonalizados.tsx` — abas "Contato"/"Vencimento" (`entidade`),
  reaproveitando os mesmos dois valores que `useCamposPersonalizados(empresaId, entidade)`
  já usa. Campos: chave, rótulo, tipo, opções (só quando `tipo = 'selecao'`), obrigatório,
  ordem.
- `paginas/ListaTags.tsx` — nome, cor (color picker, mesmo padrão da cor primária da
  fatia 1).
- `paginas/ListaMotivosPerda.tsx` — nome.

Navegação: 5 cards novos em `src/app/paginas/Configuracoes.tsx` (índice já existe, só um
card "Empresa" até agora). Rotas: `/configuracoes/funis`, `/configuracoes/tipos-vencimento`,
`/configuracoes/campos-personalizados`, `/configuracoes/tags`, `/configuracoes/motivos-perda`.

## Code Style

RHF + Zod em todo Dialog (schemas novos em `schemas.ts` da slice, um por entidade).
`queryKey` com `empresaId`. Mensagens de erro do banco (trigger de bloqueio, índice único
parcial violado) traduzidas pra português antes de mostrar ao usuário — nunca repassar o
erro técnico do Postgres cru (`.claude/rules/Frontend.md`).

## Testing Strategy

pgTAP novo em `supabase/tests/configuracoes_nucleo.sql`:
- Um caso por tabela provando que excluir um item **em uso** é rejeitado (negócio ativo
  usando o funil/etapa/motivo, vencimento ativo usando o tipo, contato ativo com a tag).
- Excluir um item **sem uso** funciona normalmente.
- Excluir e recriar com o mesmo nome funciona (prova do índice parcial) — um caso por
  tabela das 6.
- Isolamento multiempresa: gestor de uma empresa não edita/exclui configuração de outra
  (RLS já testada em outros specs pras mesmas tabelas — aqui só confirma que os triggers
  novos não abrem brecha).
- RLS de escrita: usuário comum não escreve em nenhuma das 5 gestor-only; qualquer membro
  escreve em `tags`.

Sem teste Vitest novo previsto — sem lógica pura nova (validação de forma fica no `schemas.ts`,
espelhando os `check` que já existem nas tabelas, mesmo padrão da fatia 1).

`security-check` obrigatório (mudança em RLS indireta — os triggers novos podem, em teoria,
ser contornados por uma casca mal escrita; auditar).

## Boundaries

- **Sempre:** bloqueio de exclusão em uso é feito no banco (trigger), nunca só no cliente.
- **Sempre:** índice único parcial em toda tabela com `unique(..., nome)` + `deleted_at` —
  não repetir a armadilha de constraint simples numa tabela nova que tenha as duas colunas.
- **Perguntar antes:** expor `ativo` como ação própria de "desativar" (dívida técnica
  registrada, não decidida); editar `regua_sugerida` (Fase 2); bloqueio de uso em
  `campos_personalizados` via varredura de jsonb (custo x benefício não fechado).
- **Nunca:** RPC nova pra CRUD simples — a RLS `*_gestor_escreve`/`tags_membro` já autoriza
  sozinha, criar uma função só adicionaria uma camada sem necessidade.

## Success Criteria

- `npm run db:reset && npm run db:types && npm run test:db` limpos, incluindo
  `configuracoes_nucleo.sql` novo.
- `npm run lint && npm run typecheck && npm run test && npm run build` limpos.
- No navegador, como gestor: criar/editar/excluir um item de cada uma das 5 telas; tentar
  excluir um funil/tipo de vencimento/motivo de perda/tag em uso e ver a mensagem de
  bloqueio; excluir um item sem uso e recriar com o mesmo nome.
- Como usuário comum: as 4 telas gestor-only não aparecem/redirecionam; `tags` continua
  editável (RLS já permite).
- `security-check` rodado, sem crítico/alto pendente.

## Open Questions

Nenhuma — a única decisão de arquitetura (excluir único vs. desativar+excluir) já foi
fechada com o usuário via `AskUserQuestion` antes deste documento.

## Correções aplicadas na implementação (2026-09-25)

**Implementado.** `supabase/migrations/20260925172529_configuracoes_nucleo.sql`.

1. **Armadilha real do Postgres, achada escrevendo o pgTAP:**
   `with novo as (insert ... returning id) update ... where id = (select id from novo)` num
   statement só **não funciona** — o `UPDATE` usa o snapshot de antes do `INSERT` da mesma
   CTE, então não enxerga a linha recém-criada (`UPDATE 0`, silencioso, sem erro). Isolado
   fora do pgTAP antes de confirmar que não era bug do trigger/índice (`docker exec psql`
   direto). Corrigido separando criação e exclusão em statements distintos nos testes
   (captura o id numa tabela temporária entre um e outro) — documentado no cabeçalho da
   seção correspondente do teste, pra não cair na mesma armadilha de novo.
2. **Teste de isolamento testava a exceção errada.** A primeira versão do teste "dono da
   Beta não altera funil da Alfa" usava `throws_ok`, mas um `UPDATE` sob RLS não lança
   exceção quando a `USING` filtra a linha — só afeta zero linhas, silenciosamente (mesma
   classe de bug já documentada em `docs/whatsapp-mock/SPEC-chat-whatsapp-mock.md`,
   "correção 2"). Corrigido pra `lives_ok` (o UPDATE não estoura) + um `isnt` conferindo que
   o nome do funil continua intacto.
3. **`security-check` encontrou um MÉDIO real, corrigido antes de fechar:**
   `impedir_exclusao_tag_em_uso()` não era `security definer` — a contagem de uso rodava
   sujeita à RLS de `contatos` de quem chamou. Pras outras 4 tabelas (gestor+-only) isso não
   importa (`pode_acessar_responsavel` sempre retorna true pra gestor+), mas `tags` permite
   qualquer membro excluir — um usuário comum sem carteira compartilhada só enxergava os
   próprios contatos, então conseguia excluir uma tag ainda em uso no contato de um colega
   (a contagem subestimava o uso real). Corrigido em
   `supabase/migrations/20260925173903_corrige_visibilidade_guarda_exclusao_tag.sql`
   (mesmo raciocínio de `pode_acessar_responsavel`/`carteira_compartilhada` — precisa
   enxergar o fato verdadeiro, não o que a RLS deixaria o chamador ver), com teste pgTAP de
   regressão provando o cenário exato.

`npm run db:reset && npm run db:types && npm run test:db` (314/314) / `npm run lint && npm run typecheck && npm run test` (40/40 Vitest) / `npm run build` confirmados limpos.
**Teste no navegador ainda pendente** — depende do usuário confirmar (criar/editar/excluir
um item de cada uma das 5 telas; tentar excluir um item em uso e ver o bloqueio; excluir
sem uso e recriar com o mesmo nome).
