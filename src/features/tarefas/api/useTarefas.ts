import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface Tarefa {
  id: string;
  tipo: string;
  titulo: string;
  dataVencimento: string;
  responsavelId: string | null;
  contatoId: string | null;
  contatoNome: string | null;
  negocioId: string | null;
  negocioAcao: string | null;
  concluidaEm: string | null;
}

export interface FiltrosTarefas {
  status?: "pendente" | "concluida" | "todas";
  tipo?: string;
  responsavelId?: string;
  contatoId?: string;
  negocioId?: string;
}

const SELECT_TAREFA =
  "id, tipo, titulo, data_vencimento, responsavel_id, contato_id, negocio_id, concluida_em, contatos(nome), negocios(proximo_passo_acao)";

function paraTarefa(linha: {
  id: string;
  tipo: string;
  titulo: string;
  data_vencimento: string;
  responsavel_id: string | null;
  contato_id: string | null;
  contatos: { nome: string } | null;
  negocio_id: string | null;
  negocios: { proximo_passo_acao: string } | null;
  concluida_em: string | null;
}): Tarefa {
  return {
    id: linha.id,
    tipo: linha.tipo,
    titulo: linha.titulo,
    dataVencimento: linha.data_vencimento,
    responsavelId: linha.responsavel_id,
    contatoId: linha.contato_id,
    contatoNome: linha.contatos?.nome ?? null,
    negocioId: linha.negocio_id,
    negocioAcao: linha.negocios?.proximo_passo_acao ?? null,
    concluidaEm: linha.concluida_em,
  };
}

/** Tarefas da empresa atual (PRD §6.6), com filtros de status/tipo/responsável/vínculo. */
export function useTarefas(empresaId: string | null, filtros: FiltrosTarefas = {}) {
  return useQuery({
    queryKey: ["tarefas", empresaId, filtros],
    enabled: !!empresaId,
    queryFn: async (): Promise<Tarefa[]> => {
      let query = supabase
        .from("tarefas")
        .select(SELECT_TAREFA)
        .eq("empresa_id", empresaId as string)
        .is("deleted_at", null)
        .order("data_vencimento", { ascending: true });

      if (filtros.status === "pendente") query = query.is("concluida_em", null);
      if (filtros.status === "concluida") query = query.not("concluida_em", "is", null);
      if (filtros.tipo) query = query.eq("tipo", filtros.tipo);
      if (filtros.responsavelId) query = query.eq("responsavel_id", filtros.responsavelId);
      if (filtros.contatoId) query = query.eq("contato_id", filtros.contatoId);
      if (filtros.negocioId) query = query.eq("negocio_id", filtros.negocioId);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map(paraTarefa);
    },
  });
}

export function useTarefa(tarefaId: string | null) {
  return useQuery({
    queryKey: ["tarefa", tarefaId],
    enabled: !!tarefaId,
    queryFn: async (): Promise<Tarefa | null> => {
      const { data, error } = await supabase
        .from("tarefas")
        .select(SELECT_TAREFA)
        .eq("id", tarefaId as string)
        .maybeSingle();
      if (error) throw error;
      return data ? paraTarefa(data) : null;
    },
  });
}
