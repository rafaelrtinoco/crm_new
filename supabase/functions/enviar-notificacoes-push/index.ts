// Envia push (Web Push, PRD §6.14) pra notificações pendentes em
// `notificacoes` (enviada_push_em is null). Chamada por pg_cron via
// pg_net a cada poucos minutos — ver docs/PROGRESSO.md pra status do
// agendamento (a URL interna do stack varia por ambiente, por isso o
// agendamento automático em si não faz parte desta migration).
import webpush from "npm:web-push@3";
import { criarClienteAdmin } from "../_shared/supabaseAdmin.ts";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:suporte@facility.app";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

const LOTE = 50;

interface ErroEnvioPush {
  statusCode?: number;
}

Deno.serve(async (req) => {
  // Só quem tem a service_role key chama isso — não é uma rota pra
  // usuário comum disparar, é rotina de sistema (mesmo raciocínio de
  // gerar_notificacoes_diarias() não ser concedida a `authenticated`).
  const autorizacao = req.headers.get("Authorization");
  if (!SERVICE_ROLE_KEY || autorizacao !== `Bearer ${SERVICE_ROLE_KEY}`) {
    return new Response(JSON.stringify({ erro: "Não autorizado" }), { status: 401 });
  }

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return new Response(JSON.stringify({ erro: "VAPID não configurado" }), { status: 500 });
  }

  const admin = criarClienteAdmin();

  const { data: pendentes, error } = await admin
    .from("notificacoes")
    .select("id, destinatario_id, titulo, corpo, url")
    .is("enviada_push_em", null)
    .order("created_at", { ascending: true })
    .limit(LOTE);

  if (error) {
    return new Response(JSON.stringify({ erro: error.message }), { status: 500 });
  }

  let enviadas = 0;
  let falhas = 0;

  for (const notificacao of pendentes ?? []) {
    const { data: inscricoes } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("usuario_id", notificacao.destinatario_id);

    let algumSucesso = false;

    for (const inscricao of inscricoes ?? []) {
      try {
        await webpush.sendNotification(
          {
            endpoint: inscricao.endpoint,
            keys: { p256dh: inscricao.p256dh, auth: inscricao.auth },
          },
          JSON.stringify({
            titulo: notificacao.titulo,
            corpo: notificacao.corpo,
            url: notificacao.url ?? "/",
          }),
        );
        algumSucesso = true;
      } catch (erroEnvio) {
        // Inscrição expirada/inválida (410/404) — remove pra não tentar
        // de novo indefinidamente.
        const status = (erroEnvio as ErroEnvioPush).statusCode;
        if (status === 404 || status === 410) {
          await admin.from("push_subscriptions").delete().eq("id", inscricao.id);
        } else {
          falhas++;
        }
      }
    }

    // Marca como enviada mesmo sem inscrição ativa — evita reprocessar
    // pra sempre um usuário que nunca ativou push; a notificação
    // continua visível na central do app de qualquer forma.
    await admin
      .from("notificacoes")
      .update({ enviada_push_em: new Date().toISOString() })
      .eq("id", notificacao.id);

    if (algumSucesso) enviadas++;
  }

  return new Response(JSON.stringify({ processadas: pendentes?.length ?? 0, enviadas, falhas }), {
    headers: { "Content-Type": "application/json" },
  });
});
