import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { DistribuicaoTipo } from "@/features/captura/schemas";

export interface Integracao {
  id: string;
  nome: string;
  distribuicaoTipo: DistribuicaoTipo;
  responsavelFixoId: string | null;
  ativo: boolean;
  ultimoUsoEm: string | null;
  revogadoEm: string | null;
}

// token_hash nunca entra aqui — a coluna nem é legível por `authenticated`
// (grant column-level, ver migration 20260923190116_captura_leads.sql).
const COLUNAS_INTEGRACAO =
  "id, nome, distribuicao_tipo, responsavel_fixo_id, ativo, ultimo_uso_em, revogado_em";

interface LinhaIntegracao {
  id: string;
  nome: string;
  distribuicao_tipo: DistribuicaoTipo;
  responsavel_fixo_id: string | null;
  ativo: boolean;
  ultimo_uso_em: string | null;
  revogado_em: string | null;
}

function paraIntegracao(linha: LinhaIntegracao): Integracao {
  return {
    id: linha.id,
    nome: linha.nome,
    distribuicaoTipo: linha.distribuicao_tipo,
    responsavelFixoId: linha.responsavel_fixo_id,
    ativo: linha.ativo,
    ultimoUsoEm: linha.ultimo_uso_em,
    revogadoEm: linha.revogado_em,
  };
}

/** Integrações (webhook genérico) da empresa — qualquer membro lê, só gestor+ gerencia. */
export function useIntegracoes(empresaId: string | null) {
  return useQuery({
    queryKey: ["integracoes", empresaId],
    enabled: !!empresaId,
    queryFn: async (): Promise<Integracao[]> => {
      const { data, error } = await supabase
        .from("integracoes")
        .select(COLUNAS_INTEGRACAO)
        .eq("empresa_id", empresaId as string)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(paraIntegracao as (l: unknown) => Integracao);
    },
  });
}

export interface IntegracaoInput {
  nome: string;
  distribuicaoTipo: DistribuicaoTipo;
  responsavelFixoId: string | null;
}

/**
 * `criar_integracao` (RPC, não `.insert()`) é o único jeito de criar —
 * o token é gerado e hasheado no banco; o valor em claro só existe
 * nesta resposta, uma vez.
 */
export function useCriarIntegracao(empresaId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dados: IntegracaoInput): Promise<{ id: string; token: string }> => {
      if (!empresaId) throw new Error("Selecione uma empresa antes de criar uma integração.");
      const { data, error } = await supabase.rpc("criar_integracao", {
        p_empresa_id: empresaId,
        p_nome: dados.nome,
        p_distribuicao_tipo: dados.distribuicaoTipo,
        p_responsavel_fixo_id:
          dados.distribuicaoTipo === "fixo" ? (dados.responsavelFixoId ?? undefined) : undefined,
      });
      if (error) throw error;
      const linha = data?.[0];
      if (!linha) throw new Error("Falha ao criar integração.");
      return { id: linha.id, token: linha.token };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["integracoes", empresaId] }),
  });
}

export function useRevogarIntegracao(empresaId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (integracaoId: string) => {
      const { error } = await supabase.rpc("revogar_integracao", { p_integracao_id: integracaoId });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["integracoes", empresaId] }),
  });
}
