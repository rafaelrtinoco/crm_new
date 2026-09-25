import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Json } from "@/types/database";

export type EntidadeCampo = "contato" | "vencimento";
export type TipoCampo = "texto" | "numero" | "data" | "selecao" | "booleano";

export interface CampoPersonalizadoConfig {
  id: string;
  chave: string;
  rotulo: string;
  tipo: TipoCampo;
  opcoes: string[] | null;
  obrigatorio: boolean;
  ordem: number;
}

export function useCamposPersonalizadosConfig(empresaId: string | null, entidade: EntidadeCampo) {
  return useQuery({
    queryKey: ["campos-personalizados-config", empresaId, entidade],
    enabled: !!empresaId,
    queryFn: async (): Promise<CampoPersonalizadoConfig[]> => {
      const { data, error } = await supabase
        .from("campos_personalizados")
        .select("id, chave, rotulo, tipo, opcoes, obrigatorio, ordem")
        .eq("empresa_id", empresaId as string)
        .eq("entidade", entidade)
        .is("deleted_at", null)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((c) => ({
        id: c.id,
        chave: c.chave,
        rotulo: c.rotulo,
        tipo: c.tipo as TipoCampo,
        opcoes: Array.isArray(c.opcoes) ? (c.opcoes as string[]) : null,
        obrigatorio: c.obrigatorio,
        ordem: c.ordem,
      }));
    },
  });
}

export interface CampoPersonalizadoInput {
  chave: string;
  rotulo: string;
  tipo: TipoCampo;
  opcoes: string[] | null;
  obrigatorio: boolean;
  ordem: number;
}

function invalidar(
  queryClient: ReturnType<typeof useQueryClient>,
  empresaId: string | null,
  entidade: EntidadeCampo,
) {
  return Promise.all([
    queryClient.invalidateQueries({
      queryKey: ["campos-personalizados-config", empresaId, entidade],
    }),
    queryClient.invalidateQueries({ queryKey: ["campos-personalizados", empresaId, entidade] }),
  ]);
}

export function useCriarCampoPersonalizado(empresaId: string | null, entidade: EntidadeCampo) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dados: CampoPersonalizadoInput) => {
      if (!empresaId) throw new Error("Selecione uma empresa antes de criar um campo.");
      const { error } = await supabase.from("campos_personalizados").insert({
        empresa_id: empresaId,
        entidade,
        chave: dados.chave,
        rotulo: dados.rotulo,
        tipo: dados.tipo,
        opcoes: dados.opcoes as unknown as Json,
        obrigatorio: dados.obrigatorio,
        ordem: dados.ordem,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidar(queryClient, empresaId, entidade),
  });
}

export function useAtualizarCampoPersonalizado(empresaId: string | null, entidade: EntidadeCampo) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dados }: { id: string; dados: CampoPersonalizadoInput }) => {
      const { error } = await supabase
        .from("campos_personalizados")
        .update({
          rotulo: dados.rotulo,
          tipo: dados.tipo,
          opcoes: dados.opcoes as unknown as Json,
          obrigatorio: dados.obrigatorio,
          ordem: dados.ordem,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidar(queryClient, empresaId, entidade),
  });
}

/** Sem checagem de uso no banco (custo x benefício não fecha — ver SPEC-configuracoes-nucleo.md, boundary). */
export function useExcluirCampoPersonalizado(empresaId: string | null, entidade: EntidadeCampo) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("campos_personalizados")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidar(queryClient, empresaId, entidade),
  });
}
