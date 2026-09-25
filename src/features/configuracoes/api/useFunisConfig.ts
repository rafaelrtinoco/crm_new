import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface FunilConfig {
  id: string;
  nome: string;
  tipo: "venda_nova" | "renovacao" | "personalizado";
  ordem: number;
}

function traduzirErroExclusao(error: { message: string }): Error {
  if (error.message.includes("ainda em uso")) return new Error(error.message);
  return new Error("Não foi possível excluir.");
}

/** Funis da empresa, incluindo inativos/excluídos — a tela de Configurações precisa gerenciar todos, `useFunis` (kanban) só lista os ativos. */
export function useFunisConfig(empresaId: string | null) {
  return useQuery({
    queryKey: ["funis-config", empresaId],
    enabled: !!empresaId,
    queryFn: async (): Promise<FunilConfig[]> => {
      const { data, error } = await supabase
        .from("funis")
        .select("id, nome, tipo, ordem")
        .eq("empresa_id", empresaId as string)
        .is("deleted_at", null)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((f) => ({ ...f, tipo: f.tipo as FunilConfig["tipo"] }));
    },
  });
}

export interface FunilInput {
  nome: string;
  tipo: "venda_nova" | "renovacao" | "personalizado";
  ordem: number;
}

function invalidarFunis(queryClient: ReturnType<typeof useQueryClient>, empresaId: string | null) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["funis-config", empresaId] }),
    queryClient.invalidateQueries({ queryKey: ["funis", empresaId] }),
  ]);
}

export function useCriarFunil(empresaId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dados: FunilInput) => {
      if (!empresaId) throw new Error("Selecione uma empresa antes de criar um funil.");
      const { error } = await supabase.from("funis").insert({ empresa_id: empresaId, ...dados });
      if (error) throw error;
    },
    onSuccess: () => invalidarFunis(queryClient, empresaId),
  });
}

export function useAtualizarFunil(empresaId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dados }: { id: string; dados: FunilInput }) => {
      const { error } = await supabase.from("funis").update(dados).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidarFunis(queryClient, empresaId),
  });
}

export function useExcluirFunil(empresaId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("funis")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw traduzirErroExclusao(error);
    },
    onSuccess: () => invalidarFunis(queryClient, empresaId),
  });
}

export interface EtapaConfig {
  id: string;
  nome: string;
  tipo: "normal" | "ganho" | "perdido";
  ordem: number;
}

/** Etapas de um funil, pra gerenciar (não pro kanban — `useEtapas` continua servindo o quadro). */
export function useEtapasConfig(funilId: string | null) {
  return useQuery({
    queryKey: ["etapas-config", funilId],
    enabled: !!funilId,
    queryFn: async (): Promise<EtapaConfig[]> => {
      const { data, error } = await supabase
        .from("etapas")
        .select("id, nome, tipo, ordem")
        .eq("funil_id", funilId as string)
        .is("deleted_at", null)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((e) => ({ ...e, tipo: e.tipo as EtapaConfig["tipo"] }));
    },
  });
}

export interface EtapaInput {
  nome: string;
  tipo: "normal" | "ganho" | "perdido";
  ordem: number;
}

function invalidarEtapas(queryClient: ReturnType<typeof useQueryClient>, funilId: string | null) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["etapas-config", funilId] }),
    queryClient.invalidateQueries({ queryKey: ["etapas", funilId] }),
  ]);
}

export function useCriarEtapa(funilId: string | null, empresaId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dados: EtapaInput) => {
      if (!funilId || !empresaId) throw new Error("Funil inválido.");
      const { error } = await supabase
        .from("etapas")
        .insert({ funil_id: funilId, empresa_id: empresaId, ...dados });
      if (error) throw error;
    },
    onSuccess: () => invalidarEtapas(queryClient, funilId),
  });
}

export function useAtualizarEtapa(funilId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dados }: { id: string; dados: EtapaInput }) => {
      const { error } = await supabase.from("etapas").update(dados).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidarEtapas(queryClient, funilId),
  });
}

export function useExcluirEtapa(funilId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("etapas")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw traduzirErroExclusao(error);
    },
    onSuccess: () => invalidarEtapas(queryClient, funilId),
  });
}
