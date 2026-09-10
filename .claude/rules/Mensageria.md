---
paths:
  - "supabase/functions/**"
  - "src/features/{whatsapp,automacoes,campanhas,cadencias}/**"
---

# Envio de mensagens (WhatsApp e e-mail)

- Todo envio passa por `enfileirarEnvio()` → fila → worker. Nenhum outro código chama um provider diretamente.
- O worker verifica, nesta ordem, e grava o motivo quando bloqueia ou reagenda:
  1. Conta ativa (não inadimplente)
  2. Limite de envios do plano
  3. Consentimento do contato para a finalidade (atendimento × marketing)
  4. Opt-out
  5. Horário comercial no fuso da empresa (fora dele, reagenda)
  6. Janela de 24h do WhatsApp (fora dela, só template aprovado)
- Mensagem de marketing sempre oferece opt-out. Resposta "SAIR" (e variações) registra o opt-out e cancela envios de marketing pendentes do contato.
- **Idempotência:** cada envio tem chave única (ex.: execução da automação + contato + passo). Uma régua rodando duas vezes não pode mandar a mensagem duas vezes.
- Variáveis resolvidas no momento do envio. Variável sem valor bloqueia o envio — nunca mandar "Olá {{primeiro_nome}}".
- Respostas de botões ("Quero renovar", "Falar com atendente", "Já resolvi") são identificadas pelo payload, não pelo texto exibido.
- Status (enviada, entregue, lida, falhou) só é atualizado pelo webhook do provider.
- Testes e desenvolvimento usam sempre o provider mock; nenhum teste chama API real.