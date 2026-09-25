import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export type RecorrenciaVencimento = "unica" | "mensal" | "anual" | "personalizada";

export interface VencimentoTipoConfig {
  id: string;
  nome: string;
  recorrenciaPadrao: RecorrenciaVencimento;
}

function traduzirErroExclusao(error: { message: string }): Error {
  if (error.message.includes("ainda em uso")) return new Error(error.message);
  return new Error("Não foi possível excluir.");
}

export function useVencimentoTiposConfig(empresaId: string | null) {
  return useQuery({
    queryKey: ["vencimento-tipos-config", empresaId],
    enabled: !!empresaId,
    queryFn: async (): Promise<VencimentoTipoConfig[]> => {
      const { data, error } = await supabase
        .from("vencimento_tipos")
        .select("id, nome, recorrencia_padrao")
        .eq("empresa_id", empresaId as string)
        .is("deleted_at", null)
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((t) => ({
        id: t.id,
        nome: t.nome,
        recorrenciaPadrao: t.recorrencia_padrao as RecorrenciaVencimento,
      }));
    },
  });
}

export interface VencimentoTipoInput {
  nome: string;
  recorrenciaPadrao: RecorrenciaVencimento;
}

function invalidar(queryClient: ReturnType<typeof useQueryClient>, empresaId: string | null) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["vencimento-tipos-config", empresaId] }),
    queryClient.invalidateQueries({ queryKey: ["vencimento-tipos", empresaId] }),
  ]);
}

export function useCriarVencimentoTipo(empresaId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dados: VencimentoTipoInput) => {
      if (!empresaId)
        throw new Error("Selecione uma empresa antes de criar um tipo de vencimento.");
      const { error } = await supabase.from("vencimento_tipos").insert({
        empresa_id: empresaId,
        nome: dados.nome,
        recorrencia_padrao: dados.recorrenciaPadrao,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidar(queryClient, empresaId),
  });
}

export function useAtualizarVencimentoTipo(empresaId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dados }: { id: string; dados: VencimentoTipoInput }) => {
      const { error } = await supabase
        .from("vencimento_tipos")
        .update({ nome: dados.nome, recorrencia_padrao: dados.recorrenciaPadrao })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidar(queryClient, empresaId),
  });
}

export function useExcluirVencimentoTipo(empresaId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("vencimento_tipos")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw traduzirErroExclusao(error);
    },
    onSuccess: () => invalidar(queryClient, empresaId),
  });
}
