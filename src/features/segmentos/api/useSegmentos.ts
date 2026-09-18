import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Json } from "@/types/database";

/** Espelha a DSL de `criterios` validada por `validar_criterios_segmento` (schema). */
export type RegraSegmento =
  | { campo: "status"; operador: "em"; valor: string[] }
  | { campo: "temperatura"; operador: "em"; valor: string[] }
  | { campo: "tags"; operador: "contem_algum"; valor: string[] }
  | { campo: "origem"; operador: "em"; valor: string[] }
  | { campo: "cidade"; operador: "igual"; valor: string }
  | { campo: "idade"; operador: "entre"; valor: [number, number] }
  | { campo: "responsavel_id"; operador: "em"; valor: string[] }
  | { campo: "sem_contato_dias"; operador: "maior_ou_igual"; valor: number }
  | {
      campo: "vencimento_tipo_mes";
      operador: "igual";
      valor: { vencimento_tipo_id: string; mes: number };
    }
  | {
      campo: "personalizado";
      chave: string;
      operador: "igual" | "em" | "entre" | "maior_ou_igual" | "menor_ou_igual";
      valor: unknown;
    };

export interface Segmento {
  id: string;
  nome: string;
  regras: RegraSegmento[];
}

function paraSegmento(linha: { id: string; nome: string; criterios: unknown }): Segmento {
  const criterios = (linha.criterios ?? {}) as { regras?: RegraSegmento[] };
  return { id: linha.id, nome: linha.nome, regras: criterios.regras ?? [] };
}

/** Segmentos dinâmicos salvos da empresa (PRD §6.9) — qualquer membro lê. */
export function useSegmentos(empresaId: string | null) {
  return useQuery({
    queryKey: ["segmentos", empresaId],
    enabled: !!empresaId,
    queryFn: async (): Promise<Segmento[]> => {
      const { data, error } = await supabase
        .from("segmentos")
        .select("id, nome, criterios")
        .eq("empresa_id", empresaId as string)
        .is("deleted_at", null)
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data ?? []).map(paraSegmento);
    },
  });
}

export function useSegmento(segmentoId: string | null) {
  return useQuery({
    queryKey: ["segmento", segmentoId],
    enabled: !!segmentoId,
    queryFn: async (): Promise<Segmento> => {
      const { data, error } = await supabase
        .from("segmentos")
        .select("id, nome, criterios")
        .eq("id", segmentoId as string)
        .single();
      if (error) throw error;
      return paraSegmento(data);
    },
  });
}

/**
 * Contagem ao vivo enquanto o usuário edita regras, antes de salvar —
 * `contar_segmento_provisorio` avalia `criterios` direto, sem precisar
 * de uma linha em `segmentos` pra apontar. Debounce simples (400ms)
 * pra não disparar uma consulta a cada tecla.
 */
export function useContagemSegmento(empresaId: string | null, regras: RegraSegmento[]) {
  const [regrasDebounced, setRegrasDebounced] = useState(regras);

  useEffect(() => {
    const temporizador = setTimeout(() => setRegrasDebounced(regras), 400);
    return () => clearTimeout(temporizador);
  }, [regras]);

  return useQuery({
    queryKey: ["contagem-segmento-provisorio", empresaId, regrasDebounced],
    enabled: !!empresaId && regrasDebounced.length > 0,
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc("contar_segmento_provisorio", {
        p_empresa_id: empresaId as string,
        p_criterios: paraCriterios(regrasDebounced),
      });
      if (error) throw error;
      return Number(data ?? 0);
    },
  });
}

/** Contagem sob demanda, direto contra um id de segmento já salvo. */
export function useContarSegmentoSalvo(segmentoId: string | null) {
  return useQuery({
    queryKey: ["contar-segmento", segmentoId],
    enabled: !!segmentoId,
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc("contar_segmento", {
        p_segmento_id: segmentoId as string,
      });
      if (error) throw error;
      return Number(data ?? 0);
    },
  });
}

export interface SegmentoInput {
  nome: string;
  regras: RegraSegmento[];
}

function paraCriterios(regras: RegraSegmento[]): Json {
  return { regras } as unknown as Json;
}

export function useCriarSegmento(empresaId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dados: SegmentoInput) => {
      if (!empresaId) throw new Error("Selecione uma empresa antes de criar um segmento.");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("segmentos")
        .insert({
          empresa_id: empresaId,
          nome: dados.nome,
          criterios: paraCriterios(dados.regras),
          created_by: user?.id,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["segmentos", empresaId] }),
  });
}

export function useAtualizarSegmento(empresaId: string | null, segmentoId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dados: SegmentoInput) => {
      const { error } = await supabase
        .from("segmentos")
        .update({ nome: dados.nome, criterios: paraCriterios(dados.regras) })
        .eq("id", segmentoId);
      if (error) throw error;
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["segmentos", empresaId] }),
        queryClient.invalidateQueries({ queryKey: ["segmento", segmentoId] }),
      ]),
  });
}

/**
 * Exclusão via UPDATE direto (não `excluir_registro`): `segmentos`
 * segue o padrão de configuração compartilhada (RLS gestor+, sem a
 * armadilha de auto-bloqueio que forçou `excluir_registro` pras tabelas
 * com dono — ver docs/fase3/SPEC-segmentos.md, "Correções aplicadas").
 */
export function useExcluirSegmento(empresaId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (segmentoId: string) => {
      const { error } = await supabase
        .from("segmentos")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", segmentoId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["segmentos", empresaId] }),
  });
}
