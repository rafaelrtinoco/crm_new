import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface Tag {
  id: string;
  nome: string;
  cor: string | null;
}

/** Tags da empresa (qualquer membro pode criar — ver docs/decisoes/0001). */
export function useTags(empresaId: string | null) {
  return useQuery({
    queryKey: ["tags", empresaId],
    enabled: !!empresaId,
    queryFn: async (): Promise<Tag[]> => {
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

export function useCriarTag(empresaId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (nome: string) => {
      if (!empresaId) throw new Error("Selecione uma empresa antes de criar uma tag.");
      const { data, error } = await supabase
        .from("tags")
        .insert({ empresa_id: empresaId, nome })
        .select("id, nome, cor")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tags", empresaId] }),
  });
}

/** Tags vinculadas a um contato específico. */
export function useTagsDoContato(contatoId: string | null) {
  return useQuery({
    queryKey: ["contato-tags", contatoId],
    enabled: !!contatoId,
    queryFn: async (): Promise<Tag[]> => {
      const { data, error } = await supabase
        .from("contato_tags")
        .select("tags(id, nome, cor)")
        .eq("contato_id", contatoId as string);
      if (error) throw error;
      return (data ?? []).flatMap((linha) => (linha.tags ? [linha.tags] : []));
    },
  });
}

/**
 * Substitui todo o conjunto de tags de um contato pelo informado.
 * Função simples (não-hook) pra poder ser chamada tanto pela mutation
 * abaixo quanto logo após criar um contato novo, no mesmo submit.
 */
export async function definirTagsDoContato(empresaId: string, contatoId: string, tagIds: string[]) {
  const { error: erroExclusao } = await supabase
    .from("contato_tags")
    .delete()
    .eq("contato_id", contatoId);
  if (erroExclusao) throw erroExclusao;

  if (tagIds.length === 0) return;

  const { error: erroInsercao } = await supabase
    .from("contato_tags")
    .insert(
      tagIds.map((tagId) => ({ empresa_id: empresaId, contato_id: contatoId, tag_id: tagId })),
    );
  if (erroInsercao) throw erroInsercao;
}

export function useDefinirTagsDoContato(empresaId: string | null, contatoId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tagIds: string[]) => {
      if (!empresaId || !contatoId) throw new Error("Contato inválido.");
      await definirTagsDoContato(empresaId, contatoId, tagIds);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["contato-tags", contatoId] }),
  });
}
