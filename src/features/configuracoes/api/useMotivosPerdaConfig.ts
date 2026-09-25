import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface MotivoPerdaConfig {
  id: string;
  nome: string;
}

function traduzirErroExclusao(error: { message: string }): Error {
  if (error.message.includes("ainda em uso")) return new Error(error.message);
  return new Error("Não foi possível excluir.");
}

export function useMotivosPerdaConfig(empresaId: string | null) {
  return useQuery({
    queryKey: ["motivos-perda-config", empresaId],
    enabled: !!empresaId,
    queryFn: async (): Promise<MotivoPerdaConfig[]> => {
      const { data, error } = await supabase
        .from("motivos_perda")
        .select("id, nome")
        .eq("empresa_id", empresaId as string)
        .is("deleted_at", null)
        .order("nome", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

function invalidar(queryClient: ReturnType<typeof useQueryClient>, empresaId: string | null) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["motivos-perda-config", empresaId] }),
    queryClient.invalidateQueries({ queryKey: ["motivos-perda", empresaId] }),
  ]);
}

export function useCriarMotivoPerda(empresaId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (nome: string) => {
      if (!empresaId) throw new Error("Selecione uma empresa antes de criar um motivo de perda.");
      const { error } = await supabase
        .from("motivos_perda")
        .insert({ empresa_id: empresaId, nome });
      if (error) throw error;
    },
    onSuccess: () => invalidar(queryClient, empresaId),
  });
}

export function useAtualizarMotivoPerda(empresaId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, nome }: { id: string; nome: string }) => {
      const { error } = await supabase.from("motivos_perda").update({ nome }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidar(queryClient, empresaId),
  });
}

export function useExcluirMotivoPerda(empresaId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("motivos_perda")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw traduzirErroExclusao(error);
    },
    onSuccess: () => invalidar(queryClient, empresaId),
  });
}
