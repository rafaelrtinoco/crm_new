# Progresso — Facility

Log de continuidade entre máquinas/sessões. Atualize a seção "Estado atual" a cada incremento entregue; não precisa reescrever o histórico abaixo dela.

## Estado atual — 2026-09-24 (2)

**Simulação de chat WhatsApp (mock) implementada** — fora do capability map da Fase 3 (que fechou na entrada anterior), recorte isolado de PRD §6.7 (Inbox) sem conexão real com a Meta; Fase 2 continua formalmente adiada (ADR 0004). Pedido do usuário: simular um cenário de mensagens de WhatsApp mockadas, sem pretensão de conectar a API real. `supabase/migrations/20260924195210_mensagens_whatsapp.sql`.

**Achado ao explorar antes de especificar:** `atividades` (timeline do contato, desde a Fase 1) já reservava os tipos `'mensagem'`/`'resposta_campanha'` e já tinha RLS completa (`atividades_select`/`atividades_insert`) e uma aba "Timeline" já lendo essa tabela — nunca populada porque nada gravava esse tipo. Em vez de criar a tabela `conversas`/`mensagens` que a ADR 0004 cogitava, a decisão (registrada na `docs/decisoes/0006-chat-whatsapp-mock-reaproveita-atividades.md`) foi reaproveitar `atividades`: mensagem "saída" gravada por um trigger novo em `fila_envios` (`security definer`, mesmo motivo de `processar_fila_envios`/`disparar_campanhas_agendadas` — pode disparar via `pg_cron` sem sessão), resposta "entrada" simulada via insert direto do cliente (mesmo caminho já usado por nota/ligação, sem RLS nova). Zero tabela nova, zero RLS nova, zero pgTAP de isolamento novo — só o comportamento novo (o trigger grava certo, só quando enviada de verdade) foi testado.

Frontend: `src/features/contatos/api/useMensagensWhatsapp.ts` (hooks), `src/features/contatos/components/ChatWhatsapp.tsx` (bolhas de chat, saída/entrada, selo "Simulado"), nova aba "WhatsApp" em `DetalheContato.tsx`. Escopo: só canal WhatsApp (não e-mail), só disparado por campanha (não avulso, não réguas/automações — decisões do usuário via `AskUserQuestion` antes de especificar).

`security-check` rodado — 0 crítico/alto/médio, 1 info aceito (atribuição de `responsavel_id` na resposta simulada é informada pelo cliente, mesmo comportamento já existente em nota/ligação, sem impacto de privilégio). Duas correções de teste (não de código de produto) documentadas em `docs/whatsapp-mock/SPEC-chat-whatsapp-mock.md`: `agendado_para` fixo pra não cair fora da janela do `p_agora` do worker; teste de isolamento usando `contato_id` capturado em vez de uma `SELECT` que a própria RLS de `contatos` já filtrava (testava a RLS errada).

**Testado no navegador pelo usuário — funcionou.** No caminho, achou um gap de navegação pré-existente (não introduzido nesta sessão): a tela de templates (`/campanhas/templates`, `ListaTemplates`/`FormularioTemplate`, do módulo `campanhas` da Fase 3) nunca teve link nenhum apontando pra ela — só era alcançável digitando a URL direto. `SeletorTemplate.tsx` até já tinha o texto "crie um em Templates antes de disparar" no estado vazio, mas sem link. Corrigido: botão "Templates" em `ListaCampanhas.tsx` (ao lado de "Nova campanha") e o texto do estado vazio de `SeletorTemplate.tsx` virou link pra `/campanhas/templates/novo`.

`db:reset`/`db:types`/`test:db` (269 testes — só a falha pré-existente de `notificacoes.sql`, não relacionada)/`typecheck`/`build`/`lint`/`test` (32/32 Vitest) confirmados limpos. **Teste no navegador ainda pendente** — depende do usuário confirmar (disparar campanha WhatsApp, ver a bolha de saída, simular uma resposta, conferir a aba Timeline).

## Estado atual — 2026-09-24

**Fase 3 recortada, módulo 5/5 (`relatorios-origem`, último do capability map) implementado — capability map completo.** `supabase/migrations/20260924190123_relatorios_origem.sql`. Sem tabela nova (spec, Assunção 3) — duas funções `security invoker`: `relatorio_leads_por_origem` (leads por origem/UTM no período, `convertidos` = status atual "cliente", não "converteu no período") e `relatorio_desempenho_campanhas` (uma linha por campanha disparada no período, via `lateral join` com `metricas_campanha` do módulo `campanhas` — sem duplicar a lógica). Frontend novo em `src/features/relatorios/` (`api/useRelatorios.ts`, `logica/periodo.ts` + `logica/exportarXlsx.ts`, `components/FiltroPeriodo.tsx`, duas páginas). Navegação: dois cards novos no índice de "Marketing" (não item de sidebar próprio — ver correção 2 abaixo), rotas `/relatorios/leads-origem` e `/relatorios/campanhas`.

**Achado mais caro:** o spec original propunha as duas funções só com `security invoker`, sem `p_empresa_id` ("a RLS de contatos já limita a quem tem acesso") — mas RLS restringe por MEMBRESIA, não pela empresa selecionada no frontend. Um usuário membro de duas empresas (comum neste produto — `TrocadorEmpresa` no `AppShell` existe exatamente pra esse caso) veria leads/campanhas das duas empresas misturados no mesmo relatório sem esse filtro. Corrigido acrescentando `p_empresa_id uuid` como primeiro parâmetro nas duas funções, mesmo padrão já usado em `contar_segmento_provisorio` (`segmentos.sql`). pgTAP cobre o cenário concreto (gestor da Alfa também membro comum da Beta, pedindo relatório com `p_empresa_id` da Alfa, não vê o contato da Beta). Mais 2 correções menores (navegação sem item de sidebar próprio; `relatorio_desempenho_campanhas` filtrando `deleted_at` explicitamente, já que `campanhas` é "configuração compartilhada" e a RLS não filtra isso sozinha) documentadas em `docs/fase3/SPEC-relatorios-origem.md`.

**Pendência desta sessão: Docker Desktop não estava disponível no ambiente** — `npm run db:reset`, `npm run db:types` e `npm run test:db` não rodaram. Confirmado nesta sessão: `lint` limpo, `test` (32/32 Vitest) limpo, `typecheck`/`build` falham *só* nos 2 RPCs novos (`relatorio_leads_por_origem`/`relatorio_desempenho_campanhas` ainda não existem em `src/types/database.ts` — esperado até `db:types` rodar). **Antes de considerar este módulo fechado, falta rodar numa máquina com Docker aberto:** `npm run db:reset && npm run db:types && npm run test:db` (17 arquivos pgTAP, incluindo o novo `supabase/tests/relatorios_origem.sql`), depois `npm run typecheck && npm run build`, depois `security-check` (ainda não rodado) e teste no navegador (Success Criteria do spec: as duas telas com dado real, exportação XLSX funcionando).

## Estado atual — 2026-09-23 (2)

**Fase 3 recortada, módulo 3/5 (`captura-leads`) implementado** — `supabase/migrations/20260923190116_captura_leads.sql`. Três tabelas novas (`formularios`, `paginas_captura`, `integracoes`, todas com FK composta por `empresa_id` — `responsavel_fixo_id`/`formulario_id` seguindo a ADR 0003, correção feita no spec antes de codar) + `empresas.slug`. Seis funções principais: `receber_lead` (interna, resolve rodízio/fixo e insere o contato — reaproveita o trigger `notificar_lead_novo()` já existente, nada de notificação nova), `submeter_formulario` e `receber_lead_webhook` (públicas, `anon`), `criar_integracao`/`revogar_integracao` (token de 256 bits, só o hash sha-256 persiste), `obter_pagina_captura_publica`/`obter_formulario_publico` (leitura pública) e `definir_slug_empresa` (achada faltando — `empresas` só permite UPDATE de `dono`, gestor precisava de uma função própria). Frontend novo em `src/features/captura/` (12 arquivos — hooks, `FormularioEmbutivel` compartilhado, 5 páginas autenticadas, 2 páginas públicas fora do `AppShell`). Navegação: `captura` entrou no grupo "Marketing" já existente (3 cards novos no índice).

**Achado mais caro:** ao PROJETAR as funções (antes de codar), notei que `obter_pagina_captura_publica` não podia ser `security invoker` como o spec propunha — `anon` não tem nenhuma policy de select em `paginas_captura`/`empresas`, um visitante real sempre veria zero linhas. Virou `security definer` (mesmo pra `obter_formulario_publico`, função nova que o spec nem tinha). Mais 3 correções de execução documentadas na seção própria de `docs/fase3/SPEC-captura-leads.md`.

`security-check` rodado — 1 médio, corrigido antes de fechar: `submeter_formulario` checava `ativo` mas não `deleted_at` — um formulário "excluído" (soft delete) continuava aceitando submissão de quem já tivesse o `formulario_id` salvo (ex.: um `<iframe>` publicado antes da exclusão), mesmo tendo sumido da lista e do embed público. Confirmado sem findings adicionais: nenhum caminho de escrita pública escapa de `receber_lead` (RLS não concede nada a `anon` nas 4 tabelas, só as funções explicitamente grantadas), token com 256 bits de entropia, sem XSS nos campos de branding renderizados na página pública. Detalhe completo no spec.

**259/259 pgTAP** (227 anteriores + 32 novos); `lint`/`typecheck`/`test` (32/32)/`build` limpos. **Teste no navegador ainda pendente** — depende do usuário confirmar (preencher formulário em `/f/...` sem login, ver o lead aparecer em Contatos com o responsável certo; `curl` no webhook com token válido/inválido; conferir a página pública em `/p/...`).

`relatorios-origem` (módulo 5/5, último do capability map) passa a ser o próximo passo — as duas dependências dele (`captura-leads`, `campanhas`) estão prontas.

## Estado atual — 2026-09-23

**Fase 3 recortada, módulo 4/5 (`campanhas`) implementado** — `supabase/migrations/20260923171427_campanhas.sql`. Três tabelas novas (`templates_mensagem`, `campanhas`, `campanha_envios`, todas com FK composta por `empresa_id` e RLS "configuração compartilhada" — qualquer membro lê, só gestor+ escreve, mesmo padrão de `segmentos`) e seis funções: `disparar_campanha` (invoker — enfileira via `enfileirar_envio`, nunca grava direto em `fila_envios`), `disparar_campanhas_agendadas` (definer, chamada pelo cron), `atualizar_status_campanhas`, `metricas_campanha`, `preview_campanha`, `resolver_variaveis_campanha` (vocabulário fechado: `nome`/`primeiro_nome`/`email`/`telefone`). Frontend novo em `src/features/campanhas/` (10 arquivos — hooks, `EditorBlocos`, `SeletorTemplate`, `CardMetricasCampanha`, 5 páginas). Navegação: item "Segmentos" da sidebar virou "Marketing" (página índice nova, `src/app/paginas/Marketing.tsx`, linkando pra Segmentos e Campanhas), conforme decisão já registrada no spec.

**Achado mais caro da implementação:** `disparar_campanhas_agendadas` roda via `pg_cron`, sem sessão/JWT — mas `enfileirar_envio` (módulo `fila-envios`, já entregue) autoriza cada contato checando `auth.uid()`, que é `null` sem sessão. Sem tocar em `fila-envios`, resolvido impersonando — só durante a chamada, via `set_config('request.jwt.claims', ..., true)` local à transação — quem criou a campanha. Validado por teste dedicado no pgTAP (sem sessão nenhuma) e por smoke test manual antes de escrever os testes formais. Mais 5 correções menores documentadas na seção "Correções aplicadas na implementação" de `docs/fase3/SPEC-campanhas.md`.

`security-check` rodado — 1 médio + 1 info, os dois corrigidos antes de fechar: `campanhas.created_by` não era validado contra `auth.uid()` no INSERT (relevante aqui porque esse campo vira identidade impersonada, não só rótulo de auditoria — corrigido dividindo a policy `FOR ALL` em `campanhas_insert_proprio`/`campanhas_update_gestor`/`campanhas_delete_gestor`, padrão de `importacoes.sql`); `resolver_variaveis_campanha` podia interpretar `\1` literal como backreference de regex (corrigido escapando barra invertida). Detalhe completo no spec.

**227/227 pgTAP** (203 anteriores + 24 novos — as 2 falhas de `notificacoes.sql` são pré-existentes, não relacionadas, ver nota na entrada de 2026-09-16); `lint`/`typecheck`/`test` (32/32)/`build` limpos. **Testado no navegador pelo usuário — funcionou.**

`captura-leads` (módulo 3/5) segue como próximo passo válido — sem dependência restante; `relatorios-origem` (5/5) passa a depender só dele, já que `campanhas` está pronto.

## Estado atual — 2026-09-18

**Fase 3 recortada, módulo 2/5 (`segmentos`) implementado, testado e validado no navegador.** `supabase/migrations/20260918174420_segmentos.sql` — tabela `segmentos` (RLS gestor+ escreve, qualquer membro lê — padrão `funis`/`motivos_perda`, não `excluir_registro`), `validar_criterios_segmento` (CHECK na hora de salvar), `contato_bate_criterios` (avaliador da DSL sem SQL dinâmico, `security invoker`), `avaliar_segmento`/`contar_segmento`/`contar_segmento_provisorio`/`prever_contato_segmento`. Frontend novo em `src/features/segmentos/` (construtor de regras cobrindo os 10 campos da DSL, contagem ao vivo com debounce). **203/203 pgTAP** (só a falha pré-existente de `notificacoes.sql`, não relacionada — ver nota abaixo); `lint`/`typecheck`/`test` (32/32)/`build` limpos. `security-check` rodado — 0 crítico/alto/médio, 2 info aceitos (ver spec). Testado no navegador pelo usuário — funcionou.

A exploração antes de implementar encontrou 5 correções em relação ao spec original — todas documentadas na seção "Correções aplicadas na implementação" de `docs/fase3/SPEC-segmentos.md`: RLS corrigida pro padrão certo (não `excluir_registro`, que não cobre tabela de configuração compartilhada), `unique(empresa_id,id)` adicionado proativamente pra FK futura de `campanhas`, CHECK de `campo` na escrita (não só na avaliação), validação de `operador` por campo (o spec original não especificava), e uma função nova (`contar_segmento_provisorio`) pro preview ao vivo antes de salvar — sem ela não dava pra atender o Success Criteria de "contagem muda ao vivo" enquanto o segmento ainda não existe.

`campanhas` (módulo 4/5) já tem as duas dependências prontas (`fila-envios` + `segmentos`) e pode entrar em Plan/Tasks quando o usuário pedir.

## Estado atual — 2026-09-16

**Fase 3 recortada, módulo 1/5 (`fila-envios`) implementado e testado.** `supabase/migrations/20260916192944_fila_envios.sql` — tabela `fila_envios`, helpers `dentro_horario_comercial`/`proximo_horario_comercial`, `enfileirar_envio` (RPC pra `authenticated`), `mock_enviar_mensagem` (interna) e o worker `processar_fila_envios` (agendado via `pg_cron` a cada minuto, sem Edge Function — ADR 0005). **192/192 pgTAP** (178 existentes − os 2 de `notificacoes.sql` que agora falham por um motivo não relacionado, ver nota abaixo — + os novos de `fila_envios.sql`); `lint`/`typecheck`/`test` (32/32)/`build` limpos. Testado fim a fim via SQL direto contra o banco local (enfileirar → processar dentro/fora do horário comercial, com os resultados batendo exatamente com `proximo_horario_comercial`); teste no navegador da fatia extra (consentimento na ficha do contato) pendente de confirmação do usuário.

A exploração antes de implementar encontrou 5 furos no spec original (contradição em `security definer`/`invoker`, ausência total de UI pra criar `consentimentos`, dois motivos de bloqueio que o spec não previa) — todos resolvidos e documentados na seção "Correções aplicadas na implementação" do próprio `docs/fase3/SPEC-fila-envios.md`. A ausência de UI de consentimento virou uma fatia extra deste módulo: `CardConsentimento` na aba "Dados" da ficha do contato (`src/features/contatos/components/CardConsentimento.tsx`, hooks em `api/useConsentimentos.ts`) — sem isso, toda campanha de marketing futura sairia pra zero pessoas, já que nada no produto criava esse registro antes.

**Achado não relacionado, durante `npm run test:db`:** `supabase/tests/notificacoes.sql` agora falha 2/10 — bug pré-existente no seed/teste (não causado por este módulo): a tarefa atrasada do seed usa `data_vencimento = current_date - interval '1 day'` (relativo ao dia real do `db:reset`), mas o teste fixa `p_agora` num valor absoluto (`2026-09-15 11:00:00+00`). Como o `db:reset` desta sessão rodou em 2026-09-16, a tarefa nasceu vencendo exatamente no dia que o teste trata como "hoje" — `data_vencimento < v_hoje` vira falso na igualdade. Confirmado como pré-existente (independente da migration nova) comparando as datas; não corrigido nesta sessão por estar fora do escopo de `fila-envios` — fica registrado aqui pra não ser confundido com regressão.

Ainda no roteiro da Fase 3 recortada: seguindo o roteiro da rodada anterior (que adiou a Fase 2/WhatsApp — ver abaixo), passei pelo `spec-driven-development` pra planejar a Fase 3 recortada antes de codar. Fase 0 (Scope Check) detectou que o recorte junta várias capacidades testáveis de forma independente — aprovado com o usuário um **capability map** em `docs/fase3/CAPABILITY-MAP.md`: `fila-envios` + `segmentos` + `captura-leads` (sem dependência entre si) → `campanhas` (depende dos dois primeiros) → `relatorios-origem` (depende de `campanhas`/`captura-leads`). **Os 5 specs de módulo estão escritos e aprovados em `docs/fase3/SPEC-<modulo>.md`.**

Três decisões de arquitetura fechadas com o usuário durante o Specify, todas registradas nos specs (e a primeira também em ADR própria):
- **`docs/decisoes/0005-fila-envios-worker-em-postgres.md`** — o worker da fila de envios roda inteiro em Postgres (`pg_cron` chamando uma função `plpgsql` direto), sem Edge Function nem `pg_net`, enquanto os providers de e-mail/WhatsApp forem mock — evita reabrir o problema de URL local-vs-hospedado que travou o agendamento do 1D-5 (nunca terminado). Muda quando a Fase 2 trocar o mock por integração real.
- Checagens de "conta ativa"/"limite do plano" do worker (`.claude/rules/Mensageria.md`) ficam de fora por enquanto — billing é Fase 4, as tabelas não existem; a ordem do worker já nasce pronta pra recebê-las na frente da cadeia.
- Webhook de entrada genérico (`captura-leads`) é uma RPC do Postgres direta (`.../rest/v1/rpc/receber_lead_webhook?apikey=...`), não uma Edge Function — mesma filosofia da ADR 0005. Sem anti-spam/CAPTCHA nesta fase (débito conhecido, documentado no spec, sem sinal de tráfego real ainda que justifique o esforço agora).

**Descoberta útil no caminho:** o trigger `notificar_lead_novo()` do 1D-5 já cobre o "alerta imediato ao responsável" que o PRD pede pra captura de leads — `captura-leads` não precisa de nenhuma notificação nova, só entregar o contato como `status='lead'` com `responsavel_id` já resolvido pela distribuição (rodízio/fixo).

**Escopo de `relatorios-origem` deliberadamente estreito** — só "leads por origem/UTM" e "desempenho de campanhas" (o resto do PRD §6.12 — conversão por etapa, tempo de fechamento, motivos de perda, taxa de renovação, follow-ups atrasados, clientes sem contato — fica pra um módulo de relatórios completo fora deste ciclo, nunca fez parte do recorte da ADR 0004).

Antes disso, ainda nesta sessão: **Fase 2 (WhatsApp) adiada por decisão do usuário; a Fase 3 recortada citada acima é a consequência direta disso.** Detalhe completo da decisão — o que exatamente entra/fica de fora e por quê — em `docs/decisoes/0004-fase2-adiada-fase3-sem-integracoes-externas.md`; `docs/PRD.md` §9 ganhou uma nota apontando pra lá, sem renumerar fases. Nenhum código de produto foi escrito nessa rodada — puramente documentação.

**Antes disso, ainda na sessão anterior (2026-09-15/16): retrabalho visual completo do produto ("Soft Professional") + polimento de produção + relógio/calendário na topbar** — não documentado até agora, atualizando aqui:
- **Sistema de design novo, do zero:** paleta indigo/emerald/amber/rose/blue, tipografia Plus Jakarta Sans (self-hosted via `@fontsource`, só até peso 800 — a família não tem 900/black no Fontsource, documentado em `docs/design-system.md`), substitui a identidade `ui-ux-pro-max` (teal/laranja + Calistoga) adotada no 1D-2. Especificação completa do usuário preservada em `docs/design-system.md`, pra servir de base em features novas.
- Duas rodadas de ajuste fino pedidas pelo usuário: raio de borda e velocidade de animação reduzidos (`--radius`, `duration-150`, controles/sidebar); contraste de card no tema claro corrigido (borda/fundo indistinguíveis); raio dos cards de destaque reduzido de novo (`card-lg` 2.5rem → 1.25rem).
- **Polimento "produção":** layout global (nome do usuário, busca, dropdown "+Criar", menu do usuário), componentes reutilizáveis novos (`Select` com truncamento, `EmptyState`), refinamentos na tela Início (cards+gráficos no topo, fontes homogêneas) e correção do scroll do kanban de Funis (`AppShell` migrou de `min-h-screen` pra `h-screen overflow-hidden` com `<main>` como único container de scroll — Funis passou a rolar internamente sem rolar a página).
- **Relógio + mini-calendário na topbar** (`RelogioCalendario` em `AppShell.tsx`): data/hora no fuso da empresa (nunca do navegador — `hojeNoFuso()`), atualiza a cada minuto, abre um popover com grade do mês corrente (só consulta, dia de hoje destacado). Componentes novos: `src/components/ui/popover.tsx` (primeiro uso de `@radix-ui/react-popover` no projeto), `src/app/useRelogio.ts`, `formatarDataHoraFuso`/`gradeCalendario` em `src/lib/datas.ts`, `capitalizarPrimeiraLetra` em `src/lib/formatadores.ts` (bug real corrigido: `text-transform: capitalize` do CSS maiuscula toda palavra, não só a primeira).
- Tudo commitado e enviado (push autorizado explicitamente pelo usuário) — `lint`/`typecheck`/`test`/`build` limpos em cada rodada.

**Redesenho arquitetural do núcleo do CRM (2026-09-15), concluído antes da rodada de UI acima, ainda antes de iniciar a Fase 2** — pedido do usuário: revisar o modelo de dados (workspaces/empresas, contatos, oportunidades/negócios, pipelines/funis, tarefas, atividades) e tornar as ligações entre entidades mais seguras/fáceis, "antes de conectar com redes sociais". Schema validado — **153/153 pgTAP** (102 da Fase 1 + 51 novas, incluindo os que provam as correções da revisão adversarial abaixo); `lint`/`typecheck`/`test` (25/25)/`build` limpos. Testado no navegador (login, `/funis`, exclusão via RPC real, sem erros de console).

**O que a revisão encontrou:** as tabelas existiam e a RLS protegia bem *quem lê o quê*, mas quase nenhuma ligação entre tabelas era garantida pelo banco — `negocios.funil_id` apontava só pra `funis(id)`, sem checar se o funil era da mesma empresa do negócio; `responsavel_id` aceitava qualquer usuário do sistema, mesmo sem crachá naquela empresa. Um usuário membro de duas empresas (cenário já suportado) conseguiria, em teoria, gravar um negócio de uma empresa apontando pra dados de outra — furo real de isolamento, não hipotético, e sem teste pgTAP cobrindo. Detalhe completo e a descoberta não-óbvia de RLS que isso desencadeou: `docs/decisoes/0003-integridade-multiempresa-por-chave-composta.md`.

**7 migrations novas, todas aditivas** (`20260915183000` a `20260915190000` — a 7ª veio da revisão adversarial, ver nota de processo abaixo):
1. **Integridade multiempresa** — `unique (empresa_id, id)` nas tabelas do núcleo + FKs simples viram compostas `(empresa_id, <fk>)`; `responsavel_id` passa a referenciar `empresa_membros (empresa_id, usuario_id)` em vez de `auth.users (id)`. Puramente declarativo, sem trigger.
2. **`organizacoes`** (nova entidade) — a pessoa jurídica cliente, distinta de `empresas` (que é o tenant/assinante). Contato pode continuar avulso (pessoa física, maioria no nicho de corretores) ou pertencer a uma organização. Mesmo padrão de RLS de `contatos`.
3. **Ligações que faltavam** — `negocios.vencimento_id`/`titulo`, `vencimentos.vencimento_anterior_id` (cadeia de renovação), `tarefas.vencimento_id`, `atividades.vencimento_id`/`tarefa_id`/`organizacao_id`, `etapas.tipo` (`normal`/`ganho`/`perdido`).
4. **Timeline automática** — o banco passa a registrar `atividades` sozinho (mudança de etapa, ganho, perda, tarefa concluída, vencimento renovado) em vez de depender do cliente lembrar. Corrige um bug real: `useMoverNegocio` fazia 2 chamadas HTTP separadas (mover + inserir atividade); se a segunda falhasse, o card mudava de coluna e a timeline ficava muda, sem rollback. `derivar_contexto_atividade`/`derivar_contexto_tarefa` também garantem que `contato_id` de uma atividade/tarefa ligada a um negócio bate com o `contato_id` real do negócio (antes, nada impedia divergência). `sincronizar_status_por_etapa` fecha o gap "arrastar o card pra coluna Ganho não marcava o negócio como ganho".
5. **Soft delete por padrão + dedup** — `deleted_at is null` entra na RLS de leitura das 5 tabelas com dono; CPF/CNPJ duplicado na mesma empresa passa a ser bloqueado por índice único parcial. **Descoberta no caminho:** não dá pra só colocar o filtro na `USING` de uma policy `FOR ALL` — o Postgres reaplica a `USING` de SELECT contra a linha nova em todo UPDATE, então a própria escrita que exclui se autobloqueava (confirmado experimentalmente, não por suposição). Solução: exclusão em si passou a ser uma função `security definer` (`excluir_registro`, simétrica à `restaurar_registro` que já estava planejada) — um `UPDATE` direto de `deleted_at` agora é rejeitado de propósito (42501). Corrige de quebra um bug real: a taxa de renovação na tela "Hoje" contava vencimentos excluídos (duas das cinco consultas de `useResumoNumeros` não filtravam `deleted_at`) — agora é impossível esquecer o filtro porque a RLS aplica sozinha.
6. **RPCs e view** — `mover_negocio_etapa` substitui as 2 chamadas de `useMoverNegocio` por uma transação só; `marcar_negocio_ganho`/`marcar_negocio_perdido` passaram a mover o card pra etapa especial do funil quando existir uma; `renovar_vencimento` encadeia `vencimento_anterior_id`; view `membros_empresa` (`security_invoker`) substitui a junção manual em 2 consultas que `useMembrosEmpresa` fazia (sem FK direta entre `empresa_membros` e `perfis`).

**Frontend ajustado ao mínimo pra não quebrar:** os 4 hooks `useExcluir*` (contato/vencimento/negócio/tarefa) passaram a chamar `excluir_registro` via RPC em vez de `UPDATE` direto; `useMoverNegocio` virou uma chamada RPC só; `useMembrosEmpresa` usa a view nova. Nenhuma tela nova — redesenho de interface fica pra quando o usuário pedir.

**Testes novos** (`supabase/tests/`): `integridade_multiempresa.sql`, `timeline_automatica.sql`, `etapas_ganho_perdido.sql`, `soft_delete.sql`, mais casos de `organizacoes` somados a `isolamento_multiempresa.sql`.

**Nota de processo:** a revisão adversarial via subagente (doubt-driven-development) que seria rodada sobre a proposta *antes* de implementar **falhou por limite de sessão da API** — os achados iniciais (gaps A–F) vieram só da minha leitura, sem segunda opinião. Rodei a revisão depois, sobre o resultado final já implementado, a pedido do usuário — encontrou **4 bugs reais confirmados contra o banco** (DELETE físico contornava o soft delete inteiro; `etapas.tipo` era código morto porque `aplicar_template` nunca setava; índice de vencimento-aberto não filtrava `deleted_at`; faltava FK por funil além da FK por empresa). Todos corrigidos, com testes novos provando cada um — **153/153 pgTAP** no total. Detalhe completo: `docs/decisoes/0003-integridade-multiempresa-por-chave-composta.md`.

<details>
<summary>Histórico — 1D-5: Notificações (central no app + push) (2026-09-15)</summary>

**Fase 1 — Fundação e núcleo. 1D-5 (Notificações: central no app + push) implementado — fecha o incremento 1D e a Fase 1 inteira.** Schema novo validado — 102/102 pgTAP (92 anteriores + 10 novas em `notificacoes.sql`); `lint`/`typecheck`/`test` (25/25)/`build` limpos; `npm audit` sem nada novo.

**Achado da pesquisa, antes de começar:** o PRD (§9) fecha a Fase 1 só com "PWA instalável" — já pronto desde o 1A. Push de verdade (§6.14) está listado dentro da **Fase 2**, junto com WhatsApp, e boa parte dos gatilhos que o PRD lista ali depende do WhatsApp (que não existe). Perguntei ao usuário como tratar isso — **decisão: construir a central de notificações + push agora, só pros gatilhos que não dependem de WhatsApp** (lead novo, follow-up vencido, resumo diário da tela "Hoje"); os gatilhos dependentes de WhatsApp entram na Fase 2, reaproveitando a mesma tabela.

**Primeira vez que o projeto usa Edge Functions, `pg_cron` e `pg_net`** — nenhum dos três existia até agora.

**Schema** (`supabase/migrations/20260915142929_notificacoes.sql`):
- `push_subscriptions` — 1:1 com o dispositivo do usuário (sem `empresa_id`, mesmo raciocínio de `perfis`), RLS por `usuario_id = auth.uid()`.
- `notificacoes` — dado de empresa; só criada por funções `security definer` (quem dispara o evento nem sempre é o destinatário). RLS: só o próprio destinatário lê/marca como lida, mesmo dentro da mesma empresa (notificação é pessoal, não por papel).
- Trigger `notificar_lead_novo()` em `contatos after insert` (status='lead') — notifica o responsável, ou todo dono/gestor se não tiver responsável.
- Função `gerar_notificacoes_diarias(p_agora timestamptz default now())` — agendada de hora em hora via `cron.schedule`, só age nas empresas cuja hora local (`empresas.fuso`) bate com 8h (evita mandar tudo num horário UTC fixo pra empresas em fusos diferentes); gera resumo diário + follow-up vencido, idempotente (não duplica no mesmo dia). O parâmetro `p_agora` existe só pra viabilizar teste determinístico — pgTAP não tem como "congelar" `now()`.

**Edge Function** (`supabase/functions/enviar-notificacoes-push/`, primeira do projeto) — varre `notificacoes` com `enviada_push_em is null`, resolve as `push_subscriptions` do destinatário e envia via Web Push (`npm:web-push`, Deno via `npm:` specifier — testado e confirmado funcionando: a function sobe, o import resolve, e a cadeia de autorização responde certo em cada etapa). Remove inscrições expiradas (404/410) automaticamente. Protegida por checagem própria de `service_role` (não é rota pra usuário comum disparar).

**Decisão consciente de escopo, não pendência técnica:** o agendamento automático que chamaria essa Edge Function periodicamente (`pg_cron` + `pg_net`) **não foi wireado nesta sessão** — a URL interna que o `pg_net` precisa pra alcançar a function varia de verdade entre local (rede Docker interna do stack) e um projeto hospedado real (que ainda não existe, nem staging nem produção), e eu não tinha como testar essa parte com confiança nesta sessão. Documentado como pendência explícita abaixo, não escondido.

**Service worker customizado:** `VitePWA` migrou de `generateSW` pra `injectManifest` (`src/sw.ts` novo) — o modo automático não permite estender com `push`/`notificationclick`. `src/sw.ts` ficou fora do `tsconfig.app.json` (precisa da lib `WebWorker`, incompatível com a lib `DOM` do resto do app) — `tsconfig.sw.json` novo, referenciado no `tsconfig.json` raiz.

**Frontend:** `src/features/notificacoes/` (slice novo) — sino de notificações no `AppShell` (desktop e mobile), botão "Ativar notificações push" (pede permissão do navegador, assina `PushManager`, salva em `push_subscriptions`).

</details>

<details>
<summary>Histórico — Correções de layout, rodada 2 (2026-09-14)</summary>

Bug real: faltava `min-w-0` na cadeia flex do `AppShell.tsx` (a `<div>` de conteúdo e o `<main>` que envolve o `<Outlet/>`) — item flex tem `min-width: auto` por padrão, recusa encolher abaixo do próprio conteúdo. Quando o kanban de Funis tinha colunas suficientes pra passar da largura da tela, era o container do conteúdo inteiro que se recusava a encolher (em vez de só a faixa de colunas rolar via `overflow-x-auto`, que já existia em `QuadroFunil.tsx`) — por isso a última coluna sumia sem scrollbar.

`Funil.tsx` voltou a ter a mesma largura das outras telas de navegação (`max-w-7xl`) — o `w-full` sem teto da rodada anterior tinha sido a tentativa errada de resolver o bug do scroll acima, e quebrou a consistência entre telas. Cards de negócio (`CardNegocio.tsx`) ganharam cor por fase — como as etapas são dinâmicas por empresa, a cor é escolhida pela posição da etapa no funil, ciclando por 6 matizes do Tailwind que não colidem com os tokens da marca.

</details>

<details>
<summary>Histórico — Correções de layout, rodada 1 (2026-09-14)</summary>

**Bug real:** `--popover`/`--popover-foreground` nunca tinham sido definidos em `globals.css`/`tailwind.config.ts`, mas `SelectContent`/`DropdownMenuContent` usam `bg-popover text-popover-foreground` desde que foram escritos — `hsl(var(--popover))` com variável inexistente virava cor inválida, fundo dos selects/menus ficava transparente e as opções ilegíveis. Corrigido.

Ajustes de gosto: paleta trocada de teal (`#0D9488`, achado "muito verde/escuro") pra azul mais claro (`#2563EB`, validado no `ui-ux-pro-max --domain color`); `border`/`muted` também dessaturados. Colunas do kanban trocaram de `bg-secondary/40` (painel na cor de marca) pra `bg-muted/60` (neutro). Larguras de conteúdo aumentadas em geral.

</details>

<details>
<summary>Histórico — 1D-4: Tela "Hoje" (2026-09-14)</summary>

Sem migration — tudo leitura sobre `contatos`/`vencimentos`/`negocios`/`tarefas`/`empresa_membros`, tabelas e RLS que já existiam. `src/app/paginas/Inicio.tsx` (rota `/`) deixou de ser placeholder: barra de progresso "Primeiros passos" (só os 3 itens viáveis na Fase 1 — decisão tomada com o usuário; "conectar WhatsApp"/"ativar régua" ficam pra quando a Fase 2 existir) + seções de ação por prioridade (leads sem primeiro contato, follow-ups via `ItemTarefa` do 1D-3, negócios com próximo passo vencido cruzando todos os funis, vencimentos pendentes, aniversariantes do dia) + 4 cards de resumo. Validado no navegador pelo usuário.

</details>

<details>
<summary>Histórico — 1D-3: Tarefas (2026-09-14)</summary>

Sem migration — a tabela `tarefas` já existia desde o 1A (RLS e isolamento já cobertos), então essa fatia foi puramente frontend. CRUD de tarefas (tipo, título, data, responsável, vínculo opcional com contato **ou** negócio) + concluir/reabrir, com destaque de atraso (mesmo `--urgencia`/`hojeNoFuso()` já usados em Funis). Sem página de detalhe própria — tarefa é leve o bastante pra ser criada/editada num diálogo (`DialogoTarefa`, mesmo padrão de `DialogoRenovacao`/`DialogoPerda`). Validado no navegador pelo usuário.

O `marcar_negocio_perdido` (1D-2) já criava a tarefa de reativação desde o incremento anterior, mas nada exibia isso em lugar nenhum — a aba "Tarefas" em `DetalheNegocio.tsx` é onde essa tarefa finalmente aparece pra alguém.

</details>

<details>
<summary>Histórico — 1D-2: Funis de venda + retrabalho visual ui-ux-pro-max (2026-09-14)</summary>

**Funis:** validado no navegador pelo usuário (quadro, arrastar card, ganho/perdido, alternância quadro/lista). Schema: trigger `atualizar_entrou_na_etapa()` (reseta a coluna quando `etapa_id` muda — PRD §6.5) + RPCs `marcar_negocio_ganho`/`marcar_negocio_perdido` (`security invoker`, mesmo raciocínio do `renovar_vencimento` do 1C-2). `hojeNoFuso(fuso)` existia desde o 1A e nunca tinha sido usado — `useEmpresas()` ganhou o campo `fuso`.

Bug de teste pgTAP pego antes de fechar (não é bug de produção): a primeira versão de `funis.sql` simulava a corretora Carla (papel `usuario`), mas dois dos negócios do seed têm responsável Gustavo (gestor) — `pode_acessar_responsavel` bloqueia silenciosamente updates fora do próprio responsável pra quem não é gestor+/carteira compartilhada (RLS não gera erro em UPDATE, só afeta 0 linhas), o que mascarou o teste de "perdido sem motivo". Corrigido trocando a simulação pra Gustavo.

**Retrabalho visual — adoção do `ui-ux-pro-max`:** depois de validar o 1D-2, o usuário instalou esse plugin e pediu pra reconstruir a identidade visual do zero com ele, "para que fique um projeto homogêneo desde o começo" — substitui a direção anterior (Fraunces + IBM Plex Sans, desenhada via `frontend-design` no 1D-1). Pesquisa com `search.py --design-system`/`--domain style,color,typography`:
- **Cor:** convergiu de forma independente em duas buscas diferentes no mesmo par **teal `#0D9488` + laranja `#EA580C`** — próximo do que já existia.
- **Estilo:** `data-dense-dashboard` + `Flat Design` (sem sombra decorativa em superfície — `Card`/`CardNegocio` perderam `shadow-sm`; overlays mantiveram sombra funcional).
- **Tipografia:** conflito real entre "seguir o plugin" e a diretriz anterior de evitar fontes genéricas de IA (Inter é citado nominalmente pela skill `frontend-design`) — usuário escolheu seguir o plugin integralmente: **Calistoga** (display) + **Inter** (corpo) + **JetBrains Mono** (rótulos), self-hosted via `@fontsource`.
- **Tokens:** `accent` do shadcn (hover de menu) ficou teal claro — não o laranja do plugin, que mapeia pro token `urgencia` já existente. Dark mode derivado por mim (o plugin não devolveu valores), mesma família de matiz.
- Nenhuma página foi reescrita — todas já usam os tokens semânticos, herdaram a nova identidade só com a troca de `globals.css`/`tailwind.config.ts`.

</details>

<details>
<summary>Histórico — 1D-1: Layout geral da plataforma (2026-09-14)</summary>

Sem mudança de schema. Tipografia Fraunces (display, self-hosted via `@fontsource-variable/fraunces`) + IBM Plex Sans (corpo, `@fontsource/ibm-plex-sans`) — só os subsets `latin`/`latin-ext` (+ `vietnamese`, que vem junto no pacote variable do Fraunces), não `cyrillic`/`greek`, pra não inflar bundle/precache do PWA com scripts que o produto (só PT-BR) nunca usa. Paleta papel/tinta quase-preta com teal profundo de primária e âmbar reservado só pra urgência de vencimento (tokens `--urgencia`, `--sidebar`, claro e escuro). Sidebar fixa no desktop (trocador de empresa + nav + menu de usuário, sem cabeçalho duplicado); barra superior fina + abas fixas embaixo no mobile. `RotaProtegida` virou guarda de autenticação pura; `AppShell` (novo) centraliza o redirect de quem não tem empresa.

</details>

<details>
<summary>Histórico — 1C-3: Importação de planilha (2026-09-14)</summary>

Schema (policy de insert em `importacao_erros`) validado — 82/82 pgTAP; lógica pura de mapeamento de colunas e deduplicação com 11 testes Vitest próprios (25 no total do projeto); `lint`/`typecheck`/`test`/`build` limpos.

Decisão de arquitetura tomada com o usuário: processamento no navegador (não Edge Function + Storage) — mesmo raciocínio do convite manual no 1B. Achado no caminho: a `xlsx` (SheetJS) do npm registry tem duas vulnerabilidades de severidade alta sem correção (`npm audit`); trocada por duas libs mantidas — `papaparse` (CSV) e `exceljs` (XLSX), ambas carregadas via `import()` dinâmico pra não pesar o bundle principal de quem nunca usa a importação (confirmado no build: chunks separados de 18.68 kB e 929.55 kB, bundle principal cresceu só ~12 kB).

</details>

<details>
<summary>Histórico — 1C-2: Vencimentos (2026-09-14)</summary>

Schema (`renovar_vencimento()`) validado — 80/80 pgTAP; frontend (lista com filtros, ficha com mudança de status, diálogo de renovação que sugere a próxima data pra recorrência mensal/anual) confirmado funcionando no navegador pelo usuário.

Bug de teste pgTAP pego antes de fechar (não é bug do código de produção): a primeira asserção do `vencimentos.sql` filtrava por `descricao` sozinha pra checar o vencimento original — depois de `renovar_vencimento()`, existem *duas* linhas com a mesma descrição de propósito (a função copia a descrição pro próximo), então a query virou ambígua (`more than one row returned by a subquery`). Corrigido combinando `descricao` com o `valor` original do seed pra mirar só na linha antiga.

</details>

<details>
<summary>Histórico — 1C-1: Contatos (2026-09-14)</summary>

Schema (trigger `ultimo_contato_em`) validado — 75/75 pgTAP; frontend (lista com filtros, ficha com timeline, formulário com campos personalizados dinâmicos e tags, registro rápido "Como foi?") confirmado funcionando no navegador pelo usuário.

Dois bugs de tipagem pegos pelo `tsc`, corrigidos antes de rodar qualquer coisa:
- `useContatos.ts`: filtro por tag usava um `select()` condicional (string muda conforme o filtro) — o supabase-js não consegue tipar isso em tempo de compilação (`ParserError`). Resolvido buscando os ids em `contato_tags` primeiro e filtrando com `.in("id", ids)` depois, em vez de tentar embutir o join na mesma query.
- `useMembrosEmpresa` (1B, só usado agora): tentava `empresa_membros.select("perfis(nome)")`, mas não há FK direta entre as duas tabelas (as duas só se relacionam via `auth.users`) — o PostgREST não embeda relações transitivas. Resolvido com duas consultas (busca os membros, depois busca os perfis por `id`, junta em memória).

</details>

<details>
<summary>Histórico — 1B: auth, onboarding, convites (2026-09-14)</summary>

72/72 asserções pgTAP (51 do 1A + 21 novas), fluxo real via `curl` contra a API do Supabase local, e teste manual no navegador confirmando cadastro → criar empresa → convidar → aceitar convite funcionando de ponta a ponta.

Quatro bugs de UX encontrados e corrigidos durante o teste manual (não pegos pelos testes automatizados, que não cobrem navegação/React Query):
- Mensagem de erro genérica em `AceitarConvite.tsx` escondia a causa real (token inválido vs. e-mail errado vs. expirado) — agora mostra a mensagem específica que `aceitar_convite()` devolve.
- Não havia botão de logout em lugar nenhum — impossível voltar pra `/entrar`/`/cadastro` depois de logado. Adicionado em `RotaProtegida.tsx` (cabeçalho, aparece em toda rota autenticada).
- Convite pendente não podia ser recuperado nem cancelado depois que o link sumia da tela (ex.: após dar refresh) — `Convidar.tsx` ganhou "Copiar link" e "Cancelar" por convite.
- Corrida de dados: mutações de `useCriarEmpresa`/`useAceitarConvite` invalidavam a query de empresas sem aguardar (`void queryClient.invalidateQueries(...)`), então `navigate()` acontecia antes da lista atualizar e a tela seguinte via "0 empresas" por um instante. Corrigido pra aguardar a invalidação antes de resolver a mutação.
- `Cadastro.tsx` ignorava de onde o usuário veio e sempre mandava pra `/onboarding` — quem clicava "Criar conta" a partir de um link de convite perdia o convite e acabava criando a própria empresa por engano. Agora preserva `location.state.de`, igual o `Entrar.tsx` já fazia.

**Achado de segurança** (skill `security-check`): `aceitar_convite` confia em `auth.email()`, que só é confiável se o Supabase Auth exigir confirmação de e-mail. Localmente `enable_confirmations = false` (de propósito) — em produção isso **precisa** virar `true`. Ver "Pré-requisitos de lançamento" abaixo.

</details>

<details>
<summary>Histórico — validação do 1A (2026-09-11)</summary>

`npm run db:reset` aplica as 6 migrations + seed sem erro; `npm run test:db` passou com as 51 asserções pgTAP (0 falhas); `npm run lint`, `npm run typecheck` e `npm run test` (14/14) passaram com `src/types/database.ts` gerado de verdade.

A primeira rodada contra Postgres real encontrou 2 bugs reais, já corrigidos:
- **`seed.sql`**: um `update` de backfill de `created_by` também sobrescrevia `responsavel_id` de todos os contatos da empresa Alfa, quebrando o teste de carteira compartilhada (Carla via 0 contatos em vez de 3). Corrigido para só tocar `created_by`.
- **`supabase/tests/*.sql`**: os testes usavam `is(...)` sem o `select` na frente (erro de sintaxe) e o padrão `(update ... returning id) x` como subquery em `FROM`, que o Postgres não aceita — uma CTE que modifica dados (`update`/`delete ... returning`) só pode estar no nível raiz da instrução. Também corrigido um teste que esperava exceção (`throws_ok`, SQLSTATE `42501`) num `update` de `nicho_templates` que na verdade é bloqueado silenciosamente (0 linhas afetadas) por não ter nenhuma policy de `update`.

</details>

### Pré-requisitos de lançamento (não é dev local — bloqueia qualquer ambiente real)

1. **`supabase/config.toml` → `auth.email.enable_confirmations` precisa ser `true`** no projeto Supabase de staging/produção (o `false` local é intencional, só pra dev). Sem isso, `aceitar_convite` (que compara `auth.email()` com `convites.email`) pode ser contornado por alguém que se cadastra com um e-mail que não possui. Achado 🟠 ALTO do `security-check` em 2026-09-14 — ver detalhes no relatório da sessão (não persistido em arquivo, só no chat; resumo fica aqui).

### O que existe

**Scaffold frontend** (`package.json`, `vite.config.ts`, `tsconfig*.json`, `eslint.config.js`, `.prettierrc.json`, `tailwind.config.ts`, `postcss.config.js`, `components.json`, `index.html`):
- Vite + React 18 + TypeScript strict + Tailwind + shadcn/ui (config pronta, nenhum componente copiado ainda) + TanStack Query + React Router + React Hook Form/Zod (deps instaladas, não usadas ainda) + `vite-plugin-pwa`.
- `src/app/` — `App.tsx`, `router.tsx` (uma rota `/` de smoke test), `providers.tsx` (QueryClient + VocabularioContext), `useTema.ts` (dark mode), `globals.css` (variáveis shadcn), `paginas/Smoke.tsx`.
- `src/lib/` — `supabase.ts` (cliente, lança erro se faltar env var), `datas.ts` (hoje no fuso, formatação BR, diferença em dias — testado), `formatadores.ts` (BRL, telefone, CEP, CPF/CNPJ com validação de dígito verificador — **14 testes em `formatadores.test.ts`, todos passando**), `vocabulario.ts` (contrato da regra "nada de nicho no código"), `utils.ts` (`cn()`).
- `src/types/database.ts` — **gerado de verdade** via `npm run db:types` (1306 linhas, todas as tabelas do 1A). Não editar à mão.
- `npm run lint`, `npm run typecheck`, `npm run test` (14/14) e `npm run build` (gera PWA com service worker) — todos verificados passando com o schema real.

**Schema Supabase** (`supabase/migrations/`, 6 arquivos, ordem cronológica no nome):
1. `..._extensoes_e_helpers.sql` — extensão `pgcrypto`, `empresas`, `empresa_membros`, e as 4 funções de isolamento (`is_membro`, `tem_papel`, `carteira_compartilhada`, `pode_acessar_responsavel`) — todas `security definer` com `search_path = ''`. Ver `docs/decisoes/0001-isolamento-multiempresa.md` para o porquê.
2. `..._plataforma.sql` — `convites`, `plataforma_admins` (sem `empresa_id` de propósito).
3. `..._nicho_templates.sql` — catálogo global de templates de nicho, somente leitura.
4. `..._nucleo.sql` — `contatos`, `campos_personalizados`, `tags`, `contato_tags`, `vencimento_tipos`, `vencimentos`, `funis`, `etapas`, `motivos_perda`, `negocios` (próximo passo obrigatório, perdido exige motivo), `atividades` (timeline append-only), `tarefas`.
5. `..._sistema.sql` — `consentimentos` (append-only), `audit_log` (append-only, `revoke update/delete` explícito).
6. `..._importacoes.sql` — `importacoes`, `importacao_erros`.

Toda tabela de dados tem RLS habilitada e política — nenhuma usa `using (true)` exceto `nicho_templates` (justificado em comentário na própria migration: dado global, sem `empresa_id` por natureza).

**Seed** (`supabase/seed.sql`): duas empresas fictícias — **Seguros Alfa** (carteira não compartilhada) e **Seguros Beta** (carteira compartilhada) — com usuários (dono/gestor/usuario), funis+etapas, tipos de vencimento, motivos de perda, tags, contatos, vencimentos espalhados no tempo, negócios em etapas variadas (um ganho, um perdido) e tarefas. Login de teste: qualquer e-mail semeado (ex.: `dono@segurosalfa.test`), senha `facility123`.

**Testes pgTAP** (`supabase/tests/`, 51 asserções, todas passando):
- `isolamento_multiempresa.sql` (43 asserções) — para praticamente toda tabela com `empresa_id`, prova que um usuário da Alfa não lê/altera/apaga/insere dados da Beta (e vice-versa via setup). Usa `throws_ok` com SQLSTATE `42501` só para INSERT bloqueado por `with check` e para `update`/`delete` em tabela com `revoke` explícito (`audit_log`); as demais checagens de `update`/`delete` verificam `0` linhas afetadas via CTE no nível raiz.
- `carteira_compartilhada.sql` (5 asserções) — papel `usuario` sem carteira compartilhada só vê o que é seu; gestor vê tudo por papel; `usuario` na empresa com carteira compartilhada vê tudo mesmo sem ser responsável.
- `plataforma_admins.sql` (3 asserções) — isolamento por linha própria (tabela sem `empresa_id`).

**Documentação:**
- `docs/decisoes/0001-isolamento-multiempresa.md` — por que `security definer`, o padrão `pode_acessar_responsavel`, e a decisão (não confirmada pelo dono do produto) de restringir escrita de tags/funis/etapas/motivos/tipos de vencimento a gestor+.
- `docs/decisoes/0002-interface-de-comandos.md` — por que npm scripts + Makefile fino (sem `make` no Windows local).
- `CLAUDE.md` e `README.md` atualizados com o estado atual e os comandos reais.
- `Makefile` (delega para npm scripts).

**1B — schema** (`supabase/migrations/20260914132658_onboarding.sql`):
- `perfis` — 1:1 com `auth.users` (nome/telefone do cadastro, que não têm onde morar em `auth.users`). Populada por trigger `criar_perfil()` em `auth.users after insert`. RLS: vê o próprio perfil sempre; vê perfil de quem compartilha empresa.
- `aplicar_template(empresa_id, nicho)` — copia `nicho_templates` (vencimento_tipos, funis+etapas, motivos_perda, tags, vocabulário) pra dentro da empresa. Não idempotente (nota MÉDIA do security-check — ver acima).
- `criar_empresa_com_onboarding(nome, nicho, aceite_termos)` — bootstrap: cria empresa, vira dono, aplica template, registra aceite de termos em `audit_log`. `security definer`, só cria empresa nova (nunca aceita `empresa_id` existente).
- `aceitar_convite(token)` — valida token/expiração/e-mail, cria `empresa_membros`, marca convite como aceito. `security definer`.
- `nicho_templates.funis` (seed) populado com os funis "Venda nova" (7 etapas) e "Renovação" (5 etapas) do PRD §3.3 — antes estava vazio.
- `supabase/config.toml`: `auth.site_url`/`additional_redirect_urls` corrigidos de `:3000` pra `:5173` (porta real do Vite).

**1B — frontend:**
- `src/components/ui/` — primeiros componentes shadcn/ui do projeto (`button`, `input`, `label`, `card`, `select`, `checkbox`), escritos à mão porque o `npx shadcn add` travou numa confirmação interativa (não roda bem via shell não-interativo).
- `src/features/auth/` — `AuthProvider`/`useAuth()` (sessão via `supabase.auth.onAuthStateChange`), telas `Entrar`/`Cadastro` (e-mail+senha, RHF+Zod).
- `src/features/onboarding/` — `useEmpresas`/`useEmpresaAtual` (lista + seleção persistida em `localStorage`, só o UUID), `useCriarEmpresa`/`useAceitarConvite`/`useConvites`/`useCriarConvite` (chamam as funções RPC acima), telas `CriarEmpresa`/`Convidar`/`AceitarConvite`.
- `src/app/RotaProtegida.tsx`/`RotaPublica.tsx` — guards client-side (só UX; a RLS é quem protege de verdade), `paginas/Inicio.tsx` (placeholder pós-login, some no 1D), `paginas/Termos.tsx`/`Privacidade.tsx` (texto legal pendente — PRD §5.4 marca como "fornecido pelo dono do produto", não inventei conteúdo).
- `providers.tsx` ganhou `AuthProvider` e um `VocabularioProvider` que resolve o vocabulário da empresa atual (`src/lib/vocabulario.ts` ganhou `mesclarVocabulario()`).
- `src/app/paginas/Smoke.tsx` removida — substituída pela rota `/` de verdade (`Inicio.tsx`).

**1C-1 — schema** (`supabase/migrations/20260914163110_contatos_ultimo_contato.sql`):
- Trigger `atualizar_ultimo_contato()` em `atividades after insert` — atualiza `contatos.ultimo_contato_em` quando a atividade tem `contato_id`. `security invoker` (não precisa bypassar RLS).

**1C-1 — frontend:**
- `src/components/ui/` ganhou `table`, `dialog`, `tabs`, `textarea`, `badge` (deps novas: `@radix-ui/react-dialog`, `@radix-ui/react-tabs`).
- `src/features/onboarding/api/useEmpresas.ts` ganhou `useMembrosEmpresa()` — lista membros da empresa com nome, pro seletor de "responsável".
- `src/features/contatos/` — `api/` (`useContatos` com filtros de status/temperatura/tag/busca, `useContato`, `useCamposPersonalizados`, `useTags`/`useTagsDoContato`/`definirTagsDoContato`, `useAtividades`/`useRegistrarAtividade`, `useMutacoesContato` — criar/atualizar/excluir com soft delete), `schemas.ts` (`construirContatoSchema()` monta a validação em runtime a partir dos `campos_personalizados` da empresa), `components/CampoPersonalizado.tsx` (renderiza texto/número/data/seleção/booleano), `components/TimelineContato.tsx`, `paginas/ListaContatos.tsx`, `paginas/FormularioContato.tsx` (criar e editar), `paginas/DetalheContato.tsx` (ficha com abas Dados/Timeline + modal "Como foi?").
- Rotas novas: `/contatos`, `/contatos/novo`, `/contatos/:id`, `/contatos/:id/editar`.
- Fora do escopo, de propósito (ver plano do 1C-1): ações em massa, busca global (Ctrl+K), tarefa real a partir do "próximo passo" do registro rápido (fica texto livre até a tela de tarefas existir no 1D).

**1C-2 — schema** (`supabase/migrations/20260914165753_renovar_vencimento.sql`):
- `renovar_vencimento(vencimento_id, nova_data, novo_valor, novos_campos)` — fecha o vencimento atual (`status = 'renovado'`) e cria o próximo (`status = 'pendente'`) na mesma transação. `security invoker` — não bypassa RLS, o usuário já precisa ter acesso de escrita ao vencimento original.

**1C-2 — frontend:**
- `src/lib/datas.ts` ganhou `somarPeriodo(data, "mes"|"ano", n)` — sugere a próxima data numa renovação mensal/anual.
- `src/lib/camposPersonalizados.ts` (novo) — extraído de `contatos/schemas.ts`: a validação dinâmica de campos personalizados (`validarCamposPersonalizados`) agora é compartilhada entre Contatos e Vencimentos, em vez de duplicada.
- `CampoPersonalizado` (componente) e `useCamposPersonalizados` (hook, ambos em `contatos/`) generalizados: o componente virou genérico em `TFormValues`, o hook ganhou o parâmetro `entidade: "contato" | "vencimento"`. Vencimentos importa os dois de `contatos/` — ainda não relocados pra um lugar neutro (nota de arquitetura, não bloqueante).
- `src/features/vencimentos/` — `api/` (`useVencimentos` com filtros de status/tipo/responsável/período, `useVencimento`, `useVencimentoTipos`, `useMutacoesVencimento` — criar/atualizar/excluir/mudar status/`useRenovarVencimento`), `schemas.ts`, `components/DialogoRenovacao.tsx` (sugere data pra mensal/anual, pede pra escolher em única/personalizada), `paginas/ListaVencimentos.tsx`, `paginas/FormularioVencimento.tsx` (aceita `?contatoId=` pra pré-preencher), `paginas/DetalheVencimento.tsx`.
- `DetalheContato.tsx` ganhou uma aba "Vencimentos" listando os vencimentos daquele contato.
- Rotas novas: `/vencimentos`, `/vencimentos/novo`, `/vencimentos/:id`, `/vencimentos/:id/editar`.
- Fora do escopo, de propósito (decisão tomada com o usuário): visão de calendário, anexos/Supabase Storage. Fora do escopo estrutural (não é decisão, é dependência): card automático no funil de Renovação (precisa de Funis do 1D + `pg_cron` da Fase 2).

**1C-3 — schema** (`supabase/migrations/20260914175322_importacao_erros_insert.sql`):
- Policy de `insert` em `importacao_erros` pra `authenticated` (`is_membro(empresa_id)`) — a migration original (1A) só tinha `select`, porque presumia um worker `service_role`. Decisão desta fase: processamento no navegador, então precisa da policy de verdade.

**1C-3 — frontend:**
- **Dependências:** `xlsx` foi cogitada e descartada (2 vulnerabilidades altas sem correção no npm — ver "Estado atual"); `papaparse` (CSV) + `exceljs` (XLSX) no lugar, ambas com `@types` ou tipagem própria, carregadas via `import()` dinâmico só dentro de `parseArquivo.ts`.
- `src/features/importacao/` — `logica/` (funções puras, sem Supabase, testadas em Vitest): `mapeamentoColunas.ts` (sugestão automática de coluna→campo por sinônimo), `deduplicacao.ts` (compara contra contatos existentes + dedup dentro do próprio arquivo), `processarLinhas.ts` (aplica mapeamento + valida, reusa `validarCPF`/`validarCNPJ`), `parseArquivo.ts` (lê `.csv`/`.xlsx`), `modeloPlanilha.ts` (gera o CSV de exemplo pra download); `api/useImportacao.ts` (cria/finaliza a linha em `importacoes`, registra erro por linha, busca contatos existentes pra dedup); `paginas/ImportarContatos.tsx` (wizard de 4 passos numa página só — Upload → Mapear → Prévia → Resultado — mesmo estilo do `DialogoRenovacao` do 1C-2, sem rota por passo).
- Rota nova: `/contatos/importar`, com link em `ListaContatos.tsx`.
- Contato importado nasce com `status: "cliente"` (não "lead") — julgamento de que importação de planilha normalmente é migração de carteira existente, não captação de leads novos. Revisável.
- Linha com `dataVencimento` preenchida também cria um `vencimento` vinculado (recorrência = a do tipo encontrado por nome, ou "anual" se não achar correspondência).
- Fora de escopo, de propósito (decisão tomada com o usuário): "dados de exemplo removíveis com um clique" do PRD §6.1 — é uma feature de seed de demonstração, conceitualmente separada de "importar minha planilha real".
- Inserção linha a linha (não em lote) — simples e correto, mas arquivos muito grandes demoram mais. Otimização de lote fica pra depois, se precisar.

**1D-1 — layout geral da plataforma:**
- **Dependências:** `@fontsource-variable/fraunces`, `@fontsource/ibm-plex-sans`, `@radix-ui/react-dropdown-menu`. `npm audit` limpo (só a vulnerabilidade moderada já revisada do `uuid` via `exceljs`, sem nada novo).
- `src/app/globals.css` — tokens de cor novos (`--urgencia`, `--sidebar`, claro/escuro) + `@import` dos subsets `latin`/`latin-ext` das fontes (sem `cyrillic`/`greek`, produto é só PT-BR).
- `tailwind.config.ts` — `fontFamily.display` (Fraunces) e `fontFamily.sans` (IBM Plex Sans, substitui o sans padrão), cores `urgencia`/`sidebar`.
- `src/components/ui/dropdown-menu.tsx` (novo, escrito à mão como os outros).
- `src/app/AppShell.tsx` (novo) — sidebar fixa no desktop (trocador de empresa só aparece com mais de uma empresa, nav Início/Contatos/Vencimentos, menu de usuário com "Sair"); barra superior + abas fixas no mobile. Redireciona pra `/onboarding` se `empresas.length === 0`.
- `src/app/RotaProtegida.tsx` — simplificado pra guarda de autenticação pura.
- `src/app/router.tsx` — reestruturado: `RotaProtegida` (auth) por fora; dentro, `/onboarding` solto e um segundo nível `AppShell` envolvendo `/`, `/contatos*`, `/vencimentos*`, `/convidar`.
- `src/app/paginas/Inicio.tsx` — removido o redirect (foi pro `AppShell`) e os botões de navegação ad-hoc (viraram nav de verdade na sidebar/abas).
- Fora de escopo, de propósito: busca global Ctrl+K (PRD §4, ciclo próprio); itens de nav pra Funis/Tarefas (entram só quando essas telas existirem no 1D-2/1D-3, pra não ter link morto).

**1D-2 — funis de venda (kanban):**
- **Dependência nova:** `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`. `npm audit` limpo (mesma vulnerabilidade moderada já revisada, nada novo).
- `supabase/migrations/20260914191220_funis_negocios.sql` — trigger `atualizar_entrou_na_etapa()` (reseta a coluna ao mudar de etapa) + RPCs `marcar_negocio_ganho`/`marcar_negocio_perdido` (ambas `security invoker`, mesmo raciocínio do `renovar_vencimento` do 1C-2).
- `src/features/onboarding/api/useEmpresas.ts` — `EmpresaMembro` ganhou `fuso` (não era selecionado antes; Funis é a primeira tela que precisa de "hoje" de verdade).
- `src/features/funis/` — `api/` (`useFunis`, `useEtapas`, `useMotivosPerda`, `useNegocios`/`useNegocio`/`useNegociosDoContato`, `useMutacoesNegocio` — criar/atualizar/excluir, `useMoverNegocio` grava atividade `mudanca_etapa` na timeline, `useMarcarGanho`/`useMarcarPerdido` chamam as RPCs), `schemas.ts`, `components/` (`QuadroFunil` com dnd-kit, `CardNegocio`, `DialogoProximoPasso` — confirma/troca o próximo passo ao mover um card, `DialogoPerda`, `ListaNegocios`), `paginas/` (`Funil` — quadro/lista alternáveis, lista é o padrão no mobile, `FormularioNegocio`, `DetalheNegocio` — ações de ganho/perda).
- `src/app/AppShell.tsx` — item "Funis" na nav (sidebar e abas).
- Rotas novas: `/funis`, `/funis/negocios/novo`, `/funis/negocios/:id`, `/funis/negocios/:id/editar`.
- `DetalheContato.tsx` ganhou aba "Negócios", no mesmo molde da aba "Vencimentos" do 1C-2.
- Fora de escopo, de propósito (decisão tomada com o usuário): edição de funis/etapas (vai pra uma futura fatia de Configurações, PRD §8, junto com tipos de vencimento/campos personalizados/tags/motivos de perda — mesmo problema, mesma solução).
- Fora de escopo, estrutural (não é decisão, é dependência): card automático no funil de Renovação a partir de vencimentos (PRD §6.4) — precisa de `pg_cron`, Fase 2.

**1D-3 — tarefas:**
- **Sem migration.** `tarefas` já existia desde o 1A (RLS `tarefas_por_responsavel` + isolamento em `isolamento_multiempresa.sql`) — fatia puramente frontend.
- `src/lib/vocabulario.ts` — ganhou `tarefa`/`tarefaPlural`.
- `src/features/tarefas/` (slice novo) — `api/` (`useTarefas`/`useTarefa` com filtros de status/tipo/responsável/contato/negócio, `useMutacoesTarefa` — criar/atualizar/excluir e `useAlternarConclusaoTarefa`, update direto de `concluida_em`, sem RPC porque é escrita de uma coluna só), `schemas.ts`, `components/` (`DialogoTarefa` — criar/editar em diálogo, não página própria; `ItemTarefa` — checkbox de concluir/reabrir, ícone por tipo, destaque em `--urgencia` quando atrasada), `paginas/ListaTarefas.tsx` (agrupada em Atrasadas/Hoje/Próximas quando o filtro é "pendentes").
- `src/app/AppShell.tsx` — item "Tarefas" na nav. Rota nova: `/tarefas`.
- `DetalheContato.tsx`/`DetalheNegocio.tsx` — aba/seção "Tarefas". É aqui que a tarefa de reativação criada pelo `marcar_negocio_perdido` do 1D-2 finalmente fica visível em algum lugar.
- Fora de escopo, de propósito: Cadências (PRD §6.6, depende de templates de mensagem — Fase 2); tela "Hoje" (1D-4); notificação de tarefa (depende de push, 1D-5).

**1D-4 — tela "Hoje":**
- **Sem migration.** Tudo leitura sobre `contatos`/`vencimentos`/`negocios`/`tarefas`/`empresa_membros`, tabelas e RLS que já existiam.
- `src/features/hoje/` (slice novo) — `api/useResumoHoje.ts` (`useLeadsSemContato`, `useNegociosVencidos` — variante de negócios sem exigir `funilId`, diferente de `useNegocios` que é por funil, `useVencimentosPendentesHoje`, `useAniversariantesHoje` — filtro de mês/dia no cliente, `useResumoNumeros` — 5 contagens via `count: "exact", head: true`, `usePrimeirosPassos` — 3 contagens), `components/` (`SecaoAcoesHoje`/`ItemAcao` — wrapper genérico que some quando a seção está vazia, `CardsResumo`, `BarraPrimeirosPassos` — some quando os 3 itens estão completos).
- `src/app/paginas/Inicio.tsx` — deixou de ser placeholder; reusa `ItemTarefa`/`DialogoTarefa` do 1D-3 pra seção de follow-ups (mesma UX de `/tarefas`, sem duplicar código).
- **Decisão tomada com o usuário:** checklist "Primeiros passos" só com os 3 itens viáveis na Fase 1 (importar contatos, cadastrar vencimento, convidar equipe) — "conectar WhatsApp" e "ativar régua" entram quando a Fase 2 existir.
- Fora de escopo, de propósito: clientes que responderam a lembrete (inbox WhatsApp, Fase 2); clientes esfriando (PRD marca como Fase 5); notificação push do resumo diário (1D-5).

**Correções de layout (pós-1D-4, reportadas pelo usuário):**
- **Bug real:** `--popover`/`--popover-foreground` nunca tinham sido definidos — `Select`/`DropdownMenu` usavam `bg-popover` desde que foram escritos, ficavam com fundo transparente/opções ilegíveis. Corrigido em `globals.css`/`tailwind.config.ts`.
- Paleta trocada de teal pra azul mais claro (`#2563EB`, `ui-ux-pro-max --domain color`); `border`/`muted` dessaturados junto (eram um ciano forte).
- `QuadroFunil.tsx`: colunas do kanban de `bg-secondary/40` (painel na cor de marca) pra `bg-muted/60` (neutro) — pedido explícito de "outra forma de construir", não só recolorir.
- Larguras: telas de navegação (`Inicio`/`ListaContatos`/`ListaVencimentos`/`ListaTarefas`/`Funil`) em `max-w-7xl`, todas com a mesma largura; fichas de detalhe em `max-w-3xl`; formulários de coluna única mantidos em `max-w-2xl` (alargar formulário simples piora a leitura).

**Correções de layout, rodada 2 (pós-teste em tela grande):**
- **Bug real:** faltava `min-w-0` na cadeia flex do `AppShell.tsx` (div de conteúdo + `<main>`) — item flex com `min-width: auto` não encolhia, então o kanban de Funis empurrava a página inteira em vez de rolar só a faixa de colunas (`overflow-x-auto`, que já existia em `QuadroFunil.tsx`), e a última coluna sumia sem scrollbar. Corrigido.
- `Funil.tsx` voltou a `max-w-7xl` — o `w-full` da rodada 1 tinha sido a tentativa errada de resolver o bug do scroll acima (achava que era falta de espaço), e quebrava a consistência de largura com as outras telas.
- `CardNegocio.tsx`: cor por fase — 6 matizes do Tailwind (violet/pink/amber/emerald/cyan/fuchsia) ciclando pela **posição** da etapa no funil (etapas são dinâmicas por empresa, não dá pra colorir por nome), faixa na borda esquerda + fundo sutil, claro e escuro. Destaque de "próximo passo vencido" (chip interno `--urgencia`) não mudou.

**1D-5 — notificações (central no app + push):**
- **Schema novo** (`supabase/migrations/20260915142929_notificacoes.sql`) — `push_subscriptions`, `notificacoes`, trigger `notificar_lead_novo()`, função `gerar_notificacoes_diarias(p_agora timestamptz default now())` + `cron.schedule` de hora em hora. Habilita `pg_cron`/`pg_net` (primeira vez que o projeto usa qualquer um dos dois).
- **Edge Function nova** (`supabase/functions/enviar-notificacoes-push/`, primeira do projeto) + `supabase/functions/_shared/supabaseAdmin.ts` — envia Web Push via `npm:web-push` (Deno). Testada manualmente com `supabase functions serve` + `curl`: sobe sem erro de import, e a cadeia de autorização responde certo (gateway rejeita JWT malformado → função rejeita quem não é `service_role` → função acusa VAPID não configurado quando chamada como `service_role` de verdade).
- `vite.config.ts`/`src/sw.ts` (novo) — `VitePWA` migrou de `generateSW` pra `injectManifest`, service worker customizado ouve `push`/`notificationclick`. `tsconfig.sw.json` novo (lib `WebWorker`, incompatível com a lib `DOM` do resto do app).
- `src/features/notificacoes/` (slice novo) — `api/` (`useNotificacoes`/`useMarcarNotificacaoLida`/`useMarcarTodasLidas`, `usePush` — gerencia a inscrição do `PushManager`), `components/SinoNotificacoes.tsx` (integrado no `AppShell`, desktop e mobile).
- Fora de escopo, de propósito: gatilhos dependentes de WhatsApp (Fase 2); preferências de notificação por tipo; retry sofisticado de envio (o cron reprocessa pendentes no próximo ciclo, é idempotente).
- **Decisão consciente, não pendência técnica:** o agendamento automático `pg_cron`→`pg_net` chamando a Edge Function não foi wireado — a URL interna varia entre local e um projeto hospedado real (que ainda não existe), não dava pra testar com confiança nesta sessão. Ver pendência abaixo.

### Pendências conhecidas

1. **`.env.example` ainda não existe.** Mesmo motivo da sessão anterior (deny de `.claude/settings.json` bloqueia `Write`/`Edit` em `**/.env.*`, sem distinguir `.env.example`). `.env.local` já foi criado manualmente pelo usuário com os valores do Supabase local (confirmado no chat, não verificável por mim — leitura de `.env.local` também é negada pela mesma regra). Conteúdo do `.env.example` que falta criar:
   ```
   # .env.example (raiz, sem valores, vai pro git)
   # Copie para .env.local (gitignored) e preencha com os valores do seu Supabase
   # local (saída de `npm run supabase:start`) ou do projeto de staging/produção.
   # Nunca coloque a service_role aqui — ela só existe em Edge Functions.

   VITE_SUPABASE_URL=
   VITE_SUPABASE_ANON_KEY=
   ```
2. **Decisões de produto não confirmadas** (documentadas na ADR 0001): quem pode criar/editar tags vs. funis/etapas/motivos de perda/tipos de vencimento. Hoje: tags abertas a qualquer membro; o resto restrito a gestor+. Revisável.
3. **Trial de 14 dias é placeholder** (`criar_empresa_com_onboarding`) — PRD §7 não define a duração real (`[PREENCHER]`).
4. **`Convidar.tsx` gera o link mas não envia e-mail** — decisão tomada na sessão do 1B (entrega manual, sem Edge Function de e-mail). Revisar quando a infra de mensageria (Fase 2) existir.
5. **1C-3 (Importação de planilha) não foi testado no navegador ainda** — a lógica pura (mapeamento, dedup) tem 11 testes Vitest, o schema tem pgTAP, e `lint`/`typecheck`/`build` passam, mas o fluxo completo (upload real de um .csv/.xlsx, mapeamento, prévia, criação em massa) só foi verificado por leitura de código nesta sessão.
6. **1D-1 (Layout geral) validado no navegador pelo usuário** — sidebar, abas mobile, tema e trocador de empresa confirmados funcionando.
7. **1D-2 (Funis) validado no navegador pelo usuário** — quadro, arrastar card, ganho/perdido confirmados funcionando.
8. **Achado de UX corrigido:** `/onboarding` não tinha botão de "Sair" (fica fora do `AppShell`, que é quem tem o menu de usuário) — sessão inválida (ex.: usuário apagado por `db:reset` local) prendia quem estava ali sem jeito de deslogar pela interface. Corrigido em `CriarEmpresa.tsx` com um botão "Sair" próprio.
9. **Retrabalho visual (adoção do `ui-ux-pro-max`) validado no navegador pelo usuário** — paleta, tipografia e alternância de tema claro/escuro confirmados funcionando (o alternador só foi ligado ao menu de usuário depois de o usuário notar que não achava onde trocar — `useTema()` existia desde o 1A mas nunca tinha sido chamado por nenhum componente).
10. **1D-3 (Tarefas) e 1D-4 (Tela "Hoje") validados no navegador pelo usuário.**
11. **Correções de layout pós-1D-4 (duas rodadas: bug do `--popover`, paleta azul, colunas do kanban sem tingimento, bug do `min-w-0`/scroll do kanban, largura consistente entre telas, cor por fase nos cards de negócio) não foram testadas no navegador ainda** — `lint`/`typecheck`/`test`/`build` passam, mas só foram verificadas por leitura de código nesta sessão.
12. **1D-5 (Notificações) precisa de configuração manual antes de testar no navegador** — eu não posso criar/editar arquivo `.env*` (mesma regra de permissão de sempre):
    - `.env.local` (raiz) precisa ganhar `VITE_VAPID_PUBLIC_KEY=BP3YYuwXd-Th9oWilqJBd3LG8zE7wr1ntwjTvOV_v0nJ3crExUgo21hj5KFKhE1RQc7mB4OirYf50ZBu0J1erh8`.
    - `supabase/functions/.env` (novo arquivo, local-only) precisa existir com:
      ```
      VAPID_PUBLIC_KEY=BP3YYuwXd-Th9oWilqJBd3LG8zE7wr1ntwjTvOV_v0nJ3crExUgo21hj5KFKhE1RQc7mB4OirYf50ZBu0J1erh8
      VAPID_PRIVATE_KEY=8N_eg_ot1EX4uohRZkssE-gVKjRqY12X3PIGThkjpv4
      VAPID_SUBJECT=mailto:suporte@facility.app
      ```
      (chaves geradas nesta sessão via `npx web-push generate-vapid-keys` — únicas pra este projeto, mas ainda assim só pra dev local; gerar um par novo pra staging/produção quando existirem.)
13. **Agendamento automático da Edge Function de push não foi wireado** (decisão consciente, não bug) — falta um `pg_cron` chamando `enviar-notificacoes-push` via `pg_net`, o que depende da URL interna do stack (diferente em local vs. um projeto hospedado real, que ainda não existe). Até lá, dá pra disparar manualmente: `curl -X POST http://127.0.0.1:54321/functions/v1/enviar-notificacoes-push -H "Authorization: Bearer <service_role key do `supabase status`>"` (com `supabase functions serve` rodando).

## Próximos passos imediatos (ao retomar, nesta ordem)

1. `git clone` (ou `pull`) o repositório na máquina nova.
2. Abrir o **Docker Desktop** — pré-requisito para tudo abaixo.
3. `npm install`.
4. Criar `.env.example` (conteúdo acima) e `.env.local` (mesmo formato, com valores reais — rode `npm run supabase:start` e use a `API_URL`/`ANON_KEY` que ele imprimir).
5. `npm run db:reset` — aplica as 12 migrations + seed do zero.
6. `npm run test:db` — roda os 9 arquivos pgTAP (102 asserções). **Portão de aceite.**
7. `npm run db:types` — regenera `src/types/database.ts` (já commitado, mas regenere se mudar alguma migration).
8. `npm run dev` — testar no navegador o fluxo de Importação: em `/contatos/importar`, baixar o modelo, preencher com uma linha válida + uma com CPF inválido + uma duplicada de um contato do seed, subir o CSV, conferir o mapeamento automático, a prévia com os três status, confirmar, e checar que só a válida virou contato (e vencimento, se a coluna de data foi preenchida).
9. Resolver a pendência de lançamento (`enable_confirmations`) **antes** de criar qualquer projeto Supabase de staging/produção.
10. **1D-2, 1D-3, 1D-4 e o retrabalho visual (`ui-ux-pro-max`) já validados no navegador.**
11. Testar as **correções de layout pós-1D-4** no navegador (numa tela grande, é onde o bug de largura apareceu): abrir um `Select`/`DropdownMenu` em claro e escuro — fundo sólido e legível; conferir a paleta azul; abrir `/funis` e conferir que a largura é igual à de `/`, `/contatos`, `/vencimentos`, `/tarefas`, e que — se o funil tiver etapas suficientes — a faixa de colunas rola horizontalmente *dentro* da tela, sem empurrar a página nem cortar a sidebar; conferir que cada etapa colore os cards de negócio de forma diferente (claro e escuro) e que o destaque de próximo-passo-vencido continua visível.
12. Criar `.env.local`/`supabase/functions/.env` com as chaves VAPID (conteúdo na pendência 12 acima) antes de testar o **1D-5**.
13. Testar o **1D-5** no navegador: logar, clicar no sino → "Ativar notificações push" (o navegador vai pedir permissão); criar um lead sem responsável (como gestor) → conferir notificação na central pro dono e pro gestor; rodar `supabase functions serve` + o `curl` da pendência 13 → conferir que a notificação chega como push do SO e some da lista de pendentes; marcar uma notificação como lida e testar "marcar todas como lidas".
14. Depois de validado, o **1D inteiro fecha a Fase 1**.
15. **Fase 2 (WhatsApp) fica adiada** — decisão do usuário (2026-09-16), ver `docs/decisoes/0004-fase2-adiada-fase3-sem-integracoes-externas.md`. Não iniciar sem o usuário pedir explicitamente; quando pedir, o levantamento do caminho de credenciamento da Meta (PRD §6.7) continua sendo pré-requisito antes de codar.
16. **Fase 3 recortada — planejamento completo (Specify), nada implementado.** Capability map + 5 specs de módulo em `docs/fase3/` (`CAPABILITY-MAP.md`, `SPEC-fila-envios.md`, `SPEC-segmentos.md`, `SPEC-captura-leads.md`, `SPEC-campanhas.md`, `SPEC-relatorios-origem.md`). Próximo passo, quando o usuário pedir: revisão final (principalmente `SPEC-relatorios-origem.md`, cuja única pendência é posição na navegação) e então Plan/Tasks (Fase 2/3 do `spec-driven-development`) módulo a módulo, na ordem `fila-envios`+`segmentos`+`captura-leads` → `campanhas` → `relatorios-origem`.

## Roteiro dos incrementos da Fase 1

(1C dividido em três fatias — 1C-1 Contatos, 1C-2 Vencimentos, 1C-3 Importação — cada uma com seu próprio ciclo de plano, como 1A/1B/1C-1 tiveram.)

- **1A — fundação** (este documento): schema, RLS, isolamento. Implementado e validado (51/51 pgTAP).
- **1B — entrada:** auth Supabase (e-mail+senha), onboarding com `criar_empresa_com_onboarding()`/`aplicar_template()`, convites (link manual). Implementado e validado (72/72 pgTAP + fluxo real via curl). Checklist "Primeiros passos" **adiado pro 1D** de propósito (decisão tomada com o usuário — a maioria dos itens depende de telas que só existem em 1C/1D).
- **1C-1 — Contatos:** lista com filtros, ficha com timeline, campos personalizados dinâmicos, tags, registro rápido "Como foi?". Implementado e validado (pgTAP + navegador).
- **1C-2 — Vencimentos:** lista com filtros, ficha, renovação (`renovar_vencimento()` + diálogo de confirmação). Implementado e validado (pgTAP + navegador).
- **1C-3 — Importação de planilha:** CSV/XLSX, mapeamento automático, dedup (PRD §6.1). Processamento no navegador (decisão tomada com o usuário). Implementado, validado por pgTAP + Vitest + lint/typecheck/build; teste no navegador pendente. **1C inteiro fechado com esta fatia.**
- **1D — operação** (dividido em cinco fatias, mesmo padrão de 1A/1B/1C):
  - **1D-1 — Layout geral:** sidebar (desktop)/abas (mobile), trocador de empresa, tema visual do produto inteiro (Fraunces + IBM Plex Sans, paleta papel/teal/âmbar-urgência). Implementado e validado no navegador.
  - **1D-2 — Funis:** kanban com dnd-kit + visão em lista, negócios, próximo passo obrigatório, ganho/perda. Implementado e validado no navegador. Edição de funis/etapas fica pra uma futura fatia de Configurações.
  - **Retrabalho visual (`ui-ux-pro-max`):** depois do 1D-2 validado, o usuário instalou o plugin `ui-ux-pro-max` e pediu pra reconstruir a identidade visual do 1D-1+1D-2 com ele, pra ficar homogêneo desde o início — substitui a direção anterior (Fraunces/IBM Plex Sans) por Calistoga/Inter/JetBrains Mono + paleta teal/laranja. Detalhes no "Estado atual" acima e na memória `project_1d_visual_design`. Aplicado via troca de tokens (`globals.css`/`tailwind.config.ts`), sem reescrever páginas. Implementado e validado no navegador (inclusive o alternador de tema claro/escuro, ligado ao `useTema()` que existia desde o 1A mas nunca tinha sido chamado por nada).
  - **1D-3 — Tarefas:** CRUD de tarefas (diálogo, não página própria) + concluir/reabrir, vínculo opcional com contato ou negócio, destaque de atraso. Sem migration (schema/RLS já existiam desde o 1A). Implementado e validado no navegador. Cadências ficam pra Fase 2 (dependem de templates de mensagem).
  - **1D-4 — Tela "Hoje":** substitui o placeholder de `Inicio.tsx` — leads sem primeiro contato, follow-ups de hoje/atrasados, negócios com próximo passo vencido, vencimentos pendentes, aniversariantes, cards de resumo, checklist "Primeiros passos" (só os 3 itens viáveis na Fase 1 — decisão tomada com o usuário). Sem migration. Implementado e validado no navegador.
  - **Correções de layout pós-1D-4** (duas rodadas, reportadas pelo usuário): bug do `--popover` faltando (selects/menus transparentes), paleta reclarada pra azul, colunas do kanban sem tingimento de cor; depois, bug do `min-w-0` faltando no `AppShell` (kanban empurrava a página em vez de rolar), largura consistente entre todas as telas de navegação, cor por fase nos cards de negócio. Teste no navegador pendente.
  - **1D-5 — Notificações (central no app + push):** escopo recortado — só os gatilhos que não dependem de WhatsApp (lead novo, follow-up vencido, resumo diário). Primeira vez que o projeto usa Edge Functions/`pg_cron`/`pg_net`. Implementado, validado por pgTAP (102/102) + lint/typecheck/build; teste no navegador pendente (precisa das chaves VAPID em `.env.local`/`supabase/functions/.env` primeiro). Agendamento automático da Edge Function via `pg_cron`→`pg_net` fica pendente de propósito — depende da URL de um projeto Supabase hospedado real, que ainda não existe. **Fecha o 1D inteiro — e a Fase 1.**
  - **Diretriz do usuário pro visual (vale pro 1D inteiro, não só 1D-1):** atual, sem cara de IA, padrão de produto SaaS de verdade — não os defaults genéricos do shadcn/ui. Registrada na memória de projeto `project_1d_visual_design`.
