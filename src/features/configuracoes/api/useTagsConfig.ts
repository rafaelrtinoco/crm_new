import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface TagConfig {
  id: string;
  nome: string;
  cor: string | null;
}

function traduzirErroExclusao(error: { message: string }): Error {
  if (error.message.includes("ainda em uso")) return new Error(error.message);
  return new Error("Não foi possível excluir.");
}

export function useTagsConfig(empresaId: string | null) {
  return useQuery({
    queryKey: ["tags-config", empresaId],
    enabled: !!empresaId,
    queryFn: async (): Promise<TagConfig[]> => {
      const { data, error } = await supabase
        .from("tags")
        .select("id, nome, cor")
        .eq("empresa_id", empresaId as string)
        .is("deleted_at", null)
        .order("nome", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export interface TagInput {
  nome: string;
  cor: string | null;
}

function invalidar(queryClient: ReturnType<typeof useQueryClient>, empresaId: string | null) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["tags-config", empresaId] }),
    queryClient.invalidateQueries({ queryKey: ["tags", empresaId] }),
  ]);
}

export function useCriarTagConfig(empresaId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dados: TagInput) => {
      if (!empresaId) throw new Error("Selecione uma empresa antes de criar uma tag.");
      const { error } = await supabase.from("tags").insert({ empresa_id: empresaId, ...dados });
      if (error) throw error;
    },
    onSuccess: () => invalidar(queryClient, empresaId),
  });
}

export function useAtualizarTag(empresaId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dados }: { id: string; dados: TagInput }) => {
      const { error } = await supabase.from("tags").update(dados).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidar(queryClient, empresaId),
  });
}

export function useExcluirTag(empresaId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("tags")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw traduzirErroExclusao(error);
    },
    onSuccess: () => invalidar(queryClient, empresaId),
  });
}
