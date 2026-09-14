import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface Negocio {
  id: string;
  contatoId: string;
  contatoNome: string;
  funilId: string;
  etapaId: string;
  valorEstimado: number | null;
  responsavelId: string | null;
  previsaoFechamento: string | null;
  proximoPassoEm: string;
  proximoPassoAcao: string;
  status: string;
  motivoPerdaId: string | null;
  reativarEm: string | null;
  entrouNaEtapaEm: string;
}

export interface FiltrosNegocios {
  responsavelId?: string;
  status?: string;
}

const SELECT_NEGOCIO =
  "id, contato_id, funil_id, etapa_id, valor_estimado, responsavel_id, previsao_fechamento, proximo_passo_em, proximo_passo_acao, status, motivo_perda_id, reativar_em, entrou_na_etapa_em, contatos(nome)";

function paraNegocio(linha: {
  id: string;
  contato_id: string;
  contatos: { nome: string } | null;
  funil_id: string;
  etapa_id: string;
  valor_estimado: number | null;
  responsavel_id: string | null;
  previsao_fechamento: string | null;
  proximo_passo_em: string;
  proximo_passo_acao: string;
  status: string;
  motivo_perda_id: string | null;
  reativar_em: string | null;
  entrou_na_etapa_em: string;
}): Negocio {
  return {
    id: linha.id,
    contatoId: linha.contato_id,
    contatoNome: linha.contatos?.nome ?? "—",
    funilId: linha.funil_id,
    etapaId: linha.etapa_id,
    valorEstimado: linha.valor_estimado,
    responsavelId: linha.responsavel_id,
    previsaoFechamento: linha.previsao_fechamento,
    proximoPassoEm: linha.proximo_passo_em,
    proximoPassoAcao: linha.proximo_passo_acao,
    status: linha.status,
    motivoPerdaId: linha.motivo_perda_id,
    reativarEm: linha.reativar_em,
    entrouNaEtapaEm: linha.entrou_na_etapa_em,
  };
}

/** Negócios abertos de um funil (quadro/lista) — PRD §6.5. */
export function useNegocios(
  empresaId: string | null,
  funilId: string | null,
  filtros: FiltrosNegocios = {},
) {
  return useQuery({
    queryKey: ["negocios", empresaId, funilId, filtros],
    enabled: !!empresaId && !!funilId,
    queryFn: async (): Promise<Negocio[]> => {
      let query = supabase
        .from("negocios")
        .select(SELECT_NEGOCIO)
        .eq("empresa_id", empresaId as string)
        .eq("funil_id", funilId as string)
        .is("deleted_at", null)
        .order("proximo_passo_em", { ascending: true });

      if (filtros.responsavelId) query = query.eq("responsavel_id", filtros.responsavelId);
      query = filtros.status ? query.eq("status", filtros.status) : query.eq("status", "aberto");

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map(paraNegocio);
    },
  });
}

/** Negócios de um contato específico, em qualquer funil — pra aba do contato. */
export function useNegociosDoContato(contatoId: string | null) {
  return useQuery({
    queryKey: ["negocios-contato", contatoId],
    enabled: !!contatoId,
    queryFn: async (): Promise<Negocio[]> => {
      const { data, error } = await supabase
        .from("negocios")
        .select(SELECT_NEGOCIO)
        .eq("contato_id", contatoId as string)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(paraNegocio);
    },
  });
}

export function useNegocio(negocioId: string | null) {
  return useQuery({
    queryKey: ["negocio", negocioId],
    enabled: !!negocioId,
    queryFn: async (): Promise<Negocio | null> => {
      const { data, error } = await supabase
        .from("negocios")
        .select(SELECT_NEGOCIO)
        .eq("id", negocioId as string)
        .maybeSingle();
      if (error) throw error;
      return data ? paraNegocio(data) : null;
    },
  });
}
