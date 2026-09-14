import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface VencimentoTipo {
  id: string;
  nome: string;
  recorrenciaPadrao: string;
}

/** Tipos de vencimento da empresa (aplicados pelo template do nicho no onboarding). */
export function useVencimentoTipos(empresaId: string | null) {
  return useQuery({
    queryKey: ["vencimento-tipos", empresaId],
    enabled: !!empresaId,
    queryFn: async (): Promise<VencimentoTipo[]> => {
      const { data, error } = await supabase
        .from("vencimento_tipos")
        .select("id, nome, recorrencia_padrao")
        .eq("empresa_id", empresaId as string)
        .eq("ativo", true)
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((t) => ({
        id: t.id,
        nome: t.nome,
        recorrenciaPadrao: t.recorrencia_padrao,
      }));
    },
  });
}
