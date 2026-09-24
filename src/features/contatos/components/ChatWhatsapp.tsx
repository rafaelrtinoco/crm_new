import { useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  useMensagensWhatsapp,
  useSimularRespostaWhatsapp,
} from "@/features/contatos/api/useMensagensWhatsapp";

function formatarHora(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

interface ChatWhatsappProps {
  empresaId: string;
  contatoId: string;
  responsavelId: string;
}

/**
 * Simulação de chat WhatsApp (docs/whatsapp-mock/SPEC-chat-whatsapp-mock.md)
 * — sem conexão real com a API da Meta (ADR 0004 continua valendo). Bolhas
 * de saída vêm só de campanha disparada (trigger em `fila_envios`, nunca
 * um botão de envio avulso aqui); a resposta é sempre simulada pelo
 * usuário, por isso o selo "Simulado" — nunca pode parecer uma resposta
 * real de WhatsApp.
 */
export function ChatWhatsapp({ empresaId, contatoId, responsavelId }: ChatWhatsappProps) {
  const { data: mensagens, isLoading } = useMensagensWhatsapp(contatoId);
  const simularResposta = useSimularRespostaWhatsapp();
  const [texto, setTexto] = useState("");

  function enviar() {
    const textoLimpo = texto.trim();
    if (!textoLimpo) return;
    simularResposta.mutate(
      { empresaId, contatoId, texto: textoLimpo, responsavelId },
      { onSuccess: () => setTexto("") },
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

      {!isLoading && mensagens && mensagens.length === 0 && (
        <EmptyState
          icone={MessageCircle}
          titulo="Nenhuma mensagem ainda"
          descricao="Dispare uma campanha de WhatsApp pra este contato pra começar — as mensagens enviadas (mock) aparecem aqui."
        />
      )}

      {!isLoading && mensagens && mensagens.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3">
          {mensagens.map((mensagem) => (
            <div
              key={mensagem.id}
              className={cn(
                "flex flex-col gap-1 rounded-lg px-3 py-2 text-sm shadow-card",
                mensagem.direcao === "saida"
                  ? "ml-auto max-w-[80%] bg-primary text-primary-foreground"
                  : "mr-auto max-w-[80%] bg-card text-card-foreground",
              )}
            >
              <p className="whitespace-pre-wrap">{mensagem.texto}</p>
              <div className="flex items-center justify-end gap-1.5">
                {mensagem.simulado && (
                  <Badge variant="outline" className="text-[10px]">
                    Simulado
                  </Badge>
                )}
                <span
                  className={cn(
                    "text-[11px]",
                    mensagem.direcao === "saida"
                      ? "text-primary-foreground/70"
                      : "text-muted-foreground",
                  )}
                >
                  {formatarHora(mensagem.criadaEm)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <Textarea
          value={texto}
          onChange={(evento) => setTexto(evento.target.value)}
          placeholder="Digite como se fosse o contato respondendo…"
          rows={2}
          className="flex-1"
        />
        <Button
          type="button"
          onClick={enviar}
          disabled={!texto.trim() || simularResposta.isPending}
        >
          <Send className="mr-2 h-4 w-4" />
          Simular resposta
        </Button>
      </div>
    </div>
  );
}
