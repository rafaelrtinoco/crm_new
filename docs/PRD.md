# Prompt — CRM SaaS de Relacionamento e Marketing

> **Como usar:** salve no repositório como `docs/PRD.md`, preencha os campos `[PREENCHER]` e peça ao agente: *"Leia docs/PRD.md e execute apenas a Fase 1, seguindo as Regras de Execução da seção 10."* Avance uma fase por vez.

---

## 1. Seu papel

Você é um engenheiro de software full-stack sênior e product builder com experiência em produtos SaaS B2B multiempresa. Vai construir o **Facility**, um CRM simples focado em **relacionamento e marketing** para pequenos negócios que vivem de carteira de clientes e contratos com vencimento.

## 2. Visão do produto

**Promessa:** o usuário nunca perde um vencimento, nunca esquece um cliente e sabe exatamente com quem falar hoje.

**Quem vende:** [PREENCHER — nome da empresa], agência de apoio digital para empresas do ramo administrativo (social media, site com bot e tráfego pago). O CRM complementa esses serviços: os leads dos anúncios e do bot do site entram direto no CRM, e os relatórios de origem mostram o retorno do investimento.

**Nicho de lançamento:** corretores de seguros (seguros, planos de saúde, odonto, consórcio). O sistema deve ser genérico por arquitetura, para atender outros negócios administrativos apenas com configuração.

**O que o produto é:** gestão de leads, funil de vendas, controle de vencimentos com lembretes automáticos aos clientes, follow-up, campanhas e relacionamento.

**O que o produto NÃO é:** sistema de gestão de apólices, financeiro, comissões, sinistros, cotação ou emissão. Ele convive com os sistemas que o cliente já usa, recebendo a carteira por importação de planilha.

## 3. Modelo genérico e nichos

### 3.1 Entidades centrais (valem para qualquer nicho)

- **Contato:** lead e cliente são o mesmo registro; muda apenas o status (lead, cliente, inativo).
- **Vencimento:** qualquer compromisso com data, com ou sem recorrência — apólice, plano de saúde, contrato de honorários, certificado digital, contrato de aluguel, licenciamento etc.
- **Negócio:** oportunidade dentro de um funil.

Tudo que for específico de um nicho entra como **configuração**, nunca como código: rótulos, campos personalizados, tipos de vencimento, funis, réguas e templates de mensagem.

### 3.2 Modelo de nicho (template)

Ao criar a conta, o usuário escolhe o nicho e o sistema aplica um template com:
- **Vocabulário:** como o sistema chama cada entidade (ex.: "Vencimento" aparece como "Apólice" ou "Contrato").
- **Campos personalizados** para contatos e vencimentos.
- **Tipos de vencimento**, cada um com recorrência padrão e régua de lembrete sugerida.
- **Funis e etapas**, motivos de perda e tags iniciais.
- **Réguas de automação e templates de mensagem** prontos.
- **Calendário de marketing** do nicho (Fase 5).

Templates são armazenados como dados (JSON versionado ou tabelas globais). Depois de aplicados, o cliente pode editar tudo livremente.

### 3.3 Template de lançamento: Corretora de seguros

- **Tipos de vencimento:** seguro auto, residencial, vida, empresarial, fiança locatícia, viagem, plano de saúde (aniversário de contrato/reajuste), plano odontológico e consórcio. Recorrência padrão: anual, exceto viagem (única).
- **Campos do vencimento:** ramo, seguradora/operadora, nº da apólice ou contrato (texto livre), valor, veículo/placa (auto) e quantidade de vidas (saúde).
- **Funil Venda nova:** Novo lead → Primeiro contato → Cotação → Proposta enviada → Negociação → Ganho | Perdido.
- **Funil Renovação:** alimentado automaticamente pelos vencimentos. Etapas: A contatar → Em contato → Proposta de renovação → Renovado | Não renovado.
- **Motivos de perda:** preço, fechou com outro, sem retorno, desistiu, sem perfil.
- **Réguas:** renovação (30, 15 e 7 dias antes + 1 dia após, se não resolvido), reajuste de saúde (60 dias antes), aniversário e boas-vindas.

### 3.4 Teste de generalidade (não implementar agora)

O modelo precisa suportar os nichos abaixo **apenas com configuração**. Valide o schema contra eles antes de propor as migrations:
- **Escritório contábil:** certificado digital, declaração de IR, contrato de honorários, alvará.
- **Imobiliária / administradora:** contrato de locação, reajuste anual, seguro incêndio, vistoria.
- **Despachante:** licenciamento, renovação de CNH, transferência.

## 4. Stack e regras técnicas

- **Frontend:** React + Vite + TypeScript (strict), Tailwind CSS + shadcn/ui, React Router, TanStack Query, React Hook Form + Zod, Recharts e dnd-kit (kanban). Instalável como **PWA** desde a Fase 1.
- **Backend:** Supabase — Postgres, Auth, Row Level Security, Storage, Edge Functions (webhooks, envios, billing), pg_cron (réguas e rotinas diárias), filas para envios em massa (ex.: Supabase Queues/pgmq) e Realtime (inbox e notificações).
- **Deploy:** Vercel. Segredos só em variáveis de ambiente; a `service_role` nunca vai para o frontend.
- **Banco:** migrations SQL versionadas; tabelas e colunas em português, `snake_case`; `created_at`, `updated_at` e `created_by` em todas as tabelas; soft delete nas entidades principais.
- **Padrões Brasil:** pt-BR, BRL, dd/mm/aaaa, fuso configurável por empresa (padrão America/Sao_Paulo); máscaras e validação de CPF, CNPJ, telefone e CEP.
- **Mobile first:** o público usa muito pelo celular. Botões de ligar e abrir WhatsApp em um toque.
- **Busca global (Ctrl+K)** por nome, telefone, e-mail e CPF/CNPJ.
- **Integrações** sempre atrás de adaptadores (`WhatsAppProvider`, `EmailProvider`, `BillingProvider`, `AIProvider`), com implementação mock para desenvolvimento.

## 5. Multiempresa, perfis e segurança

### 5.1 Isolamento entre empresas
- Tabela `empresas` (tenant) e `empresa_membros` (usuário ↔ empresa ↔ papel). Um usuário pode pertencer a mais de uma empresa e alternar entre elas.
- Todas as tabelas de dados têm `empresa_id` e políticas RLS baseadas em funções auxiliares (ex.: `is_membro(empresa_id)`, `tem_papel(empresa_id, papel)`).
- **Testes automatizados de isolamento** são obrigatórios: um usuário da empresa A nunca lê, altera ou conta registros da empresa B, inclusive via Realtime, Storage e Edge Functions.
- Arquivos no Storage organizados por `empresa_id`, com políticas próprias.
- Limites de uso e rate limit por empresa.

### 5.2 Papéis dentro da empresa
| Papel | Acesso |
|---|---|
| Dono | Tudo, incluindo assinatura, cobrança e exclusão da conta |
| Gestor | Todos os contatos, funis, campanhas, réguas e relatórios; convida usuários |
| Usuário | Seus contatos e negócios. Uma configuração da empresa permite "carteira compartilhada", em que todos veem tudo |

### 5.3 Administração da plataforma (backoffice interno)
- Área `/admin`, acessível apenas a quem está em `plataforma_admins`.
- Lista de empresas com nicho, plano, status da assinatura, data de criação, último acesso e uso (contatos, usuários, envios no mês).
- Ações: alterar plano, estender trial, bloquear/desbloquear conta.
- **Acesso de suporte** somente com autorização do cliente dada dentro do sistema, com prazo de expiração e registro em log.
- Métricas do SaaS: contas ativas, trials, conversão trial → pago, MRR, churn e ativação (empresas que importaram contatos e ativaram ao menos uma régua).

### 5.4 LGPD
- A empresa cliente é **controladora** dos dados dos seus contatos; a plataforma atua como **operadora**. O cadastro exige aceite de Termos de Uso, Política de Privacidade e acordo de tratamento de dados (textos fornecidos por mim).
- Consentimento por contato (data, canal e finalidade: atendimento e/ou marketing) e histórico de opt-out.
- Exportação completa dos dados da empresa (CSV/ZIP) a qualquer momento.
- Exclusão de conta com período de retenção configurável antes da remoção definitiva.
- Log de auditoria para ações sensíveis: exportações, exclusões em massa e acessos de suporte.

## 6. Módulos

### 6.1 Onboarding
- **Cadastro:** nome, e-mail, WhatsApp, nome da empresa e nicho → aplica o template → inicia o trial.
- **Checklist "Primeiros passos"** com barra de progresso: importar contatos, cadastrar vencimentos, conectar WhatsApp, ativar a régua de renovação e convidar a equipe.
- **Importação guiada de planilha (CSV/XLSX):** upload, mapeamento de colunas (com sugestão automática pelo nome da coluna), prévia, validação e relatório de erros. Uma mesma linha pode gerar contato + vencimento. Deduplicação por telefone, e-mail e CPF/CNPJ.
- Modelo de planilha para download, específico do nicho.
- Dados de exemplo opcionais para o usuário explorar o sistema, removíveis com um clique.

### 6.2 Tela "Hoje" (tela inicial)
Uma lista única de ações do dia, ordenada por prioridade. Cada item tem ação em um toque (WhatsApp, ligar, concluir, reagendar):
1. Leads novos sem primeiro contato, com tempo de espera.
2. Clientes que responderam a um lembrete pedindo atendimento humano.
3. Follow-ups de hoje e atrasados.
4. Vencimentos que entram na régua hoje sem envio automático (ex.: WhatsApp não conectado).
5. Aniversariantes do dia.
6. Clientes esfriando (Fase 5).

Abaixo da lista: cards resumidos com leads da semana, negócios em aberto, vencimentos dos próximos 30 dias e taxa de renovação do mês.

### 6.3 Contatos
- Status (lead, cliente, inativo), temperatura (Quente / Morno / Frio), origem, UTMs, responsável, tags, data de nascimento, endereço e campos personalizados do nicho.
- **Timeline única:** mensagens de WhatsApp, e-mails, notas, ligações registradas, tarefas, mudanças de etapa, vencimentos e respostas de campanhas.
- **Registro rápido de contato:** após ligar ou chamar no WhatsApp, o sistema pergunta "Como foi?" (resultado + nota curta + próximo passo).
- `ultimo_contato_em` atualizado automaticamente a cada interação.
- Ações em massa: adicionar tag, trocar responsável, incluir em cadência ou campanha, exportar.

### 6.4 Vencimentos
- Contato, tipo, descrição, data de vencimento, valor opcional, recorrência (única, mensal, anual, personalizada), responsável, campos do nicho e anexos.
- **Status:** pendente → em régua → cliente respondeu → em negociação → renovado | não renovado | cancelado.
- Ao marcar **renovado**, criar automaticamente o próximo vencimento conforme a recorrência, perguntando se os dados mudaram.
- Visões em lista e calendário, com filtros por período, tipo, responsável e status.
- Todo vencimento que entra na janela configurada gera um card no funil de Renovação.

### 6.5 Funis de venda
- Kanban com arrastar e soltar, e visão em lista. Múltiplos funis por empresa, com etapas editáveis.
- **Negócio:** contato, funil, etapa, valor estimado, responsável, previsão de fechamento e **próximo passo obrigatório** (data + ação).
- Mover um card ou registrar um contato exige definir ou confirmar o próximo passo. Negócios com próximo passo vencido aparecem destacados e entram na tela "Hoje".
- Tempo parado na etapa visível no card.
- **Perdido:** motivo obrigatório e campo "reativar em", que cria uma tarefa futura.
- **Ganho:** marca o contato como cliente e oferece cadastrar o vencimento correspondente.

### 6.6 Follow-up e tarefas
- Tarefas com tipo (ligar, WhatsApp, e-mail, reunião, outro), data, responsável e vínculo com contato ou negócio.
- **Cadências:** sequências de passos (ex.: dia 0 WhatsApp, dia 2 ligação, dia 5 WhatsApp, dia 10 e-mail). Cada passo é automático (envio de template) ou manual (tarefa).
- A cadência pausa automaticamente quando o contato responde e encerra quando o negócio é ganho ou perdido.
- Cadências prontas no template do nicho.

### 6.7 WhatsApp
**Conexão**
- API oficial (WhatsApp Business Platform / Cloud API da Meta) atrás do `WhatsAppProvider`. Cada empresa cliente conecta **o próprio número** por um fluxo de cadastro guiado dentro do sistema.
- Antes de implementar, levante e me apresente o caminho atual exigido pela Meta para plataformas que conectam números de terceiros (ex.: Tech Provider com Embedded Signup, ou parceria com um BSP), incluindo custos e pré-requisitos. Não use bibliotecas não oficiais baseadas no WhatsApp Web.
- Custos de mensagens: [PREENCHER — pagos pela empresa cliente direto à Meta ou incluídos no plano].

**Envio e recebimento**
- Webhook em Edge Function com validação de assinatura, idempotência por ID de mensagem e roteamento para a empresa correta pelo número.
- **Janela de 24h:** dentro dela, mensagem livre; fora dela, apenas templates aprovados. A interface mostra o tempo restante e oferece os templates quando a janela está fechada.
- Gestão de templates: criar, enviar para aprovação, acompanhar status e usar variáveis (`{{primeiro_nome}}`, `{{tipo_vencimento}}`, `{{data_vencimento}}`, `{{nome_responsavel}}`).
- **Botões de resposta rápida nos lembretes** (ex.: "Quero renovar", "Falar com atendente", "Já resolvi"). A resposta atualiza o status do vencimento, cria tarefa quando necessário e aparece na tela "Hoje".
- Botão ou palavra de opt-out ("SAIR") nos templates de marketing, com bloqueio automático de novos envios de marketing.

**Inbox (simples)**
- Lista de conversas (filtros: minhas, não lidas, sem responsável), chat com texto, emoji, imagem, áudio e documento, e ficha lateral do contato com temperatura, tags, negócio aberto, vencimentos e botão "agendar follow-up".
- Número desconhecido cria lead com origem WhatsApp. Número conhecido é vinculado à timeline.
- Respostas rápidas acionadas por "/".
- Atualização em tempo real e notificação de nova mensagem.

### 6.8 Automações (réguas)
- Construtor simples: **gatilho → condição → ação**.
- **Gatilhos:** X dias antes/depois de um vencimento, aniversário, contato criado, etapa alterada, sem resposta há X dias, resposta de botão, data "reativar em".
- **Ações:** enviar template de WhatsApp, enviar e-mail, criar tarefa, mover etapa, adicionar tag, alterar temperatura, notificar usuário.
- Envios respeitam horário comercial da empresa, consentimento, opt-out e limites do plano.
- Histórico de execução por régua e por contato, com motivo quando um envio não acontece.

### 6.9 Campanhas
- **Segmentos dinâmicos salvos:** status, temperatura, tags, origem, tipo e mês de vencimento, cidade, faixa de idade, responsável, sem contato há X dias e campos personalizados.
- **Canais:** WhatsApp (templates) e e-mail (editor simples com blocos, via `EmailProvider`).
- Prévia com dados reais de um contato, agendamento, envio em fila com limite de velocidade e horário comercial.
- Apenas contatos com consentimento de marketing; opt-out respeitado.
- **Métricas:** enviados, entregues, lidos/abertos, respondidos, opt-outs e negócios gerados em até X dias.

### 6.10 Captura de leads
- **Formulários** configuráveis, com código para embutir no site e link público.
- **Página de captura simples** (título, texto, imagem, formulário, botão de WhatsApp) com a marca da empresa, em URL própria (`/p/{empresa}/{pagina}`).
- **Webhook de entrada** autenticado por token, para bots de site, landing pages e ferramentas externas.
- Integração com Meta Lead Ads.
- Captura automática de UTMs e origem; distribuição do lead (rodízio ou responsável fixo) e alerta imediato ao responsável.

### 6.11 Relacionamento
- **Termômetro de relacionamento:** dias desde o último contato por cliente e lista de "clientes esfriando" com limite configurável (padrão: 90 dias).
- **Detalhes pessoais:** campo livre (filhos, time, preferências) exibido em destaque na ficha e antes de ligar ou enviar mensagem.
- **Eventos de vida:** registrar casamento, nascimento de filho, mudança, carro novo ou abertura de empresa gera uma oportunidade sugerida conforme regras do nicho.
- **NPS:** pesquisa automática após renovação ou venda. Notas 9–10 recebem pedido de indicação (link rastreável que cria lead vinculado a quem indicou) e convite para avaliar a empresa no Google (link configurado pela empresa).
- **Indicações:** quem indicou, status, negócio gerado, recompensa e ranking dos clientes que mais indicam.
- **Cartões de aniversário:** imagem gerada automaticamente com o nome do cliente, logo e cores da empresa, enviada pela régua de aniversário.
- **Calendário de marketing do nicho:** datas e ganchos mês a mês, cada um com mensagem sugerida e segmento pronto para virar campanha em um clique.

### 6.12 Relatórios
Leads por origem e campanha; conversão por etapa do funil; tempo médio de fechamento; motivos de perda; taxa de renovação por tipo de vencimento e responsável; desempenho de campanhas e réguas; follow-ups atrasados por usuário; clientes sem contato. Exportação em XLSX e PDF.

### 6.13 Assistente com IA (via `AIProvider`)
- Sugerir mensagem de follow-up com base na timeline do contato.
- Resumir conversas longas do WhatsApp.
- Criar campanha a partir de um objetivo em linguagem natural, sugerindo segmento e texto.
- Sugerir temperatura do lead a partir da conversa.
- Sempre com revisão humana antes de enviar ou alterar dados. Uso limitado por plano.

### 6.14 Notificações
Central de notificações no app e push no PWA para: lead novo, resposta de cliente a lembrete, mensagem recebida, follow-up vencido e resumo diário da tela "Hoje".

### 6.15 Configurações da empresa
Dados da empresa, logo e cores (usados em mensagens, cartões, páginas e PDFs), horário comercial, fuso, usuários e papéis, carteira compartilhada, funis e etapas, tipos de vencimento, campos personalizados, tags, motivos de perda, templates, respostas rápidas, conexões (WhatsApp, e-mail, Meta Lead Ads, webhooks) e exportação de dados.

## 7. Planos e cobrança

| Plano | Usuários | Contatos | Envios/mês | Recursos |
|---|---|---|---|---|
| [PREENCHER] | [PREENCHER] | [PREENCHER] | [PREENCHER] | [PREENCHER] |

- Limites e recursos controlados por **feature flags por plano**, nunca espalhados pelo código.
- Uso mensal contabilizado por empresa, com aviso ao atingir 80% e 100% de cada limite.
- Trial de [PREENCHER] dias com todos os recursos do plano [PREENCHER].
- Cobrança recorrente via `BillingProvider` (gateway com cartão, boleto e PIX — [PREENCHER]), com webhook de pagamento, upgrade/downgrade e histórico de faturas.
- **Inadimplência:** aviso → carência de [PREENCHER] dias → modo somente leitura (automações e envios pausados). Dados nunca são apagados por falta de pagamento.

## 8. Modelo de dados (ponto de partida)

Proponha o SQL completo a partir desta base, ajustando o que for necessário:

- **Plataforma:** `empresas`, `empresa_membros`, `convites`, `plataforma_admins`, `nicho_templates`, `planos`, `assinaturas`, `faturas`, `uso_mensal`, `acessos_suporte`
- **Núcleo:** `contatos`, `campos_personalizados`, `tags`, `contato_tags`, `vencimento_tipos`, `vencimentos`, `funis`, `etapas`, `negocios`, `motivos_perda`, `atividades` (timeline), `tarefas`
- **Follow-up e automação:** `cadencias`, `cadencia_passos`, `cadencia_inscricoes`, `automacoes`, `automacao_execucoes`
- **Comunicação:** `whatsapp_contas`, `conversas`, `mensagens`, `templates_mensagem`, `respostas_rapidas`, `email_envios`
- **Marketing:** `segmentos`, `campanhas`, `campanha_envios`, `formularios`, `paginas_captura`, `integracoes` (tokens de webhook), `datas_marketing`
- **Relacionamento:** `eventos_vida`, `pesquisas_nps`, `indicacoes`
- **Sistema:** `consentimentos`, `notificacoes`, `audit_log`

## 9. Fases de entrega

- **Fase 1 — Fundação e núcleo:** multiempresa com RLS e testes de isolamento, autenticação, convites, onboarding com template de corretora, importação de planilha, contatos, vencimentos, funis com próximo passo obrigatório, tarefas, tela "Hoje" e PWA instalável.
- **Fase 2 — WhatsApp e réguas:** conexão do número, envio e recebimento, templates com botões, inbox simples, automações de vencimento e aniversário, cadências de follow-up e notificações.
- **Fase 3 — Marketing e captura:** segmentos, campanhas por WhatsApp e e-mail, formulários, páginas de captura, webhook de entrada, Meta Lead Ads e relatórios por origem.
- **Fase 4 — Monetização:** planos, feature flags, limites de uso, trial, cobrança recorrente e backoffice `/admin`.
- **Fase 5 — Relacionamento:** termômetro, detalhes pessoais, eventos de vida, NPS, indicações, avaliação no Google, cartões de aniversário e calendário de marketing.
- **Fase 6 — Inteligência e expansão:** assistente com IA, novos templates de nicho (contabilidade, imobiliária, despachante), relatórios avançados e API pública.

## 10. Regras de execução (siga à risca)

1. Antes de escrever código, entregue: (a) SQL das migrations e políticas RLS da fase, (b) como o schema atende aos nichos da seção 3.4, (c) estrutura de pastas, (d) lista de telas e componentes. **Aguarde minha aprovação.**
2. Implemente **uma fase por vez**. Não antecipe funcionalidades de fases futuras, mas não tome decisões de schema que as impeçam.
3. Nenhum texto específico de nicho fica fixo no código: rótulos, campos, funis e mensagens vêm do template da empresa.
4. Ao final de cada fase, informe: o que foi feito, como testar passo a passo, decisões tomadas e pendências.
5. Integrações externas: interface + mock. Nunca invente endpoints, credenciais ou formatos de API; quando precisar da documentação atual de um provedor, avise.
6. Crie seeds com duas empresas fictícias do nicho corretora, com contatos, vencimentos em várias datas e negócios em várias etapas, para testar as telas e o isolamento entre empresas.
7. Se algum requisito estiver ambíguo ou conflitar com a stack, pergunte antes de decidir.
8. UX para uso diário e rápido: poucos cliques, estados de carregamento e vazio bem resolvidos (com orientação do que fazer), mensagens de erro claras em português e modo escuro.