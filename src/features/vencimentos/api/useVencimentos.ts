import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface Vencimento {
  id: string;
  contatoId: string;
  contatoNome: string;
  vencimentoTipoId: string | null;
  descricao: string | null;
  dataVencimento: string;
  valor: number | null;
  recorrencia: string;
  status: string;
  responsavelId: string | null;
}

export interface FiltrosVencimentos {
  status?: string;
  vencimentoTipoId?: string;
  responsavelId?: string;
  contatoId?: string;
  de?: string;
  ate?: string;
}

/** Lista de vencimentos da empresa atual, com os filtros do PRD §6.4. */
export function useVencimentos(empresaId: string | null, filtros: FiltrosVencimentos = {}) {
  return useQuery({
    queryKey: ["vencimentos", empresaId, filtros],
    enabled: !!empresaId,
    queryFn: async (): Promise<Vencimento[]> => {
      let query = supabase
        .from("vencimentos")
        .select(
          "id, contato_id, vencimento_tipo_id, descricao, data_vencimento, valor, recorrencia, status, responsavel_id, contatos(nome)",
        )
        .eq("empresa_id", empresaId as string)
        .is("deleted_at", null)
        .order("data_vencimento", { ascending: true });

      if (filtros.status) query = query.eq("status", filtros.status);
      if (filtros.vencimentoTipoId)
        query = query.eq("vencimento_tipo_id", filtros.vencimentoTipoId);
      if (filtros.responsavelId) query = query.eq("responsavel_id", filtros.responsavelId);
      if (filtros.contatoId) query = query.eq("contato_id", filtros.contatoId);
      if (filtros.de) query = query.gte("data_vencimento", filtros.de);
      if (filtros.ate) query = query.lte("data_vencimento", filtros.ate);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map((v) => ({
        id: v.id,
        contatoId: v.contato_id,
        contatoNome: v.contatos?.nome ?? "—",
        vencimentoTipoId: v.vencimento_tipo_id,
        descricao: v.descricao,
        dataVencimento: v.data_vencimento,
        valor: v.valor,
        recorrencia: v.recorrencia,
        status: v.status,
        responsavelId: v.responsavel_id,
      }));
    },
  });
}

export interface VencimentoCompleto extends Vencimento {
  campos: Record<string, unknown>;
}

export function useVencimento(vencimentoId: string | null) {
  return useQuery({
    queryKey: ["vencimento", vencimentoId],
    enabled: !!vencimentoId,
    queryFn: async (): Promise<VencimentoCompleto | null> => {
      const { data, error } = await supabase
        .from("vencimentos")
        .select(
          "id, contato_id, vencimento_tipo_id, descricao, data_vencimento, valor, recorrencia, status, responsavel_id, campos, contatos(nome)",
        )
        .eq("id", vencimentoId as string)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        id: data.id,
        contatoId: data.contato_id,
        contatoNome: data.contatos?.nome ?? "—",
        vencimentoTipoId: data.vencimento_tipo_id,
        descricao: data.descricao,
        dataVencimento: data.data_vencimento,
        valor: data.valor,
        recorrencia: data.recorrencia,
        status: data.status,
        responsavelId: data.responsavel_id,
        campos: (data.campos ?? {}) as Record<string, unknown>,
      };
    },
  });
}
