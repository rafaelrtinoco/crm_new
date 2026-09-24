import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface MensagemWhatsapp {
  id: string;
  texto: string;
  direcao: "saida" | "entrada";
  simulado: boolean;
  criadaEm: string;
}

interface ConteudoMensagem {
  texto?: string;
  direcao?: string;
  canal?: string;
  simulado?: boolean;
  campanha_id?: string;
}

/** Mensagens de WhatsApp mockadas do contato (docs/whatsapp-mock/SPEC-chat-whatsapp-mock.md) — reaproveita `atividades` (tipo='mensagem'), ordem cronológica ascendente (chat lê de cima pra baixo). */
export function useMensagensWhatsapp(contatoId: string | null) {
  return useQuery({
    queryKey: ["mensagens-whatsapp", contatoId],
    enabled: !!contatoId,
    queryFn: async (): Promise<MensagemWhatsapp[]> => {
      const { data, error } = await supabase
        .from("atividades")
        .select("id, conteudo, created_at")
        .eq("contato_id", contatoId as string)
        .eq("tipo", "mensagem")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((linha) => {
        const conteudo = (linha.conteudo ?? {}) as ConteudoMensagem;
        return {
          id: linha.id,
          texto: conteudo.texto ?? "",
          direcao: conteudo.direcao === "entrada" ? "entrada" : "saida",
          simulado: conteudo.simulado === true,
          criadaEm: linha.created_at,
        };
      });
    },
  });
}

export interface SimularRespostaInput {
  empresaId: string;
  contatoId: string;
  texto: string;
  responsavelId: string;
}

/** Registra uma resposta "recebida" simulada pelo usuário — insert direto do cliente, mesmo caminho já usado por nota/ligação (useRegistrarAtividade); a mensagem "saída" nunca é inserida por aqui, só pelo trigger de `fila_envios`. */
export function useSimularRespostaWhatsapp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SimularRespostaInput) => {
      const { error } = await supabase.from("atividades").insert({
        empresa_id: input.empresaId,
        contato_id: input.contatoId,
        tipo: "mensagem",
        responsavel_id: input.responsavelId,
        created_by: input.responsavelId,
        conteudo: {
          texto: input.texto,
          direcao: "entrada",
          canal: "whatsapp",
          simulado: true,
        },
      });
      if (error) throw error;
    },
    onSuccess: (_dados, variaveis) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["mensagens-whatsapp", variaveis.contatoId] }),
        queryClient.invalidateQueries({ queryKey: ["atividades", variaveis.contatoId] }),
      ]),
  });
}
