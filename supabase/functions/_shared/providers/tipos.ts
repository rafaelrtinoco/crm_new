// Contrato de EmailProvider/WhatsAppProvider — Fase 3 recortada
// (docs/fase3/SPEC-fila-envios.md, ADR 0004/0005).
//
// Intencionalmente não importado/usado por nenhum código ainda: o
// worker da fila de envios (supabase/migrations/20260916192944_fila_envios.sql,
// função mock_enviar_mensagem) roda inteiro em Postgres nesta fase,
// sem Edge Function, porque o provider é mock e não sai da rede do
// banco (ADR 0005). Este arquivo só fixa o contrato que a Fase 2 vai
// implementar de verdade (Cloud API da Meta / e-mail transacional) —
// quando isso acontecer, o envio de verdade volta a precisar de uma
// Edge Function chamando estas interfaces via pg_net.

export interface ResultadoEnvio {
  sucesso: boolean;
  /** ID da mensagem no provider externo, para correlacionar com o webhook de status. */
  idExterno?: string;
  erro?: string;
}

export interface EmailProvider {
  enviar(input: {
    destinatario: string;
    assunto: string;
    conteudo: string;
  }): Promise<ResultadoEnvio>;
}

export interface WhatsAppProvider {
  enviar(input: {
    destinatario: string;
    conteudo: string;
    templateId?: string;
  }): Promise<ResultadoEnvio>;
}
