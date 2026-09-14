import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Json } from "@/types/database";
import type { DadosDeduplicaveis } from "@/features/importacao/logica/deduplicacao";

/** Telefone/e-mail/CPF-CNPJ de todos os contatos da empresa, pra montar as chaves de dedup. */
export function useContatosExistentes(empresaId: string | null) {
  return useQuery({
    queryKey: ["contatos-existentes-dedup", empresaId],
    enabled: !!empresaId,
    queryFn: async (): Promise<DadosDeduplicaveis[]> => {
      const { data, error } = await supabase
        .from("contatos")
        .select("telefone, email, cpf_cnpj")
        .eq("empresa_id", empresaId as string)
        .is("deleted_at", null);
      if (error) throw error;
      return (data ?? []).map((c) => ({
        telefone: c.telefone ?? undefined,
        email: c.email ?? undefined,
        cpfCnpj: c.cpf_cnpj ?? undefined,
      }));
    },
  });
}

export function useCriarImportacao(empresaId: string | null) {
  return useMutation({
    mutationFn: async (input: {
      arquivoNome: string;
      mapeamentoColunas: Record<string, string | null>;
      totalLinhas: number;
    }) => {
      if (!empresaId) throw new Error("Selecione uma empresa antes de importar.");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("importacoes")
        .insert({
          empresa_id: empresaId,
          arquivo_nome: input.arquivoNome,
          mapeamento_colunas: input.mapeamentoColunas as Json,
          total_linhas: input.totalLinhas,
          created_by: user?.id,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
  });
}

export function useFinalizarImportacao(empresaId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      importacaoId: string;
      totalImportadas: number;
      totalErros: number;
      totalLinhas: number;
    }) => {
      const status =
        input.totalErros === 0
          ? "concluida"
          : input.totalImportadas === 0
            ? "falhou"
            : "concluida_com_erros";
      const { error } = await supabase
        .from("importacoes")
        .update({
          status,
          total_importadas: input.totalImportadas,
          total_erros: input.totalErros,
        })
        .eq("id", input.importacaoId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["contatos", empresaId] }),
  });
}

export function useRegistrarErroImportacao() {
  return useMutation({
    mutationFn: async (input: {
      empresaId: string;
      importacaoId: string;
      linha: number;
      erro: string;
      dadosOriginais: Record<string, unknown>;
    }) => {
      const { error } = await supabase.from("importacao_erros").insert({
        empresa_id: input.empresaId,
        importacao_id: input.importacaoId,
        linha: input.linha,
        erro: input.erro,
        dados_originais: input.dadosOriginais as Json,
      });
      if (error) throw error;
    },
  });
}
