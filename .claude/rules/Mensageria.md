---
paths:
  - "supabase/functions/**"
  - "src/features/{campanhas,captura,segmentos,notificacoes}/**"
---

# Envio de mensagens (WhatsApp e e-mail)

- Todo envio passa pelo RPC `enfileirar_envio` → fila (`fila_envios`) → worker `processar_fila_envios` (plpgsql + pg_cron, ADR 0005, sem Edge Function). Nenhum outro código chama um provider diretamente.
- O worker verifica, nesta ordem, e grava o motivo quando bloqueia ou reagenda (implementado em `supabase/migrations/20260916192944_fila_envios.sql`):
  1. Contato excluído
  2. Endereço de envio presente (e-mail/WhatsApp conforme o canal)
  3. Consentimento do contato para a finalidade (atendimento × marketing)
  4. Opt-out
  5. Horário comercial no fuso da empresa (fora dele, reagenda — não bloqueia)
- **Ainda não implementados** (desenho de fase futura — não assumir que já existem nem checar de novo em código novo): conta ativa/inadimplência, limite de envios do plano, janela de 24h do WhatsApp.
- Mensagem de marketing sempre oferece opt-out. Resposta "SAIR" (e variações) registra o opt-out e cancela envios de marketing pendentes do contato.
- **Idempotência:** cada envio tem chave única (ex.: execução da automação + contato + passo). Uma régua rodando duas vezes não pode mandar a mensagem duas vezes.
- Variáveis resolvidas no momento do envio. Variável sem valor bloqueia o envio — nunca mandar "Olá {{primeiro_nome}}".
- Respostas de botões ("Quero renovar", "Falar com atendente", "Já resolvi") são identificadas pelo payload, não pelo texto exibido.
- Status (enviada, entregue, lida, falhou) só é atualizado pelo webhook do provider.
- Testes e desenvolvimento usam sempre o provider mock; nenhum teste chama API real.