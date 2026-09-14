import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { diferencaEmDias } from "@/lib/datas";

export interface LeadSemContato {
  id: string;
  nome: string;
  telefone: string | null;
  diasEspera: number;
}

/** PRD §6.2, item 1: leads novos que ainda não tiveram primeiro contato. */
export function useLeadsSemContato(empresaId: string | null, hoje: string) {
  return useQuery({
    queryKey: ["hoje-leads-sem-contato", empresaId],
    enabled: !!empresaId,
    queryFn: async (): Promise<LeadSemContato[]> => {
      const { data, error } = await supabase
        .from("contatos")
        .select("id, nome, telefone, created_at")
        .eq("empresa_id", empresaId as string)
        .eq("status", "lead")
        .is("ultimo_contato_em", null)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((c) => ({
        id: c.id,
        nome: c.nome,
        telefone: c.telefone,
        diasEspera: Math.max(0, diferencaEmDias(c.created_at.slice(0, 10), hoje)),
      }));
    },
  });
}

export interface NegocioVencido {
  id: string;
  contatoNome: string;
  funilNome: string;
  proximoPassoAcao: string;
  proximoPassoEm: string;
}

/** PRD §6.5: negócios com próximo passo vencido entram na tela "Hoje" — cruza todos os funis. */
export function useNegociosVencidos(empresaId: string | null, hoje: string) {
  return useQuery({
    queryKey: ["hoje-negocios-vencidos", empresaId, hoje],
    enabled: !!empresaId,
    queryFn: async (): Promise<NegocioVencido[]> => {
      const { data, error } = await supabase
        .from("negocios")
        .select("id, proximo_passo_acao, proximo_passo_em, contatos(nome), funis(nome)")
        .eq("empresa_id", empresaId as string)
        .eq("status", "aberto")
        .lte("proximo_passo_em", hoje)
        .is("deleted_at", null)
        .order("proximo_passo_em", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((n) => ({
        id: n.id,
        contatoNome: n.contatos?.nome ?? "—",
        funilNome: n.funis?.nome ?? "—",
        proximoPassoAcao: n.proximo_passo_acao,
        proximoPassoEm: n.proximo_passo_em,
      }));
    },
  });
}

export interface VencimentoPendente {
  id: string;
  contatoNome: string;
  descricao: string | null;
  dataVencimento: string;
  status: string;
}

const statusTerminal = new Set(["renovado", "nao_renovado", "cancelado"]);

/**
 * Simplificação do PRD (§6.4/6.2) sem sistema de régua ainda (Fase 2):
 * vencimentos vencendo hoje ou atrasados que ainda não foram resolvidos.
 */
export function useVencimentosPendentesHoje(empresaId: string | null, hoje: string) {
  return useQuery({
    queryKey: ["hoje-vencimentos", empresaId, hoje],
    enabled: !!empresaId,
    queryFn: async (): Promise<VencimentoPendente[]> => {
      const { data, error } = await supabase
        .from("vencimentos")
        .select("id, descricao, data_vencimento, status, contatos(nome)")
        .eq("empresa_id", empresaId as string)
        .lte("data_vencimento", hoje)
        .is("deleted_at", null)
        .order("data_vencimento", { ascending: true });
      if (error) throw error;
      return (data ?? [])
        .filter((v) => !statusTerminal.has(v.status))
        .map((v) => ({
          id: v.id,
          contatoNome: v.contatos?.nome ?? "—",
          descricao: v.descricao,
          dataVencimento: v.data_vencimento,
          status: v.status,
        }));
    },
  });
}

export interface Aniversariante {
  id: string;
  nome: string;
  telefone: string | null;
}

/** PRD §6.2, item 5: aniversariantes do dia. */
export function useAniversariantesHoje(empresaId: string | null, hoje: string) {
  return useQuery({
    queryKey: ["hoje-aniversariantes", empresaId, hoje],
    enabled: !!empresaId,
    queryFn: async (): Promise<Aniversariante[]> => {
      const { data, error } = await supabase
        .from("contatos")
        .select("id, nome, telefone, nascimento")
        .eq("empresa_id", empresaId as string)
        .not("nascimento", "is", null)
        .is("deleted_at", null);
      if (error) throw error;
      const mesDia = hoje.slice(5, 10);
      return (data ?? [])
        .filter((c) => c.nascimento && c.nascimento.slice(5, 10) === mesDia)
        .map((c) => ({ id: c.id, nome: c.nome, telefone: c.telefone }));
    },
  });
}

export interface ResumoNumeros {
  leadsNaSemana: number;
  negociosAbertos: number;
  vencimentosProximos30Dias: number;
  taxaRenovacaoMes: number | null;
}

/** Cards resumidos abaixo da lista de ações (PRD §6.2). */
export function useResumoNumeros(empresaId: string | null, hoje: string) {
  return useQuery({
    queryKey: ["hoje-resumo-numeros", empresaId, hoje],
    enabled: !!empresaId,
    queryFn: async (): Promise<ResumoNumeros> => {
      const seteDiasAtras = new Date(`${hoje}T00:00:00Z`);
      seteDiasAtras.setUTCDate(seteDiasAtras.getUTCDate() - 7);
      const em30Dias = new Date(`${hoje}T00:00:00Z`);
      em30Dias.setUTCDate(em30Dias.getUTCDate() + 30);
      const inicioMes = `${hoje.slice(0, 7)}-01`;

      const [leads, negocios, vencimentos, renovados, naoRenovados] = await Promise.all([
        supabase
          .from("contatos")
          .select("id", { count: "exact", head: true })
          .eq("empresa_id", empresaId as string)
          .eq("status", "lead")
          .is("deleted_at", null)
          .gte("created_at", seteDiasAtras.toISOString()),
        supabase
          .from("negocios")
          .select("id", { count: "exact", head: true })
          .eq("empresa_id", empresaId as string)
          .eq("status", "aberto")
          .is("deleted_at", null),
        supabase
          .from("vencimentos")
          .select("id", { count: "exact", head: true })
          .eq("empresa_id", empresaId as string)
          .is("deleted_at", null)
          .gte("data_vencimento", hoje)
          .lte("data_vencimento", em30Dias.toISOString().slice(0, 10)),
        supabase
          .from("vencimentos")
          .select("id", { count: "exact", head: true })
          .eq("empresa_id", empresaId as string)
          .eq("status", "renovado")
          .gte("updated_at", inicioMes),
        supabase
          .from("vencimentos")
          .select("id", { count: "exact", head: true })
          .eq("empresa_id", empresaId as string)
          .eq("status", "nao_renovado")
          .gte("updated_at", inicioMes),
      ]);

      const totalFinalizados = (renovados.count ?? 0) + (naoRenovados.count ?? 0);

      return {
        leadsNaSemana: leads.count ?? 0,
        negociosAbertos: negocios.count ?? 0,
        vencimentosProximos30Dias: vencimentos.count ?? 0,
        taxaRenovacaoMes: totalFinalizados > 0 ? (renovados.count ?? 0) / totalFinalizados : null,
      };
    },
  });
}

export interface PrimeirosPassos {
  importouContatos: boolean;
  cadastrouVencimento: boolean;
  convidouEquipe: boolean;
  completo: boolean;
}

/**
 * Checklist "Primeiros passos" (PRD §6.1), adiado do 1B pro 1D. Só os 3
 * itens viáveis na Fase 1 — "conectar WhatsApp" e "ativar régua" dependem
 * de infra que só existe na Fase 2 (decisão tomada com o usuário).
 */
export function usePrimeirosPassos(empresaId: string | null) {
  return useQuery({
    queryKey: ["hoje-primeiros-passos", empresaId],
    enabled: !!empresaId,
    queryFn: async (): Promise<PrimeirosPassos> => {
      const [contatos, vencimentos, membros] = await Promise.all([
        supabase
          .from("contatos")
          .select("id", { count: "exact", head: true })
          .eq("empresa_id", empresaId as string)
          .is("deleted_at", null),
        supabase
          .from("vencimentos")
          .select("id", { count: "exact", head: true })
          .eq("empresa_id", empresaId as string)
          .is("deleted_at", null),
        supabase
          .from("empresa_membros")
          .select("id", { count: "exact", head: true })
          .eq("empresa_id", empresaId as string),
      ]);

      const importouContatos = (contatos.count ?? 0) > 0;
      const cadastrouVencimento = (vencimentos.count ?? 0) > 0;
      const convidouEquipe = (membros.count ?? 0) > 1;

      return {
        importouContatos,
        cadastrouVencimento,
        convidouEquipe,
        completo: importouContatos && cadastrouVencimento && convidouEquipe,
      };
    },
  });
}
