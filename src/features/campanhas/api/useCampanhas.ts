import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Json } from "@/types/database";
import type { BlocoFormInput, CanalCampanha } from "@/features/campanhas/schemas";

export type StatusCampanha = "rascunho" | "agendada" | "enviando" | "concluida" | "cancelada";

export interface Campanha {
  id: string;
  nome: string;
  canal: CanalCampanha;
  segmentoId: string;
  templateId: string | null;
  assunto: string | null;
  blocos: BlocoFormInput[];
  status: StatusCampanha;
  agendadoPara: string | null;
  disparadaEm: string | null;
}

const COLUNAS_CAMPANHA =
  "id, nome, canal, segmento_id, template_id, assunto, blocos, status, agendado_para, disparada_em";

interface LinhaCampanha {
  id: string;
  nome: string;
  canal: CanalCampanha;
  segmento_id: string;
  template_id: string | null;
  assunto: string | null;
  blocos: unknown;
  status: StatusCampanha;
  agendado_para: string | null;
  disparada_em: string | null;
}

function paraCampanha(linha: LinhaCampanha): Campanha {
  return {
    id: linha.id,
    nome: linha.nome,
    canal: linha.canal,
    segmentoId: linha.segmento_id,
    templateId: linha.template_id,
    assunto: linha.assunto,
    blocos: (linha.blocos ?? []) as BlocoFormInput[],
    status: linha.status,
    agendadoPara: linha.agendado_para,
    disparadaEm: linha.disparada_em,
  };
}

/** Campanhas da empresa — qualquer membro lê, só gestor+ escreve/dispara (PRD §6.9). */
export function useCampanhas(empresaId: string | null) {
  return useQuery({
    queryKey: ["campanhas", empresaId],
    enabled: !!empresaId,
    queryFn: async (): Promise<Campanha[]> => {
      const { data, error } = await supabase
        .from("campanhas")
        .select(COLUNAS_CAMPANHA)
        .eq("empresa_id", empresaId as string)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(paraCampanha as (l: unknown) => Campanha);
    },
  });
}

export function useCampanha(campanhaId: string | null) {
  return useQuery({
    queryKey: ["campanha", campanhaId],
    enabled: !!campanhaId,
    queryFn: async (): Promise<Campanha> => {
      const { data, error } = await supabase
        .from("campanhas")
        .select(COLUNAS_CAMPANHA)
        .eq("id", campanhaId as string)
        .single();
      if (error) throw error;
      return paraCampanha(data as unknown as LinhaCampanha);
    },
  });
}

export interface CampanhaInput {
  nome: string;
  canal: CanalCampanha;
  segmentoId: string;
  templateId: string | null;
  assunto: string | null;
  blocos: BlocoFormInput[];
  /** ISO, ou null pra "dispara na confirmação" (spec). */
  agendadoPara: string | null;
}

function paraLinha(dados: CampanhaInput) {
  return {
    nome: dados.nome,
    canal: dados.canal,
    segmento_id: dados.segmentoId,
    template_id: dados.canal === "whatsapp" ? dados.templateId : null,
    assunto: dados.canal === "email" ? dados.assunto : null,
    blocos: (dados.canal === "email" ? dados.blocos : []) as unknown as Json,
    agendado_para: dados.agendadoPara,
    status: dados.agendadoPara ? ("agendada" as const) : ("rascunho" as const),
  };
}

export function useCriarCampanha(empresaId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dados: CampanhaInput) => {
      if (!empresaId) throw new Error("Selecione uma empresa antes de criar uma campanha.");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("campanhas")
        .insert({ empresa_id: empresaId, ...paraLinha(dados), created_by: user?.id })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["campanhas", empresaId] }),
  });
}

/** Só faz sentido pra campanha ainda em rascunho/agendada — a RLS deixa gestor+ editar; a UI restringe pelo status. */
export function useAtualizarCampanha(empresaId: string | null, campanhaId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dados: CampanhaInput) => {
      const { error } = await supabase
        .from("campanhas")
        .update(paraLinha(dados))
        .eq("id", campanhaId);
      if (error) throw error;
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["campanhas", empresaId] }),
        queryClient.invalidateQueries({ queryKey: ["campanha", campanhaId] }),
      ]),
  });
}

/** Cancelar, não excluir — campanha já disparada não tem exclusão (boundary do spec). */
export function useCancelarCampanha(empresaId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (campanhaId: string) => {
      const { error } = await supabase
        .from("campanhas")
        .update({ status: "cancelada" })
        .eq("id", campanhaId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["campanhas", empresaId] }),
  });
}

/** Ação irreversível e em massa — a confirmação explícita mora na UI, antes de chamar este hook. */
export function useDispararCampanha(empresaId: string | null, campanhaId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("disparar_campanha", { p_campanha_id: campanhaId });
      if (error) throw error;
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["campanhas", empresaId] }),
        queryClient.invalidateQueries({ queryKey: ["campanha", campanhaId] }),
        queryClient.invalidateQueries({ queryKey: ["campanha-envios", campanhaId] }),
        queryClient.invalidateQueries({ queryKey: ["metricas-campanha", campanhaId] }),
      ]),
  });
}

export interface PreviewLinha {
  contatoId: string;
  conteudoResolvido: string | null;
}

/** Prévia com dado real de um contato do segmento — nada é gravado (PRD §6.9). */
export function usePreviewCampanha(campanhaId: string | null) {
  return useQuery({
    queryKey: ["preview-campanha", campanhaId],
    enabled: !!campanhaId,
    queryFn: async (): Promise<PreviewLinha[]> => {
      const { data, error } = await supabase.rpc("preview_campanha", {
        p_campanha_id: campanhaId as string,
      });
      if (error) throw error;
      return (data ?? []).map((linha) => ({
        contatoId: linha.contato_id,
        conteudoResolvido: linha.conteudo_resolvido,
      }));
    },
  });
}

export interface MetricasCampanha {
  enviados: number;
  entregues: number;
  lidos: number;
  bloqueados: number;
  optouts: number;
  negociosGerados: number;
}

export function useMetricasCampanha(campanhaId: string | null) {
  return useQuery({
    queryKey: ["metricas-campanha", campanhaId],
    enabled: !!campanhaId,
    queryFn: async (): Promise<MetricasCampanha> => {
      const { data, error } = await supabase.rpc("metricas_campanha", {
        p_campanha_id: campanhaId as string,
      });
      if (error) throw error;
      const linha = data?.[0];
      return {
        enviados: Number(linha?.enviados ?? 0),
        entregues: Number(linha?.entregues ?? 0),
        lidos: Number(linha?.lidos ?? 0),
        bloqueados: Number(linha?.bloqueados ?? 0),
        optouts: Number(linha?.optouts ?? 0),
        negociosGerados: Number(linha?.negocios_gerados ?? 0),
      };
    },
  });
}

export interface CampanhaEnvio {
  contatoId: string;
  contatoNome: string;
  status: "pendente" | "bloqueada" | "enviada" | "falhou" | null;
  motivoBloqueio: string | null;
}

/**
 * Uma linha por contato alcançado — é o que responde "por que não
 * enviou pra fulano" na tela de detalhe. `motivo_bloqueio` da própria
 * linha é o bloqueio pré-fila (variável sem valor); o de `fila_envios`
 * é o pós-fila (consentimento, opt-out, horário comercial etc.).
 */
export function useCampanhaEnvios(campanhaId: string | null) {
  return useQuery({
    queryKey: ["campanha-envios", campanhaId],
    enabled: !!campanhaId,
    queryFn: async (): Promise<CampanhaEnvio[]> => {
      const { data, error } = await supabase
        .from("campanha_envios")
        .select("contato_id, motivo_bloqueio, contatos(nome), fila_envios(status, motivo_bloqueio)")
        .eq("campanha_id", campanhaId as string)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((linha) => ({
        contatoId: linha.contato_id,
        contatoNome: linha.contatos?.nome ?? "—",
        status: (linha.fila_envios?.status ?? null) as CampanhaEnvio["status"],
        motivoBloqueio: linha.motivo_bloqueio ?? linha.fila_envios?.motivo_bloqueio ?? null,
      }));
    },
  });
}
