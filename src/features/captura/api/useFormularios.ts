import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { DistribuicaoTipo } from "@/features/captura/schemas";

export interface Formulario {
  id: string;
  nome: string;
  campos: string[];
  distribuicaoTipo: DistribuicaoTipo;
  responsavelFixoId: string | null;
  ativo: boolean;
}

const COLUNAS_FORMULARIO = "id, nome, campos, distribuicao_tipo, responsavel_fixo_id, ativo";

interface LinhaFormulario {
  id: string;
  nome: string;
  campos: unknown;
  distribuicao_tipo: DistribuicaoTipo;
  responsavel_fixo_id: string | null;
  ativo: boolean;
}

function paraFormulario(linha: LinhaFormulario): Formulario {
  return {
    id: linha.id,
    nome: linha.nome,
    campos: (linha.campos ?? []) as string[],
    distribuicaoTipo: linha.distribuicao_tipo,
    responsavelFixoId: linha.responsavel_fixo_id,
    ativo: linha.ativo,
  };
}

/** Formulários de captura da empresa — qualquer membro lê, só gestor+ escreve (PRD §6.10). */
export function useFormularios(empresaId: string | null) {
  return useQuery({
    queryKey: ["formularios", empresaId],
    enabled: !!empresaId,
    queryFn: async (): Promise<Formulario[]> => {
      const { data, error } = await supabase
        .from("formularios")
        .select(COLUNAS_FORMULARIO)
        .eq("empresa_id", empresaId as string)
        .is("deleted_at", null)
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data ?? []).map(paraFormulario as (l: unknown) => Formulario);
    },
  });
}

export function useFormulario(formularioId: string | null) {
  return useQuery({
    queryKey: ["formulario", formularioId],
    enabled: !!formularioId,
    queryFn: async (): Promise<Formulario> => {
      const { data, error } = await supabase
        .from("formularios")
        .select(COLUNAS_FORMULARIO)
        .eq("id", formularioId as string)
        .single();
      if (error) throw error;
      return paraFormulario(data as unknown as LinhaFormulario);
    },
  });
}

export interface FormularioInput {
  nome: string;
  distribuicaoTipo: DistribuicaoTipo;
  responsavelFixoId: string | null;
}

function paraLinha(dados: FormularioInput) {
  return {
    nome: dados.nome,
    distribuicao_tipo: dados.distribuicaoTipo,
    responsavel_fixo_id: dados.distribuicaoTipo === "fixo" ? dados.responsavelFixoId : null,
  };
}

export function useCriarFormulario(empresaId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dados: FormularioInput) => {
      if (!empresaId) throw new Error("Selecione uma empresa antes de criar um formulário.");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("formularios")
        .insert({ empresa_id: empresaId, ...paraLinha(dados), created_by: user?.id })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["formularios", empresaId] }),
  });
}

export function useAtualizarFormulario(empresaId: string | null, formularioId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dados: FormularioInput) => {
      const { error } = await supabase
        .from("formularios")
        .update(paraLinha(dados))
        .eq("id", formularioId);
      if (error) throw error;
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["formularios", empresaId] }),
        queryClient.invalidateQueries({ queryKey: ["formulario", formularioId] }),
      ]),
  });
}

/** Exclusão via UPDATE direto — configuração compartilhada, mesmo padrão de segmentos/campanhas. */
export function useExcluirFormulario(empresaId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (formularioId: string) => {
      const { error } = await supabase
        .from("formularios")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", formularioId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["formularios", empresaId] }),
  });
}
