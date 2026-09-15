import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { NegocioInput, PerdaInput, ProximoPassoInput } from "@/features/funis/schemas";

function paraValor(valor: string | undefined): number | null {
  if (!valor) return null;
  const numero = Number(valor.replace(",", "."));
  return Number.isNaN(numero) ? null : numero;
}

function paraLinha(empresaId: string, dados: NegocioInput) {
  return {
    empresa_id: empresaId,
    contato_id: dados.contatoId,
    funil_id: dados.funilId,
    etapa_id: dados.etapaId,
    valor_estimado: paraValor(dados.valorEstimado),
    responsavel_id: dados.responsavelId || null,
    previsao_fechamento: dados.previsaoFechamento || null,
    proximo_passo_em: dados.proximoPassoEm,
    proximo_passo_acao: dados.proximoPassoAcao,
  };
}

export function useCriarNegocio(empresaId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dados: NegocioInput) => {
      if (!empresaId) throw new Error("Selecione uma empresa antes de cadastrar um negócio.");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("negocios")
        .insert({ ...paraLinha(empresaId, dados), created_by: user?.id })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["negocios", empresaId] }),
  });
}

export function useAtualizarNegocio(empresaId: string | null, negocioId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dados: NegocioInput) => {
      if (!empresaId) throw new Error("Selecione uma empresa antes de editar um negócio.");
      const { error } = await supabase
        .from("negocios")
        .update(paraLinha(empresaId, dados))
        .eq("id", negocioId);
      if (error) throw error;
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["negocios", empresaId] }),
        queryClient.invalidateQueries({ queryKey: ["negocio", negocioId] }),
      ]),
  });
}

/** Exclusão via RPC — ver o comentário equivalente em useMutacoesContato.ts. */
export function useExcluirNegocio(empresaId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (negocioId: string) => {
      const { error } = await supabase.rpc("excluir_registro", {
        p_tabela: "negocios",
        p_id: negocioId,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["negocios", empresaId] }),
  });
}

export interface MoverNegocioInput extends ProximoPassoInput {
  negocioId: string;
  contatoId: string;
  etapaId: string;
}

/**
 * PRD §6.5: mover um card exige confirmar/definir o próximo passo — as
 * duas colunas são `not null` no banco, então a UX não pode contornar
 * isso enviando só a mudança de etapa. Uma chamada só: o RPC
 * `mover_negocio_etapa` faz o update do negócio, e o registro na
 * timeline (e a sincronização de status se a etapa de destino for
 * `tipo = 'ganho'`/`'perdido'`) acontecem sozinhos no banco.
 */
export function useMoverNegocio(empresaId: string | null, funilId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: MoverNegocioInput) => {
      if (!empresaId) throw new Error("Selecione uma empresa antes de mover um negócio.");
      const { error } = await supabase.rpc("mover_negocio_etapa", {
        p_negocio_id: input.negocioId,
        p_etapa_id: input.etapaId,
        p_proximo_passo_em: input.proximoPassoEm,
        p_proximo_passo_acao: input.proximoPassoAcao,
      });
      if (error) throw error;
    },
    onSuccess: (_dados, variaveis) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["negocios", empresaId, funilId] }),
        queryClient.invalidateQueries({ queryKey: ["negocio", variaveis.negocioId] }),
        queryClient.invalidateQueries({ queryKey: ["atividades", variaveis.contatoId] }),
        queryClient.invalidateQueries({ queryKey: ["contatos"] }),
      ]),
  });
}

/** PRD §6.5: "Ganho: marca o contato como cliente." Via RPC — duas escritas atômicas. */
export function useMarcarGanho(empresaId: string | null, funilId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (negocioId: string) => {
      const { error } = await supabase.rpc("marcar_negocio_ganho", { p_negocio_id: negocioId });
      if (error) throw error;
    },
    onSuccess: (_dados, negocioId) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["negocios", empresaId, funilId] }),
        queryClient.invalidateQueries({ queryKey: ["negocio", negocioId] }),
        queryClient.invalidateQueries({ queryKey: ["contatos"] }),
      ]),
  });
}

export interface MarcarPerdidoInput extends PerdaInput {
  negocioId: string;
}

/** PRD §6.5: motivo obrigatório + "reativar em" cria tarefa futura. Via RPC. */
export function useMarcarPerdido(empresaId: string | null, funilId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: MarcarPerdidoInput) => {
      const { error } = await supabase.rpc("marcar_negocio_perdido", {
        p_negocio_id: input.negocioId,
        p_motivo_perda_id: input.motivoPerdaId,
        p_reativar_em: input.reativarEm || undefined,
      });
      if (error) throw error;
    },
    onSuccess: (_dados, variaveis) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["negocios", empresaId, funilId] }),
        queryClient.invalidateQueries({ queryKey: ["negocio", variaveis.negocioId] }),
      ]),
  });
}
