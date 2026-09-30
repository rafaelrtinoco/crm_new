import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

function traduzirErro(error: { message: string }): Error {
  if (
    error.message.includes("Só o dono da empresa") ||
    error.message.includes("ao menos um dono")
  ) {
    return new Error(error.message);
  }
  return new Error("Não foi possível salvar.");
}

function invalidar(queryClient: ReturnType<typeof useQueryClient>, empresaId: string | null) {
  return queryClient.invalidateQueries({ queryKey: ["membros-empresa", empresaId] });
}

/**
 * Trocar o papel de um membro — a RLS (`empresa_membros_gestor_escreve`)
 * já autoriza gestor+ a escrever; o trigger `impedir_escalada_privilegio_membro`
 * (banco) é quem realmente impede um gestor de promover/demover/remover
 * um dono, ou de promover alguém a dono sem já ser dono. Sem RPC — mesmo
 * padrão de `useSegmentos.ts`.
 */
export function useAtualizarPapelMembro(empresaId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      usuarioId,
      papel,
    }: {
      usuarioId: string;
      papel: "dono" | "gestor" | "usuario";
    }) => {
      if (!empresaId) throw new Error("Selecione uma empresa antes de salvar.");
      const { error } = await supabase
        .from("empresa_membros")
        .update({ papel })
        .eq("empresa_id", empresaId)
        .eq("usuario_id", usuarioId);
      if (error) throw traduzirErro(error);
    },
    onSuccess: () => invalidar(queryClient, empresaId),
  });
}

/** Remover membro — soft delete puro, sem checagem de uso (diferente da fatia 2, ver SPEC-configuracoes-equipe.md). */
export function useRemoverMembro(empresaId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (usuarioId: string) => {
      if (!empresaId) throw new Error("Selecione uma empresa antes de remover.");
      const { error } = await supabase
        .from("empresa_membros")
        .update({ deleted_at: new Date().toISOString() })
        .eq("empresa_id", empresaId)
        .eq("usuario_id", usuarioId);
      if (error) throw traduzirErro(error);
    },
    onSuccess: () => invalidar(queryClient, empresaId),
  });
}
