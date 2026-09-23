import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { CanalCampanha } from "@/features/campanhas/schemas";

export type StatusTemplate = "rascunho" | "aprovado";

export interface Template {
  id: string;
  nome: string;
  canal: CanalCampanha;
  conteudo: string;
  status: StatusTemplate;
}

const COLUNAS_TEMPLATE = "id, nome, canal, conteudo, status";

/** Templates de mensagem da empresa — qualquer membro lê (PRD §6.9). */
export function useTemplates(empresaId: string | null) {
  return useQuery({
    queryKey: ["templates-mensagem", empresaId],
    enabled: !!empresaId,
    queryFn: async (): Promise<Template[]> => {
      const { data, error } = await supabase
        .from("templates_mensagem")
        .select(COLUNAS_TEMPLATE)
        .eq("empresa_id", empresaId as string)
        .is("deleted_at", null)
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Template[];
    },
  });
}

export function useTemplate(templateId: string | null) {
  return useQuery({
    queryKey: ["template-mensagem", templateId],
    enabled: !!templateId,
    queryFn: async (): Promise<Template> => {
      const { data, error } = await supabase
        .from("templates_mensagem")
        .select(COLUNAS_TEMPLATE)
        .eq("id", templateId as string)
        .single();
      if (error) throw error;
      return data as Template;
    },
  });
}

export interface TemplateInput {
  nome: string;
  canal: CanalCampanha;
  conteudo: string;
}

export function useCriarTemplate(empresaId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dados: TemplateInput) => {
      if (!empresaId) throw new Error("Selecione uma empresa antes de criar um template.");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("templates_mensagem")
        .insert({ empresa_id: empresaId, ...dados, created_by: user?.id })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["templates-mensagem", empresaId] }),
  });
}

export function useAtualizarTemplate(empresaId: string | null, templateId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dados: TemplateInput) => {
      const { error } = await supabase
        .from("templates_mensagem")
        .update(dados)
        .eq("id", templateId);
      if (error) throw error;
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["templates-mensagem", empresaId] }),
        queryClient.invalidateQueries({ queryKey: ["template-mensagem", templateId] }),
      ]),
  });
}

/**
 * Aprovar simula a aprovação da Meta no mock — WhatsApp não conecta de
 * verdade nesta fase (ADR 0004). `disparar_campanha` exige
 * `status='aprovado'` pra disparar campanha de WhatsApp.
 */
export function useAprovarTemplate(empresaId: string | null, templateId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("templates_mensagem")
        .update({ status: "aprovado" })
        .eq("id", templateId);
      if (error) throw error;
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["templates-mensagem", empresaId] }),
        queryClient.invalidateQueries({ queryKey: ["template-mensagem", templateId] }),
      ]),
  });
}

/** Exclusão via UPDATE direto — configuração compartilhada, mesmo padrão de segmentos. */
export function useExcluirTemplate(empresaId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase
        .from("templates_mensagem")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", templateId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["templates-mensagem", empresaId] }),
  });
}
