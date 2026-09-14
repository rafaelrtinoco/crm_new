import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface Atividade {
  id: string;
  tipo: string;
  conteudo: Record<string, unknown>;
  responsavelId: string | null;
  criadaEm: string;
}

/** Timeline do contato (PRD §6.3) — mensagens, notas, ligações, mudanças de etapa etc. */
export function useAtividades(contatoId: string | null) {
  return useQuery({
    queryKey: ["atividades", contatoId],
    enabled: !!contatoId,
    queryFn: async (): Promise<Atividade[]> => {
      const { data, error } = await supabase
        .from("atividades")
        .select("id, tipo, conteudo, responsavel_id, created_at")
        .eq("contato_id", contatoId as string)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((a) => ({
        id: a.id,
        tipo: a.tipo,
        conteudo: (a.conteudo ?? {}) as Record<string, unknown>,
        responsavelId: a.responsavel_id,
        criadaEm: a.created_at,
      }));
    },
  });
}

export interface RegistrarAtividadeInput {
  empresaId: string;
  contatoId: string;
  tipo: "nota" | "ligacao";
  resultado: string;
  nota: string;
  proximoPasso?: string;
  responsavelId: string;
}

/** Registro rápido "Como foi?" (PRD §6.3) — grava uma atividade na timeline. */
export function useRegistrarAtividade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: RegistrarAtividadeInput) => {
      const { error } = await supabase.from("atividades").insert({
        empresa_id: input.empresaId,
        contato_id: input.contatoId,
        tipo: input.tipo,
        responsavel_id: input.responsavelId,
        created_by: input.responsavelId,
        conteudo: {
          resultado: input.resultado,
          nota: input.nota,
          proximoPasso: input.proximoPasso || null,
        },
      });
      if (error) throw error;
    },
    onSuccess: (_dados, variaveis) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["atividades", variaveis.contatoId] }),
        queryClient.invalidateQueries({ queryKey: ["contato", variaveis.contatoId] }),
      ]),
  });
}
