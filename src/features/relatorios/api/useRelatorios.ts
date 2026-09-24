import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Periodo } from "@/features/relatorios/logica/periodo";

export interface LeadsPorOrigem {
  origem: string | null;
  utmCampaign: string | null;
  totalLeads: number;
  convertidos: number;
  taxaConversao: number;
}

/** Leads por origem/UTM no período — "convertidos" é o status atual (cliente), não quem converteu dentro do período (PRD §6.12, recorte "por origem"). */
export function useRelatorioLeadsPorOrigem(empresaId: string | null, periodo: Periodo) {
  return useQuery({
    queryKey: ["relatorio-leads-origem", empresaId, periodo.dataInicio, periodo.dataFim],
    enabled: !!empresaId,
    queryFn: async (): Promise<LeadsPorOrigem[]> => {
      const { data, error } = await supabase.rpc("relatorio_leads_por_origem", {
        p_empresa_id: empresaId as string,
        p_data_inicio: periodo.dataInicio,
        p_data_fim: periodo.dataFim,
      });
      if (error) throw error;
      return (data ?? []).map((linha) => ({
        origem: linha.origem,
        utmCampaign: linha.utm_campaign,
        totalLeads: Number(linha.total_leads),
        convertidos: Number(linha.convertidos),
        taxaConversao: Number(linha.taxa_conversao),
      }));
    },
  });
}

export interface DesempenhoCampanha {
  campanhaId: string;
  nome: string;
  canal: "email" | "whatsapp";
  disparadaEm: string;
  enviados: number;
  bloqueados: number;
  optouts: number;
  negociosGerados: number;
}

/** Uma linha por campanha disparada no período, reaproveitando `metricas_campanha` no banco (módulo campanhas) — sem duplicar a lógica no cliente. */
export function useRelatorioDesempenhoCampanhas(empresaId: string | null, periodo: Periodo) {
  return useQuery({
    queryKey: ["relatorio-desempenho-campanhas", empresaId, periodo.dataInicio, periodo.dataFim],
    enabled: !!empresaId,
    queryFn: async (): Promise<DesempenhoCampanha[]> => {
      const { data, error } = await supabase.rpc("relatorio_desempenho_campanhas", {
        p_empresa_id: empresaId as string,
        p_data_inicio: periodo.dataInicio,
        p_data_fim: periodo.dataFim,
      });
      if (error) throw error;
      return (data ?? []).map((linha) => ({
        campanhaId: linha.campanha_id,
        nome: linha.nome,
        canal: linha.canal as "email" | "whatsapp",
        disparadaEm: linha.disparada_em as string,
        enviados: Number(linha.enviados),
        bloqueados: Number(linha.bloqueados),
        optouts: Number(linha.optouts),
        negociosGerados: Number(linha.negocios_gerados),
      }));
    },
  });
}
