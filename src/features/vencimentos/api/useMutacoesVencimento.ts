import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Json } from "@/types/database";
import type { VencimentoInput } from "@/features/vencimentos/schemas";

function paraValor(valor: string | undefined): number | null {
  if (!valor) return null;
  const numero = Number(valor.replace(",", "."));
  return Number.isNaN(numero) ? null : numero;
}

function paraLinha(empresaId: string, dados: VencimentoInput) {
  return {
    empresa_id: empresaId,
    contato_id: dados.contatoId,
    vencimento_tipo_id: dados.vencimentoTipoId || null,
    descricao: dados.descricao || null,
    data_vencimento: dados.dataVencimento,
    valor: paraValor(dados.valor),
    recorrencia: dados.recorrencia,
    responsavel_id: dados.responsavelId || null,
    campos: (dados.campos ?? {}) as Json,
  };
}

export function useCriarVencimento(empresaId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dados: VencimentoInput) => {
      if (!empresaId) throw new Error("Selecione uma empresa antes de cadastrar um vencimento.");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("vencimentos")
        .insert({ ...paraLinha(empresaId, dados), created_by: user?.id })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vencimentos", empresaId] }),
  });
}

export function useAtualizarVencimento(empresaId: string | null, vencimentoId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dados: VencimentoInput) => {
      if (!empresaId) throw new Error("Selecione uma empresa antes de editar um vencimento.");
      const { error } = await supabase
        .from("vencimentos")
        .update(paraLinha(empresaId, dados))
        .eq("id", vencimentoId);
      if (error) throw error;
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["vencimentos", empresaId] }),
        queryClient.invalidateQueries({ queryKey: ["vencimento", vencimentoId] }),
      ]),
  });
}

export function useExcluirVencimento(empresaId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vencimentoId: string) => {
      const { error } = await supabase
        .from("vencimentos")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", vencimentoId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vencimentos", empresaId] }),
  });
}

/** Muda só o status (ex.: "não renovado", "cancelado") — sem side effects. */
export function useAtualizarStatusVencimento(empresaId: string | null, vencimentoId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase
        .from("vencimentos")
        .update({ status })
        .eq("id", vencimentoId);
      if (error) throw error;
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["vencimentos", empresaId] }),
        queryClient.invalidateQueries({ queryKey: ["vencimento", vencimentoId] }),
      ]),
  });
}

export interface RenovarVencimentoInput {
  vencimentoId: string;
  novaData: string;
  novoValor?: number;
}

/** PRD §6.4 — fecha o vencimento atual e cria o próximo, na mesma transação (RPC). */
export function useRenovarVencimento(empresaId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: RenovarVencimentoInput) => {
      const { data, error } = await supabase.rpc("renovar_vencimento", {
        p_vencimento_id: input.vencimentoId,
        p_nova_data: input.novaData,
        p_novo_valor: input.novoValor,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_dados, variaveis) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["vencimentos", empresaId] }),
        queryClient.invalidateQueries({ queryKey: ["vencimento", variaveis.vencimentoId] }),
      ]),
  });
}
