# 0003 — Integridade entre empresas por chave estrangeira composta

## Status

Aceita — redesenho do núcleo, pós-Fase 1.

## Contexto

Uma revisão arquitetural do modelo de dados (workspaces, contatos, negócios, pipelines, tarefas, atividades) encontrou um padrão em todas as 12 migrations da Fase 1: as tabelas têm `empresa_id` e RLS protege bem **quem lê o quê**, mas nenhuma coluna de referência (`negocios.funil_id`, `negocios.etapa_id`, `tarefas.negocio_id`, `*.responsavel_id` etc.) garantia que o alvo pertencia à **mesma empresa** da linha. Um usuário membro de duas empresas (cenário já suportado — PRD §5.1) conseguiria, em teoria, gravar um negócio da empresa A apontando para um funil da empresa B. A RLS não cobre isso: ela valida se o ator pode escrever na linha, não se as colunas de referência apontam pra dentro da mesma empresa.

## Decisão

Toda tabela do núcleo ganhou `unique (empresa_id, id)` e as FKs simples viraram compostas: `(empresa_id, funil_id) references funis (empresa_id, id)`, e assim por diante para `etapa_id`, `contato_id`, `negocio_id`, `vencimento_id`, `tag_id`, `motivo_perda_id`, `organizacao_id`. `responsavel_id` passou a referenciar `empresa_membros (empresa_id, usuario_id)` em vez de `auth.users (id)` — antes, nada impedia atribuir um registro a alguém que não é nem membro daquela empresa.

Isso é **puramente declarativo** (FK composta, sem trigger), então não tem custo de manutenção nem risco de recursão em política de RLS. `MATCH SIMPLE` (padrão do Postgres) cobre o caso de coluna nula: se `responsavel_id` for `null`, a FK não é checada — continua opcional onde já era.

`migration: 20260915183000_integridade_multiempresa.sql`.

## Descoberta no caminho: RLS reaplica a `USING` de SELECT contra a linha nova em todo UPDATE

Ao tentar também fechar o soft delete (`deleted_at is null` só na `USING` de leitura, nunca na `WITH CHECK`, para não autobloquear a própria escrita que exclui), a escrita falhava mesmo assim — inclusive com `WITH CHECK (true)` explícito e policies de UPDATE totalmente separadas da de SELECT.

Confirmado experimentalmente (não por leitura de documentação): o Postgres reaplica a `USING` de qualquer policy de SELECT aplicável contra a **linha resultante** de um UPDATE, independentemente de existir uma policy de UPDATE mais permissiva. Não há como contornar isso mantendo o soft delete como um UPDATE direto do cliente quando a policy de SELECT filtra por uma coluna que esse mesmo UPDATE está mudando.

**Consequência:** `deleted_at is null` só pôde entrar na RLS de leitura das 5 tabelas com dono (contatos, vencimentos, negócios, tarefas, organizações) porque o soft delete em si passou a ser uma função `security definer` (`excluir_registro`, simétrica a `restaurar_registro`) — bypassa RLS pra fazer exatamente essa escrita, com a mesma regra de autorização (`pode_acessar_responsavel`) que a policy antiga já aplicava. Tabelas de configuração compartilhada (funis, tags, tipos, motivos, campos personalizados) **não** entraram nesse redesenho — ficaram com o soft delete do jeito antigo (sem filtro de RLS), para não pagar esse custo onde a Fase 1 nunca teve o bug que motivou a mudança.

`migration: 20260915183400_soft_delete_e_dedup.sql`.

## Achados de uma revisão adversarial pós-implementação (mesma sessão)

Depois do redesenho pronto e com os 146 pgTAP passando, rodei uma revisão adversarial (agente de contexto limpo, sem ver o meu raciocínio, só o código) sobre o resultado final. Ela reproduziu 4 problemas reais contra o Postgres local, não achismo — todos corrigidos antes deste documento ser fechado:

1. **DELETE físico contornava o soft delete inteiro.** As 4 policies por tabela (select/insert/update/delete) cobriam os comandos, mas a policy de `DELETE` sozinha não impede o privilégio bruto de `DELETE` — só filtra QUAIS linhas, não SE pode. Um `DELETE FROM contatos WHERE id = ...` direto (fora de `excluir_registro`) passava, cascateava pra `vencimentos`/`negocios` ligados, e não gerava `audit_log`. A frase abaixo ("é rejeitado pela RLS") era verdadeira só para `UPDATE`, não para `DELETE` — ninguém tinha testado o caminho óbvio. Corrigido com `revoke delete on ... from authenticated` nas 5 tabelas (mesmo padrão que `atividades` já tinha desde o início).
2. **`etapas.tipo` era código morto.** `aplicar_template()` (função de onboarding, já existente antes desta sessão) nunca setava `tipo` ao criar as etapas — toda etapa nascia `'normal'`, mesmo as literalmente chamadas "Ganho"/"Perdido" no template. Como não existe tela de gerência de funil/etapa, nenhuma empresa real teria uma etapa especial de verdade; o gap do PRD §6.5 que a migration 4 dizia fechar continuava aberto na prática. Corrigido: `aplicar_template` foi atualizado (`create or replace`, migration nova) pra casar o nome da etapa contra `etapa_ganho`/`etapa_perdida` do template, e o template "corretora" ganhou essas duas chaves em cada funil.
3. **`uq_negocios_vencimento_aberto` não filtrava `deleted_at`.** Excluir um negócio de renovação (via `excluir_registro`, que não mexe em `status`) deixava a linha morta ocupando a vaga do vencimento pra sempre — um negócio novo pro mesmo vencimento era rejeitado por unicidade. Corrigido adicionando `and deleted_at is null` ao índice parcial.
4. **FK composta por empresa não bastava — faltava por funil.** `(empresa_id, etapa_id) references etapas (empresa_id, id)` garante que a etapa é da mesma empresa, não do mesmo funil do negócio. Nada impedia `negocios.funil_id = A` com uma `etapa_id` de um funil `B` da mesma empresa. Corrigido com uma segunda FK composta, `(funil_id, etapa_id) references etapas (funil_id, id)` (exige `unique (funil_id, id)` em `etapas`).

Dois achados adicionais foram classificados como **não-bug**, por contexto que o revisor não tinha (não recebeu o meu raciocínio, só o código, de propósito — é assim que a revisão adversarial funciona): a entidade `organizacoes` não ter nenhuma tela no frontend é uma decisão explícita tomada com o usuário nesta mesma sessão (`AskUserQuestion`), não escopo não-autorizado; e a dupla entrada de timeline ao marcar um negócio como ganho por arrastar o card é intencional (mudança de etapa + evento de ganho são dois fatos distintos), coberta pelo próprio teste.

## Consequências

- Toda tabela nova do núcleo que referenciar outra tabela do núcleo deve usar FK composta `(empresa_id, <fk>)`, não simples — é o padrão daqui pra frente, não uma exceção. Quando a referência também precisa respeitar um agrupamento mais estreito que a empresa (ex.: etapa dentro do funil do negócio), a FK composta usa essa chave mais estreita, não `empresa_id` — ver achado 4 acima.
- Testes pgTAP dedicados (`supabase/tests/integridade_multiempresa.sql`) provam que gestor de uma empresa não consegue gravar referências cruzadas (entre empresas OU entre funis da mesma empresa), mesmo tendo permissão de escrita via `pode_acessar_responsavel` — a RLS sozinha não bastava, só a FK barra.
- Soft delete das 5 tabelas com dono passa **exclusivamente** por `excluir_registro`/`restaurar_registro`: tanto `UPDATE ... SET deleted_at = ...` quanto `DELETE` diretos do cliente são rejeitados (42501) de propósito — o segundo só depois do achado 1 acima; antes disso, `DELETE` funcionava por engano.
- Se uma tabela nova do núcleo precisar do mesmo filtro de soft delete, replicar o padrão de 4 policies (select/insert/update/delete) **e** o `revoke delete` — uma única policy `FOR ALL` com `deleted_at is null` só na `USING` não funciona (motivo documentado acima), e esquecer o `revoke` deixa o `DELETE` físico como porta dos fundos do soft delete.
- Qualquer índice único parcial que use `status` (ou outra coluna de estado) como filtro precisa somar `deleted_at is null` também — senão um registro excluído continua "ocupando a vaga" pra sempre (achado 3).
