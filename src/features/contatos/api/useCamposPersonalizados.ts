import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface CampoPersonalizado {
  id: string;
  chave: string;
  rotulo: string;
  tipo: "texto" | "numero" | "data" | "selecao" | "booleano";
  opcoes: string[] | null;
  obrigatorio: boolean;
}

/** Campos personalizados configurados pela empresa pra contato ou vencimento (PRD §3.2). */
export function useCamposPersonalizados(
  empresaId: string | null,
  entidade: "contato" | "vencimento",
) {
  return useQuery({
    queryKey: ["campos-personalizados", empresaId, entidade],
    enabled: !!empresaId,
    queryFn: async (): Promise<CampoPersonalizado[]> => {
      const { data, error } = await supabase
        .from("campos_personalizados")
        .select("id, chave, rotulo, tipo, opcoes, obrigatorio")
        .eq("empresa_id", empresaId as string)
        .eq("entidade", entidade)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((c) => ({
        id: c.id,
        chave: c.chave,
        rotulo: c.rotulo,
        tipo: c.tipo as CampoPersonalizado["tipo"],
        opcoes: Array.isArray(c.opcoes) ? (c.opcoes as string[]) : null,
        obrigatorio: c.obrigatorio,
      }));
    },
  });
}
