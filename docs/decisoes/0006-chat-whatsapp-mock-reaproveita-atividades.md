# 0006 — Simulação de chat WhatsApp reaproveita `atividades`, sem tabela `conversas`/`mensagens`

## Status

Aceita.

## Contexto

O usuário pediu, ainda sem pretensão de conectar a API real do WhatsApp (ADR 0004 segue valendo — Fase 2 formalmente adiada), uma forma de **simular** um cenário de chat: ver as mensagens que uma campanha "enviou" (mock, via `fila_envios`/`processar_fila_envios`, ADR 0005) e poder digitar uma resposta como se fosse o contato, num formato de bolhas de chat.

A ADR 0004 previa que "a tabela de `conversas`/`mensagens` do inbox (PRD §6.7) não é criada agora... entra quando a Fase 2 entrar" — ou seja, o plano original era que essa simulação, se viesse antes da Fase 2, precisaria de um schema novo.

Ao explorar o schema antes de especificar, achamos que isso já não é verdade: `atividades` (timeline do contato, Fase 1) já reserva os tipos `'mensagem'` e `'resposta_campanha'` no seu `check`, já tem RLS completa (select/insert, padrão "tabela com dono" via `pode_acessar_responsavel`/contato), já é escrita tanto por trigger (mudança de etapa, etc.) quanto por insert direto do cliente (notas, ligações — `useRegistrarAtividade`), e a ficha do contato já tem uma aba "Timeline" lendo essa tabela, com `TimelineContato.tsx` já preparado pra renderizar `conteudo.texto`. O gap real não é "falta schema", é "nada nunca gravou o tipo 'mensagem'".

## Decisão

A simulação de chat WhatsApp **reaproveita `atividades`**, sem tabela nova:

- **Mensagem "enviada"** (saída, disparada por campanha mock): `tipo='mensagem'`, `conteudo={texto, direcao:'saida', canal:'whatsapp', campanha_id}`, gravada por um **trigger** em `fila_envios` (`AFTER UPDATE OF status`, quando `canal='whatsapp'` e `status` vira `'enviada'`) — automática, sem intervenção do cliente, mesma filosofia de "a timeline é automática" já em vigor pra mudança de etapa/tarefa concluída/vencimento renovado.
- **Resposta simulada** (entrada, digitada pelo usuário fazendo de conta que é o contato): `tipo='mensagem'`, `conteudo={texto, direcao:'entrada', canal:'whatsapp', simulado:true}`, gravada por **insert direto do cliente** — mesmo padrão já usado por nota/ligação (`useRegistrarAtividade`), a RLS `atividades_insert` já cobre isso sem mudança nenhuma.
- Nenhuma tabela nova, nenhuma RLS nova, nenhum pgTAP de isolamento novo (o de `atividades` já existe e já cobre qualquer `tipo`).
- Escopo desta rodada: só canal WhatsApp (e-mail fica de fora, mesmo o schema já reservando `tipo='email'` — decisão de escopo, não de arquitetura, pra não mudar o comportamento de campanhas de e-mail já entregues sem necessidade).
- UI nova: aba "WhatsApp" na ficha do contato (`/contatos/:id`), ao lado de Timeline — bolhas de chat, não lista de atividade genérica. Reusa a mesma fonte de dados (`atividades` filtrado por `tipo='mensagem'`), só muda a apresentação.

## Consequências

- Quando a Fase 2 for retomada de verdade (conexão real com a Meta, inbox completo, recebimento de mensagem via webhook): a decisão de reaproveitar `atividades` para o histórico de mensagens **pode continuar valendo** (é plausível que o inbox de verdade também queira aparecer na timeline do contato) ou pode ser revisitada se o volume/formato de mensagens reais pedir uma tabela dedicada (`conversas`/`mensagens`, como a ADR 0004 cogitava) — não é um compromisso definitivo, é a decisão certa para o volume e escopo de hoje (mock, campanha, sem recebimento real).
- Nenhum código desta decisão precisa ser desfeito se a Fase 2 mudar de direção — o trigger em `fila_envios` e o insert direto de resposta simulada continuam válidos como estão; a Fase 2 real adicionaria a gravação via webhook (mais uma fonte de `direcao:'entrada'`, dessa vez automática em vez de simulada), não um schema paralelo.
- `docs/whatsapp-mock/SPEC-chat-whatsapp-mock.md` detalha a implementação.
