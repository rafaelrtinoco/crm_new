# 0004 — Fase 2 (WhatsApp) adiada; Fase 3 entra recortada, sem integrações externas

## Status

Aceita.

## Contexto

O PRD (§9) sequencia Fase 2 (WhatsApp e réguas) antes de Fase 3 (Marketing e captura), porque Fase 3 originalmente inclui "campanhas por WhatsApp" como um dos dois canais de campanha. O usuário decidiu não conectar a API do WhatsApp Business (recebimento de mensagens) por enquanto — não é um bloqueio técnico, é uma escolha de prioridade: prefere seguir evoluindo o produto sem parar pra atravessar o processo de credenciamento da Meta (Tech Provider/Embedded Signup ou parceria com um BSP, PRD §6.7) agora.

Perguntei ao usuário, via `AskUserQuestion`, dois pontos que essa decisão abre:

1. **O que significa "deixar pré-configurado" pro WhatsApp?** Duas opções: (a) só documentar a decisão, sem código; (b) já construir `WhatsAppProvider` (interface + mock) e o schema de `conversas`/`mensagens`/`templates_mensagem` agora, funcional contra o mock, pra a Fase 2 de verdade virar só trocar o adapter. **Escolhida inicialmente: (a) só documentar.**
2. **O que fica dentro do escopo da Fase 3 agora, com WhatsApp e Meta Lead Ads fora?** Segmentos dinâmicos, campanhas por e-mail, formulários + páginas de captura e webhook de entrada genérico ficam dentro; Meta Lead Ads fica de fora. Detalhe da decisão, item por item, abaixo.

**Revisão no mesmo dia (2026-09-16):** ao planejar a Fase 3, o usuário pediu para incluir também **campanhas por WhatsApp**. Nova pergunta via `AskUserQuestion`: conectar de verdade com a Meta agora (reabrindo o credenciamento) ou construir só a funcionalidade contra um `WhatsAppProvider` mock? **Escolhido: mock.** Isso substitui a resposta (a) do item 1 acima — a decisão de "só documentar, sem código" foi revista: o adapter + o schema de mensageria (sem o schema de `conversas`/inbox, que continua de fora — ver "O que fica de fora" abaixo) entram agora, no formato descrito na fatia 3A do roteiro da Fase 3. O que muda de verdade quando a Fase 2 for retomada não é o schema, é só a implementação real do `WhatsAppProvider` (trocar o mock pela Cloud API da Meta) e o credenciamento em si.

## Decisão

**Fase 2 (WhatsApp e réguas) fica parada onde está** — nada implementado, nenhum adapter, nenhuma tabela nova. O PRD não muda de conteúdo nem de numeração; só a ORDEM de execução muda: em vez de Fase 2 → Fase 3, o próximo ciclo de implementação é uma **Fase 3 recortada**, com WhatsApp e Meta Lead Ads fora.

### Fase 3 — o que entra agora

- **Segmentos dinâmicos salvos** (PRD §6.9) — sem dependência externa, entra integral.
- **Campanhas por e-mail e por WhatsApp** (PRD §6.9) — entram as duas, contra adapters `EmailProvider`/`WhatsAppProvider` (interface + mock, padrão já previsto em CLAUDE.md/`.claude/rules/Supabase.md`). Nenhuma mensagem real sai em nenhum dos dois canais enquanto o provider estiver em modo mock — só troca quando a conexão de verdade (SMTP/e-mail transacional, e a Cloud API da Meta pro WhatsApp) existir. A fila de envios com as checagens de consentimento/opt-out/horário comercial/janela de 24h (regra de ouro do projeto) entra junto, como fundação — sem ela nenhuma campanha por nenhum canal pode existir.
- **Formulários + páginas de captura** (PRD §6.10, primeiros dois itens) — geram lead direto no CRM por um formulário embutido/página pública própria, sem integração externa. Entra integral.
- **Webhook de entrada genérico**, autenticado por token (PRD §6.10, terceiro item) — é uma porta de entrada *genérica*, não uma integração específica com uma plataforma de terceiro: qualquer ferramenta externa (bot de site, Zapier, etc.) pode chamar esse endpoint. Não depende de aprovação de nenhuma plataforma, e a tabela `integracoes` (PRD §8) já é pensada como "tokens de webhook" no genérico — entra integral.
- **Relatórios por origem** (PRD §6.12) — entram, mas rodando só sobre dados de origem manual/formulário/webhook genérico; sem atribuição vinda da Meta até essa integração existir.

### Fase 3 — o que fica de fora por enquanto

- **Conexão real com a API da Meta** (número de verdade, credenciamento Tech Provider/Embedded Signup ou BSP, templates aprovados pela Meta, janela de 24h real, inbox/recebimento de mensagem) — continua sendo só a Fase 2. O `WhatsAppProvider` da Fase 3 é mock; a tabela de conversas/mensagens do inbox (PRD §6.7) não é criada agora, só o necessário pra campanha (templates + fila de envio). Entra quando a Fase 2 entrar.
- **Integração com Meta Lead Ads** (PRD §6.10, quarto item) — é uma integração específica, com OAuth e API da própria Meta, diferente do webhook genérico acima. Fica em standby: o usuário vai trabalhar com dados inseridos manualmente (formulário/página de captura/webhook genérico) até decidir conectar a plataforma de verdade.

## Consequências

- Quando a Fase 2 for retomada: reler esta ADR + PRD §6.7 (o levantamento do caminho de credenciamento da Meta continua sendo pré-requisito antes de codar, nada disso muda) — nenhum código desta ADR precisa ser desfeito, porque nenhum foi escrito.
- Quando a integração com Meta Lead Ads for retomada: desenhar o lead recebido da Meta pra entrar pelo mesmo caminho de ingestão que o webhook de entrada genérico da Fase 3 vai usar (mesma tabela `integracoes`, mesma distribuição de lead/alerta ao responsável) — evitar um caminho de código paralelo só pra Meta. Isso é orientação de arquitetura para quem implementar; não é compromisso de schema já definido agora.
- `docs/PRD.md` §9 recebeu uma nota em Fase 2 e Fase 3 apontando pra esta ADR, sem renumerar nem reescrever o conteúdo das fases — a ordem de execução é uma decisão de sequenciamento, não uma mudança de escopo do produto documentado.
- Próximo ciclo de trabalho: plano da Fase 3 recortada (segmentos, campanhas por e-mail com `EmailProvider` mock, formulários, páginas de captura, webhook de entrada genérico, relatórios por origem) — ainda não iniciado, aguardando `spec-driven-development` antes de codar, como qualquer fase nova.
