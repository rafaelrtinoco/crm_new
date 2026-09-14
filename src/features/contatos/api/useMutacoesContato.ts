import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Json } from "@/types/database";
import type { ContatoInput } from "@/features/contatos/schemas";

function paraLinha(empresaId: string, dados: ContatoInput) {
  return {
    empresa_id: empresaId,
    nome: dados.nome,
    status: dados.status,
    temperatura: dados.temperatura || null,
    origem: dados.origem || null,
    telefone: dados.telefone || null,
    email: dados.email || null,
    cpf_cnpj: dados.cpfCnpj || null,
    nascimento: dados.nascimento || null,
    responsavel_id: dados.responsavelId || null,
    endereco: (dados.endereco ?? null) as Json,
    campos: (dados.campos ?? {}) as Json,
  };
}

export function useCriarContato(empresaId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dados: ContatoInput) => {
      if (!empresaId) throw new Error("Selecione uma empresa antes de cadastrar um contato.");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("contatos")
        .insert({ ...paraLinha(empresaId, dados), created_by: user?.id })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["contatos", empresaId] }),
  });
}

export function useAtualizarContato(empresaId: string | null, contatoId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dados: ContatoInput) => {
      if (!empresaId) throw new Error("Selecione uma empresa antes de editar um contato.");
      const { error } = await supabase
        .from("contatos")
        .update(paraLinha(empresaId, dados))
        .eq("id", contatoId);
      if (error) throw error;
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["contatos", empresaId] }),
        queryClient.invalidateQueries({ queryKey: ["contato", contatoId] }),
      ]),
  });
}

export function useExcluirContato(empresaId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (contatoId: string) => {
      const { error } = await supabase
        .from("contatos")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", contatoId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["contatos", empresaId] }),
  });
}
