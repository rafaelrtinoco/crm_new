# Spec: Simulação de chat WhatsApp (mock)

**Implementado** (2026-09-24). Fora do capability map da Fase 3 recortada (que está fechado) — é um recorte isolado de PRD §6.7 (Inbox), sem conexão real com a API da Meta. Fase 2 continua formalmente adiada (ADR 0004). Decisão de arquitetura que sustenta este spec: `docs/decisoes/0006-chat-whatsapp-mock-reaproveita-atividades.md` — **leia antes**, o resto deste documento assume que você já sabe que não há tabela nova.

## Objetivo

Deixar visível, num formato de chat (bolhas, não lista), o que uma campanha de WhatsApp "enviou" a cada contato (mock — nenhuma mensagem real sai, ADR 0005) e permitir simular uma resposta do contato (o usuário digita como se fosse o cliente respondendo). Serve pra validar o produto e demonstrar o fluxo de mensageria antes de qualquer decisão de conectar a API real da Meta.

**Não é:** um inbox de verdade (sem recebimento real, sem webhook, sem número conectado), nem um canal de envio ad-hoc (toda mensagem "saída" só existe porque uma campanha a gerou — não há botão "enviar mensagem avulsa" nesta rodada).

## Assunções

1. **Reaproveita `atividades`**, sem tabela nova — ver ADR 0006. `tipo='mensagem'`, `conteudo jsonb = {texto, direcao: 'saida'|'entrada', canal: 'whatsapp', simulado?: true, campanha_id?: uuid}`.
2. **Só canal WhatsApp** nesta rodada — e-mail fica de fora (decisão do usuário, ver ADR 0006).
3. **Só campanhas disparam mensagem "saída"** — sem envio avulso, sem réguas/automações (PRD §6.8, nunca especificado, fora de escopo).
4. **Sem RLS nova, sem tabela nova, sem pgTAP de isolamento novo** — `atividades_select`/`atividades_insert` já cobrem qualquer `tipo`, testados em `supabase/tests/timeline_automatica.sql`/`isolamento_multiempresa.sql`. O pgTAP novo desta rodada testa só o comportamento novo (o trigger grava certo; conteúdo/direção corretos), não isolamento — que já está garantido.

## Modelo de dados (sem migration de tabela)

Nenhuma coluna nova em `atividades`. Contrato do `conteudo` jsonb pra `tipo='mensagem'`:

```jsonc
// saída (gravada por trigger, campanha mock)
{ "texto": "Olá João, sua apólice vence em 5 dias...", "direcao": "saida", "canal": "whatsapp", "campanha_id": "uuid-da-campanha" }

// entrada (gravada por insert direto do cliente, simulada)
{ "texto": "Quero renovar!", "direcao": "entrada", "canal": "whatsapp", "simulado": true }
```

## Banco

- **Trigger `registrar_mensagem_whatsapp_enviada()`** — `after update of status on public.fila_envios for each row when (new.canal = 'whatsapp' and new.status = 'enviada' and old.status is distinct from 'enviada')`. `security definer` (mesma razão de `processar_fila_envios`/`disparar_campanhas_agendadas`: pode disparar via `pg_cron`, sem sessão de usuário — `auth.uid()` seria `null`, RLS de `atividades` bloquearia um insert normal). Resolve `responsavel_id` a partir de `contatos.responsavel_id` (não de `auth.uid()`, que pode não existir no contexto do cron) e `campanha_id` a partir de `new.origem_id` (só quando `new.origem_tipo = 'campanha'` — hoje é o único valor possível). `set search_path = ''`.
- **Sem função de RPC nova pra resposta simulada** — insert direto do cliente contra `atividades`, mesmo caminho de `useRegistrarAtividade` (nota/ligação).
- **Sem grant/revoke novo** — o trigger roda no contexto de `processar_fila_envios` (já revogado de `authenticated`, só `pg_cron`/`postgres` chama), e o insert direto do cliente usa a policy `atividades_insert` que já existe e já é grantada.

## Frontend

- `src/features/contatos/api/useMensagensWhatsapp.ts`:
  - `useMensagensWhatsapp(contatoId)` — `useQuery`, lê `atividades` filtrando `tipo='mensagem'` no servidor (`.eq("tipo", "mensagem")`), ordenado **ascendente** por `created_at` (chat lê de cima pra baixo, diferente da Timeline que é decrescente).
  - `useSimularRespostaWhatsapp(contatoId)` — `useMutation`, insert direto em `atividades` (`tipo: 'mensagem'`, `conteudo: {texto, direcao: 'entrada', canal: 'whatsapp', simulado: true}`, `responsavel_id: usuario.id`), invalida `["mensagens-whatsapp", contatoId]` e `["atividades", contatoId]` (a aba Timeline também deve refletir a mensagem nova).
- `src/features/contatos/components/ChatWhatsapp.tsx` — bolhas alinhadas à direita (`direcao='saida'`, cor `primary`) e à esquerda (`direcao='entrada'`, cor `muted`), hora de cada mensagem (`formatarDataHoraFuso`/hora simples), badge "Simulado" nas mensagens de entrada (todas são simuladas nesta rodada — o badge existe pra não confundir com uma resposta real quando a Fase 2 trouxer recebimento de verdade). Campo de texto + botão "Simular resposta" no rodapé, chamando `useSimularRespostaWhatsapp`. Estado vazio: "Nenhuma mensagem ainda — dispare uma campanha de WhatsApp pra este contato pra começar."
- `src/features/contatos/paginas/DetalheContato.tsx` — nova `TabsTrigger value="whatsapp"` entre "Timeline" e "Vencimentos"; `TabsContent` renderiza `<ChatWhatsapp contatoId={id} />`. Sem rota nova.

## Code Style

Mesmo padrão de `useAtividades.ts`/`useRegistrarAtividade` (hooks TanStack Query, mapeamento manual linha→objeto camelCase) e de `TimelineContato.tsx` (componente puro recebendo dado já carregado, sem chamada própria ao Supabase). Nomes em português espelhando o banco (`direcao`, `simulado`), termos técnicos genéricos em inglês onde já é convenção (`useQuery`, `useMutation`).

## Testing Strategy

pgTAP novo em `supabase/tests/mensagens_whatsapp.sql` (não em `campanhas.sql`, que já está fechado e testado — nova migration, novo arquivo):
- Disparar uma campanha WhatsApp mock (mesmo setup de `campanhas.sql`) e processar a fila → confirmar que aparece exatamente uma `atividades` com `tipo='mensagem'`, `conteudo->>'direcao' = 'saida'`, `conteudo->>'texto'` igual ao `fila_envios.conteudo` resolvido, `conteudo->>'campanha_id'` igual à campanha.
- Confirmar que o trigger dispara **sem sessão de usuário** (mesmo padrão de `disparar_campanhas_agendadas` — `reset role`/`reset request.jwt.claims` antes de chamar `processar_fila_envios`), provando que `security definer` era necessário.
- Confirmar que uma mensagem **bloqueada** (sem consentimento, opt-out, fora do horário) **não** gera atividade — o trigger só dispara em `status='enviada'`.
- Resposta simulada: insert direto como usuário comum (responsável pelo contato) funciona; como usuário sem relação com o contato, é rejeitado pela RLS já existente de `atividades_insert` (prova que não precisamos de RLS nova).

Sem teste Vitest novo — não há lógica pura nova (`ChatWhatsapp.tsx` é apresentação sobre dado já validado no banco).

## Boundaries

- **Sempre:** mensagem "saída" só existe via trigger (nunca inserida pelo cliente) — mantém a regra de ouro "não insira atividades do cliente pra evento que já tem trigger".
- **Sempre:** toda mensagem de entrada carrega `simulado: true` e a UI mostra isso visivelmente — nunca pode parecer uma resposta real do WhatsApp.
- **Perguntar antes:** estender o trigger pra e-mail; criar um caminho de envio avulso (fora de campanha); qualquer coisa que pareça começar a construir o inbox de verdade (múltiplas conversas, não lidas, atribuição automática) — isso é Fase 2, não esta rodada.
- **Nunca:** criar tabela `conversas`/`mensagens` nesta rodada (ADR 0006); conectar qualquer credencial ou SDK da Meta.

## Success Criteria

- `npm run db:reset && npm run db:types && npm run test:db` limpos (incluindo o novo `mensagens_whatsapp.sql`).
- `npm run typecheck && npm run build` limpos.
- No navegador: disparar uma campanha de WhatsApp pra um contato com consentimento → aba "WhatsApp" da ficha do contato mostra a bolha de saída com o texto certo; digitar e enviar uma resposta simulada → aparece como bolha de entrada, marcada "Simulado"; a aba Timeline do mesmo contato também mostra as duas entradas como atividade `tipo='mensagem'`.
- `security-check` rodado (trigger `security definer` é superfície sensível, mesmo padrão que os módulos anteriores já auditaram).

## Open Questions

Nenhuma — as três decisões de arquitetura (armazenamento, escopo de canal, localização na navegação) já foram fechadas com o usuário antes deste documento (ver ADR 0006).

## Correções aplicadas na implementação

1. **`agendado_para` fixo na campanha de teste.** Achado ao rodar o pgTAP a primeira vez: a campanha de teste não setava `agendado_para`, então `enfileirar_envio` usava `coalesce(agendado_para, now())` = `now()` REAL (data da sessão) — fora da janela do `p_agora` fixo (`2026-09-14 13:00:00+00`) passado pro `processar_fila_envios` no teste, então a mensagem nunca era processada (nem enviada, nem bloqueada — simplesmente não estava "devida" ainda). Mesmo cuidado que `camp_metrica` de `campanhas.sql` já documentava; não é um bug do trigger, é uma armadilha de setup de teste — corrigido fixando `agendado_para` no passado, junto com o `p_agora` do worker.
2. **Teste de isolamento com `contato_id` capturado, não uma `SELECT` filtrada.** A primeira versão do teste "usuário da Beta não consegue simular resposta" fazia `INSERT ... SELECT ... FROM contatos WHERE ...` sob a sessão do Beto — como `contatos_select` já filtra o contato da Alfa pra ele, a `SELECT` devolvia zero linhas e o `INSERT` "passava" silenciosamente (0 linhas afetadas, sem exceção), sem nunca exercitar a RLS de `atividades_insert` de verdade. Corrigido capturando o `contato_id` antes (como gestor) e usando o literal — aí sim o `INSERT` chega até o `WITH CHECK` e é rejeitado com `42501`, como devia.

`db:reset`/`db:types`/`test:db`/`typecheck`/`build`/`lint`/`test` (Vitest) confirmados limpos nesta sessão. `security-check` rodado — 0 crítico/alto/médio, 1 info aceito (ver mensagem da auditoria, não repetida aqui). **Teste no navegador ainda pendente** — depende do usuário confirmar (disparar uma campanha WhatsApp pra um contato com consentimento, ver a bolha de saída na aba "WhatsApp" da ficha do contato, digitar e enviar uma resposta simulada, conferir que a aba Timeline também mostra as duas entradas).
