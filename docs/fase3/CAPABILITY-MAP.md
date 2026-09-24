# Capability Map — Fase 3 recortada

Aprovado pelo usuário em 2026-09-16. Escopo e o que fica de fora: `docs/decisoes/0004-fase2-adiada-fase3-sem-integracoes-externas.md`. Referências de PRD: §6.9 (Campanhas), §6.10 (Captura de leads), §6.12 (Relatórios), §8 (modelo de dados).

| Module id | Responsabilidade | Depende de |
|---|---|---|
| `fila-envios` | Fila de envios genérica (fundação): checa consentimento, opt-out, horário comercial da empresa e janela de 24h antes de qualquer envio; adapters `EmailProvider`/`WhatsAppProvider` (interface + mock, nenhuma mensagem real sai) | — (usa `contatos`/`consentimentos` do núcleo, já existentes) |
| `segmentos` | Segmentos dinâmicos salvos (status, temperatura, tags, origem, vencimento, cidade, idade, responsável, sem contato há X dias, campos personalizados) | — (usa `contatos` do núcleo) |
| `captura-leads` | Formulários configuráveis, página de captura pública (`/p/{empresa}/{pagina}`), webhook de entrada genérico autenticado por token; captura de UTM/origem, distribuição (rodízio/fixo) e alerta ao responsável | — (usa `contatos`/notificações do núcleo) |
| `campanhas` | Campanhas por e-mail e WhatsApp: prévia, agendamento, envio via `fila-envios`, métricas (enviados/entregues/lidos/respondidos/opt-outs/negócios gerados) | `fila-envios`, `segmentos` |
| `relatorios-origem` | Relatório de leads por origem/campanha e desempenho de campanhas (PRD §6.12, recorte "por origem") | `captura-leads`, `campanhas` |

**Ordem de build:** `fila-envios` + `segmentos` + `captura-leads` (sem dependência entre si, podem ser paralelos) → `campanhas` → `relatorios-origem`

**Fora do mapa** (confirmado fora de escopo pela ADR 0004): conexão real com a Meta (WhatsApp/Lead Ads), inbox/recebimento de mensagem, tabelas `conversas`/`whatsapp_contas` reais.

**Nota:** `fila-envios` não tem consumidor próprio nesta fase (só `campanhas` a usa agora), mas o PRD já prevê que automações/réguas (Fase 2, PRD §6.8) vão reusá-la depois — por isso é módulo à parte em vez de código embutido dentro de `campanhas`.

## Specs dos módulos

- `SPEC-fila-envios.md` — **implementado** (2026-09-16); ver também `docs/decisoes/0005-fila-envios-worker-em-postgres.md` e a seção "Correções aplicadas na implementação" no próprio spec
- `SPEC-segmentos.md` — **implementado** (2026-09-18); ver a seção "Correções aplicadas na implementação" no próprio spec
- `SPEC-captura-leads.md` — **implementado** (2026-09-23); ver a seção "Correções aplicadas na implementação" no próprio spec
- `SPEC-campanhas.md` — **implementado** (2026-09-23); ver a seção "Correções aplicadas na implementação" no próprio spec
- `SPEC-relatorios-origem.md` — **implementado** (2026-09-24); ver a seção "Correções aplicadas na implementação" no próprio spec

**Capability map completo — Fase 3 recortada fechada.** Os 5 módulos (`fila-envios`, `segmentos`, `captura-leads`, `campanhas`, `relatorios-origem`) estão implementados. Verificação de banco (`db:reset`/`db:types`/`test:db`) e teste no navegador de `relatorios-origem` ficaram pendentes por falta de Docker Desktop na sessão que implementou — ver `docs/PROGRESSO.md`.
