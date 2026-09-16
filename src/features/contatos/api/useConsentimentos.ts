import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export type FinalidadeConsentimento = "atendimento" | "marketing";

export interface DecisaoConsentimento {
  concedido: boolean;
  registradoEm: string;
}

export type ConsentimentosDoContato = Partial<
  Record<FinalidadeConsentimento, DecisaoConsentimento>
>;

/**
 * Estado atual de consentimento do contato, por finalidade — a linha
 * mais recente de `consentimentos` (histórico append-only, nunca
 * atualizado/apagado — ver supabase/migrations/20260910200259_sistema.sql).
 * É o que `processar_fila_envios` (módulo fila-envios) consulta pra
 * decidir se pode mandar mensagem de marketing/atendimento.
 */
export function useConsentimentos(contatoId: string | null) {
  return useQuery({
    queryKey: ["consentimentos", contatoId],
    enabled: !!contatoId,
    queryFn: async (): Promise<ConsentimentosDoContato> => {
      const { data, error } = await supabase
        .from("consentimentos")
        .select("finalidade, concedido, registrado_em")
        .eq("contato_id", contatoId as string)
        .order("registrado_em", { ascending: false });
      if (error) throw error;

      const estado: ConsentimentosDoContato = {};
      for (const linha of data ?? []) {
        const finalidade = linha.finalidade as FinalidadeConsentimento;
        if (estado[finalidade]) continue; // já pegamos a mais recente (ordenado desc)
        estado[finalidade] = { concedido: linha.concedido, registradoEm: linha.registrado_em };
      }
      return estado;
    },
  });
}

export interface RegistrarConsentimentoInput {
  empresaId: string;
  contatoId: string;
  finalidade: FinalidadeConsentimento;
  concedido: boolean;
}

/** Registra uma nova decisão de consentimento (concessão ou revogação) — nunca sobrescreve a anterior. */
export function useRegistrarConsentimento() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: RegistrarConsentimentoInput) => {
      const { error } = await supabase.from("consentimentos").insert({
        empresa_id: input.empresaId,
        contato_id: input.contatoId,
        finalidade: input.finalidade,
        concedido: input.concedido,
        canal: "manual",
        origem: "ficha_contato",
      });
      if (error) throw error;
    },
    onSuccess: (_dados, variaveis) =>
      queryClient.invalidateQueries({ queryKey: ["consentimentos", variaveis.contatoId] }),
  });
}
