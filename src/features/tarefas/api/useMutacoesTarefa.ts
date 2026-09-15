import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { TarefaInput } from "@/features/tarefas/schemas";

function paraLinha(empresaId: string, dados: TarefaInput) {
  return {
    empresa_id: empresaId,
    tipo: dados.tipo,
    titulo: dados.titulo,
    data_vencimento: dados.dataVencimento,
    responsavel_id: dados.responsavelId || null,
    contato_id: dados.contatoId || null,
    negocio_id: dados.negocioId || null,
  };
}

function invalidarTudo(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["tarefas"] }),
    queryClient.invalidateQueries({ queryKey: ["tarefa"] }),
  ]);
}

export function useCriarTarefa(empresaId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dados: TarefaInput) => {
      if (!empresaId) throw new Error("Selecione uma empresa antes de cadastrar uma tarefa.");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("tarefas")
        .insert({ ...paraLinha(empresaId, dados), created_by: user?.id })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidarTudo(queryClient),
  });
}

export function useAtualizarTarefa(empresaId: string | null, tarefaId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dados: TarefaInput) => {
      if (!empresaId) throw new Error("Selecione uma empresa antes de editar uma tarefa.");
      const { error } = await supabase
        .from("tarefas")
        .update(paraLinha(empresaId, dados))
        .eq("id", tarefaId);
      if (error) throw error;
    },
    onSuccess: () => invalidarTudo(queryClient),
  });
}

/** Exclusão via RPC — ver o comentário equivalente em useMutacoesContato.ts. */
export function useExcluirTarefa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tarefaId: string) => {
      const { error } = await supabase.rpc("excluir_registro", {
        p_tabela: "tarefas",
        p_id: tarefaId,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidarTudo(queryClient),
  });
}

/** Alterna concluída/pendente — escrita de uma coluna só, sem precisar de RPC. */
export function useAlternarConclusaoTarefa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { tarefaId: string; concluir: boolean }) => {
      const { error } = await supabase
        .from("tarefas")
        .update({ concluida_em: input.concluir ? new Date().toISOString() : null })
        .eq("id", input.tarefaId);
      if (error) throw error;
    },
    onSuccess: () => invalidarTudo(queryClient),
  });
}
