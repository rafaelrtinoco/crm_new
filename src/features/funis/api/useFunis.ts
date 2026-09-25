import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface Funil {
  id: string;
  nome: string;
  tipo: string;
  ordem: number;
}

/** Funis ativos da empresa (vêm prontos do template do nicho — PRD §6.5). */
export function useFunis(empresaId: string | null) {
  return useQuery({
    queryKey: ["funis", empresaId],
    enabled: !!empresaId,
    queryFn: async (): Promise<Funil[]> => {
      const { data, error } = await supabase
        .from("funis")
        .select("id, nome, tipo, ordem")
        .eq("empresa_id", empresaId as string)
        .eq("ativo", true)
        .is("deleted_at", null)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export interface Etapa {
  id: string;
  nome: string;
  ordem: number;
}

/** Etapas do funil, na ordem do quadro. */
export function useEtapas(funilId: string | null) {
  return useQuery({
    queryKey: ["etapas", funilId],
    enabled: !!funilId,
    queryFn: async (): Promise<Etapa[]> => {
      const { data, error } = await supabase
        .from("etapas")
        .select("id, nome, ordem")
        .eq("funil_id", funilId as string)
        .is("deleted_at", null)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export interface MotivoPerda {
  id: string;
  nome: string;
}

/** Motivos de perda da empresa (PRD §6.5 — obrigatório ao marcar como perdido). */
export function useMotivosPerda(empresaId: string | null) {
  return useQuery({
    queryKey: ["motivos-perda", empresaId],
    enabled: !!empresaId,
    queryFn: async (): Promise<MotivoPerda[]> => {
      const { data, error } = await supabase
        .from("motivos_perda")
        .select("id, nome")
        .eq("empresa_id", empresaId as string)
        .eq("ativo", true)
        .is("deleted_at", null)
        .order("nome", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}
