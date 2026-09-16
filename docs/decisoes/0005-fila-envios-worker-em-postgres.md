# 0005 — Worker da fila de envios roda em Postgres (`pg_cron`), não em Edge Function, enquanto os providers forem mock

## Status

Aceita — módulo `fila-envios` da Fase 3 recortada.

## Contexto

`CLAUDE.md` tem uma regra de ouro: "Integrações só via providers em `supabase/functions/_shared/providers/`. Em dev e testes, o mock é o padrão." O padrão do projeto até aqui é Edge Function (TypeScript/Deno) chamando um provider real ou mock.

O 1D-5 (notificações push) tentou agendar uma Edge Function via `pg_cron` + `pg_net` e **não conseguiu terminar o wiring com confiança** — a URL interna que o `pg_net` precisa pra alcançar a function é diferente entre o stack local (rede Docker) e um projeto hospedado real (staging/produção, que ainda não existem). Ficou documentado como pendência explícita em `docs/PROGRESSO.md`, não como bug escondido.

A Fase 3 recortada (ADR 0004) constrói `EmailProvider`/`WhatsAppProvider` só como mock — nenhuma chamada HTTP real a SMTP ou à Cloud API da Meta acontece nesta fase. Isso muda o cálculo: se o "provider" não sai da rede do banco, não há razão técnica pra pagar o custo do salto Edge Function + `pg_net` agora, só pra reabrir um problema que já travou uma sessão inteira.

## Decisão

O worker da fila de envios (`processar_fila_envios()`) é uma função `plpgsql` `security definer`, agendada direto por `cron.schedule` — sem Edge Function, sem `pg_net`, enquanto os providers de e-mail/WhatsApp forem mock. O "envio" do mock é outra função em Postgres (`mock_enviar_mensagem(...)`) chamada pela mesma transação do worker, que só grava o resultado (status `enviada`) — não existe requisição de rede nenhuma neste caminho.

Isso é uma exceção pontual e documentada à regra de "providers só em Edge Function", não uma revogação dela: quando a Fase 2 trocar o mock pelo provider real (Meta Cloud API) e o e-mail transacional real, o envio de verdade **precisa** sair do banco e virar uma Edge Function de novo (chamada HTTP real não roda dentro do Postgres). A troca é isolada: o contrato de "o que uma chamada de envio precisa" (destinatário, canal, conteúdo já resolvido, chave de idempotência) fica estável; só o corpo de `mock_enviar_mensagem` muda de "grava direto" para "chama a Edge Function real via `pg_net`" — nesse ponto o problema de URL local-vs-hospedado volta à mesa, mas resolvido uma vez só, quando houver um projeto hospedado de verdade pra testar contra.

## Consequências

- O `worker` e a fila (`fila_envios`) não têm nenhuma dependência de Edge Function nesta fase — testável inteiramente via pgTAP, sem precisar de `supabase functions serve`.
- Quando a Fase 2 (ou a volta ao billing real da Fase 4, se vier antes) trocar o mock por integração real, reavaliar se o salto pra Edge Function precisa do mesmo cron direto ou de uma fila (`pgmq`, já citada em `CLAUDE.md` como parte do stack e ainda não usada em lugar nenhum) para não segurar o cron em uma chamada HTTP lenta.
- `EmailProvider`/`WhatsAppProvider` como *interface TypeScript* documentando o contrato ainda valem a pena escrever agora (mesmo sem uso real em Edge Function nesta fase) — é o que a Fase 2 vai implementar de verdade; ficam em `supabase/functions/_shared/providers/` só como definição de tipo/contrato, não como código executado pelo worker desta fase.
