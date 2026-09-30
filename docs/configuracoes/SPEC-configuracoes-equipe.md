# Spec: `configuracoes` — fatia 3 (Equipe)

Continuação de `docs/configuracoes/SPEC-configuracoes-empresa.md` (fatia 1) e
`SPEC-configuracoes-nucleo.md` (fatia 2), ambas implementadas. PRD §6.15/§5.2. Fecha o
módulo Configurações — não há fatia 4 planejada.

## Objetivo

Gestor/dono conseguem, pela interface, mudar o papel de um membro (`usuario`/`gestor`/
`dono`) e remover um membro da empresa — hoje só existe via SQL direto. Essa fatia ficou
deliberadamente de fora das duas anteriores porque `empresa_membros_gestor_escreve` é
`FOR ALL` pra qualquer gestor, sem diferenciar o papel do alvo — sem guarda nova, a tela
deixaria um gestor promover a si mesmo a `dono`, ou demover/remover o dono atual.

**Efeito colateral:** `/convidar` (`Convidar.tsx`, já implementado e funcionando desde o
1B) nunca teve nenhum item de navegação apontando pra ele — achado ao procurar onde
colocar o botão "Convidar" da tela nova. A tela de Equipe vira o lugar de onde se chega
lá.

## Achados antes de codar

1. **Diferença em relação à fatia 2.** Lá, converti `unique(..., nome)` de 6 tabelas em
   índices únicos parciais (`where deleted_at is null`) pra permitir excluir-e-recriar.
   **Não dá pra fazer o mesmo em `empresa_membros`** — `contatos.responsavel_id`,
   `vencimentos.responsavel_id`, `negocios.responsavel_id`, `tarefas.responsavel_id`,
   `organizacoes.responsavel_id` e `formularios`/`paginas_captura.responsavel_fixo_id`
   referenciam `empresa_membros (empresa_id, usuario_id)` via FK composta — Postgres exige
   que o alvo de uma FK seja um unique constraint/índice **não-parcial**. Remover um membro
   continua soft delete puro (`UPDATE deleted_at`), nunca recriação de linha.
2. **Bug real em `aceitar_convite`** (`20260914132658_onboarding.sql:224`):
   ```sql
   insert into public.empresa_membros (empresa_id, usuario_id, papel, created_by)
   values (v_convite.empresa_id, auth.uid(), v_convite.papel, auth.uid())
   on conflict (empresa_id, usuario_id) do nothing;
   ```
   `do nothing` nunca importou porque nada jamais setava `deleted_at`. Assim que "remover
   membro" existe, reconvidar alguém removido e aceitar o convite **não reativa a linha**
   — o conflito é ignorado silenciosamente, `deleted_at` continua setado, a pessoa "aceita"
   mas não recupera acesso, sem erro nenhum. Corrigido trocando `do nothing` por `do update
   set papel = excluded.papel, deleted_at = null, created_by = excluded.created_by`.
3. **Bônus de design, não trabalho extra:** como toda criação de membro passa a ser gated
   pela guarda nova (insert direto e via `aceitar_convite`), um convite `papel = 'dono'`
   criado por engano por um gestor (`convites` não restringe isso) vai falhar na hora de
   aceitar, não silenciosamente virar um dono — sem precisar de guarda adicional em
   `criar_convite`.

## Decisões de produto

1. **Excluir é soft delete puro, sem bloqueio de "em uso"** (diferente da fatia 2) —
   registros antigos do membro removido (`responsavel_id`) continuam intactos e visíveis
   pra gestor+ (que sempre tem acesso, via `pode_acessar_responsavel`); reatribuição manual
   fica fora desta rodada.
2. **Ninguém edita/remove a si mesmo nesta tela** — guarda de UX (client-side) pra evitar
   mudar o próprio acesso no meio da sessão. "Sair da empresa" é outra funcionalidade, fora
   de escopo.
3. **Múltiplos donos são permitidos** (schema nunca restringiu isso). Trocar de dono é
   "promover um segundo dono, depois o antigo se demove" — não uma transferência atômica
   dedicada.

## Banco

### Trigger `impedir_escalada_privilegio_membro()` em `empresa_membros`

`before insert or update or delete`, cobrindo os três caminhos que a RLS `FOR ALL` permite:

1. **Virar dono exige já ser dono** — `NEW.papel = 'dono' and not tem_papel(empresa_id,
   'dono')` é rejeitado, **exceto** no bootstrap de empresa nova: quando ainda não existe
   nenhuma linha de `empresa_membros` pra aquele `empresa_id` (caso de
   `criar_empresa_com_onboarding`, que insere `empresas` e o primeiro membro `dono` na
   mesma transação). "Zero linhas" é um sinal seguro e exclusivo de bootstrap porque a
   regra 3 abaixo garante que uma empresa existente nunca fica sem dono.
2. **Mexer numa linha que já é dono exige ser dono** — `OLD.papel = 'dono' and not
   tem_papel(empresa_id, 'dono')` é rejeitado (update ou delete).
3. **Nunca zero donos** — antes de uma mudança que tiraria o último dono (demover, soft
   delete, ou hard delete), conta quantos outros donos ativos restam; zero é rejeitado.

### `aceitar_convite` — `create or replace`, sem editar a migration original

Só a cláusula `on conflict`, ver achado 2 acima.

## Frontend

- `src/features/configuracoes/api/useEquipeConfig.ts` — `useAtualizarPapelMembro(empresaId)`
  e `useRemoverMembro(empresaId)`, `.update()` direto (`.eq("empresa_id",
  ...).eq("usuario_id", ...)`), invalidando `["membros-empresa", empresaId]` (a query de
  `useMembrosEmpresa`, reusada pra leitura — não duplica a leitura da view
  `membros_empresa`).
- `src/features/configuracoes/paginas/ListaEquipe.tsx` — tabela (nome, papel, ações) +
  botão "Convidar" (`Link to="/convidar"`). Seletor de papel: dono vê
  `usuario`/`gestor`/`dono` pra qualquer linha que não seja a própria; gestor vê só
  `usuario`/`gestor`, e linhas com papel `dono` aparecem sem ação (nota "só o dono altera
  outro dono"). Erro do banco (mensagens próprias, já em português) mostrado direto — não é
  erro técnico do driver, é texto que eu mesmo escrevi no `raise exception`.
- Rota `/configuracoes/equipe`; card "Equipe" novo em `src/app/paginas/Configuracoes.tsx`.

## Code Style

Mesmo padrão das fatias 1/2: hooks TanStack Query com `queryKey` incluindo `empresaId`,
guard de papel client-side documentado como UX-only (mesma nota de `Convidar.tsx`/
`ConfiguracoesEmpresa.tsx`), sem RPC nova pro CRUD (RLS já autoriza).

## Testing Strategy

`supabase/tests/configuracoes_equipe.sql`:
- Gestor não promove `usuario` a `dono` (rejeitado).
- Gestor não demove/remove o dono atual (rejeitado, update e soft delete).
- Gestor promove/demove entre `usuario`/`gestor` normalmente e remove um não-dono
  (`lives_ok` — prova que o caminho que já funcionava continua funcionando).
- Dono promove um gestor a dono (segundo dono).
- Dono não se demove/remove sendo o único dono (rejeitado); consegue depois de promover um
  segundo dono.
- Bootstrap: `criar_empresa_com_onboarding` continua funcionando.
- Regressão do achado 2: remove um membro, convida o mesmo e-mail de novo, aceita —
  confirma `deleted_at is null` e `papel` corretos na mesma linha.
- Isolamento multiempresa de praxe.

`security-check` obrigatório (mudança em RLS indireta via trigger).

## Boundaries

- **Sempre:** guarda de privilégio no banco (trigger), nunca só na UI.
- **Perguntar antes:** reatribuição em massa de registros de um membro removido;
  transferência de posse dedicada; guarda em `criar_convite` contra convidar quem já é
  membro (gap pré-existente, adjacente, não introduzido por esta fatia).
- **Nunca:** deixar a contagem de "zero donos" ser contornável por hard delete direto — o
  trigger cobre `DELETE`, não só `UPDATE`.

## Success Criteria

- `npm run db:reset && npm run db:types && npm run test:db` limpos, incluindo
  `configuracoes_equipe.sql` e os testes de `onboarding.sql` já existentes (prova que o
  bootstrap não quebrou).
- `npm run lint && npm run typecheck && npm run test && npm run build` limpos.
- No navegador: como gestor, tentar promover alguém a dono e remover o dono (ambos devem
  falhar ou nem aparecer a opção); promover/demover entre usuário/gestor normalmente. Como
  dono, promover um gestor a dono, depois se demover/remover. "Equipe" some do menu pra
  usuário comum; botão "Convidar" leva a `/convidar`.
- `security-check` rodado, sem crítico/alto pendente.

## Open Questions

Nenhuma — as três decisões de produto já foram fechadas (decisão do usuário sobre o
recorte geral das três fatias via `AskUserQuestion`, antes da fatia 1; as chamadas
rotineiras desta fatia — soft delete sem bloqueio de uso, sem auto-edição, múltiplos donos
— estão registradas acima como julgamento, não pendência).

## Correções aplicadas na implementação (2026-09-30)

**Implementado.** `supabase/migrations/20260930175537_configuracoes_equipe.sql`.

1. **Redesenho em duas camadas, achado revisando o primeiro rascunho do trigger.** A
   versão inicial só tinha a guarda em `empresa_membros` — mas `aceitar_convite` roda como
   o próprio convidado (`security definer`), que por definição ainda não é dono; exigir
   `tem_papel(dono)` dele bloquearia qualquer aceite legítimo de convite de `dono`,
   inclusive o primeiro convite de co-proprietário que um dono de verdade quisesse mandar.
   Corrigido movendo a decisão "quem pode virar dono" pra onde ela realmente é tomada — a
   criação do convite (`convites`, camada 1) — e usando uma flag local à transação
   (`app.aceitando_convite`, setada só dentro de `aceitar_convite`) pra a camada 2 não se
   autobloquear quando a camada 1 já autorizou.
2. **Dois bugs de "no-op é tratado como transição" achados rodando o pgTAP:**
   - Em `empresa_membros`: um `UPDATE` que só mexia em `deleted_at` de uma linha que JÁ era
     `'dono'` (ex.: tentar remover o dono) caía na checagem de "virar dono" (porque
     `NEW.papel` herda o valor antigo sem mudar) e acusava a mensagem errada ("promover
     outro dono" em vez de "alterar outro dono").
   - Erro de teste, não de trigger: o teste "dono cria convite de dono" continuava rodando
     com a sessão da Ana (que tinha acabado de se demover), não do Gustavo (recém-promovido)
     — corrigido trocando a sessão no teste.
   Ambos corrigidos restringindo a checagem a transições de verdade
   (`OLD.papel is distinct from 'dono'`), não a qualquer UPDATE que mantém o valor.
3. **`security-check` achou 1 crítico + 1 médio, os dois corrigidos antes de fechar:**
   - **Crítico:** a guarda de `convites` só cobria `INSERT` — um gestor criava um convite
     `papel='usuario'` (permitido) e fazia `UPDATE convites SET papel='dono'` na mesma
     linha depois, sem trigger nenhum barrando; aceito, a flag de transação deixaria passar
     achando que já estava autorizado. Corrigido cobrindo `before insert or update`.
   - **Médio, achado corrigindo o crítico:** cobrir `UPDATE` sem cuidado bloquearia
     `useCancelarConvite` (só muda `status`) pra qualquer gestor cancelando um convite que
     já era `dono` de verdade — mesma classe do achado 2 acima, mesmo remédio (só dispara
     em transição de verdade pro papel `dono`).

`npm run db:reset && npm run db:types && npm run test:db` (334/334) / `npm run lint && npm run typecheck && npm run test` (40/40 Vitest, sem novo — nenhuma lógica pura nesta fatia) / `npm run build` confirmados limpos. **Testado no navegador pelo usuário — funcionou.**
