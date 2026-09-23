import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/features/auth/api/useAuth";

const CHAVE_EMPRESA_ATUAL = "facility:empresa-atual";

export interface EmpresaMembro {
  empresaId: string;
  nome: string;
  nicho: string;
  fuso: string;
  papel: "dono" | "gestor" | "usuario";
  vocabulario: unknown;
  /** Usado nas URLs públicas de captura (/p/{slug}/..., /f/{slug}/...) — null até alguém configurar. */
  slug: string | null;
}

/** Empresas às quais o usuário logado pertence (PRD §5.1: pode pertencer a mais de uma). */
export function useEmpresas() {
  const { usuario } = useAuth();
  return useQuery({
    queryKey: ["empresas", usuario?.id],
    enabled: !!usuario,
    queryFn: async (): Promise<EmpresaMembro[]> => {
      const { data, error } = await supabase
        .from("empresa_membros")
        .select("empresa_id, papel, empresas(nome, nicho, fuso, vocabulario, slug)")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((linha) => ({
        empresaId: linha.empresa_id,
        papel: linha.papel as EmpresaMembro["papel"],
        nome: linha.empresas?.nome ?? "",
        nicho: linha.empresas?.nicho ?? "",
        fuso: linha.empresas?.fuso ?? "America/Sao_Paulo",
        vocabulario: linha.empresas?.vocabulario,
        slug: linha.empresas?.slug ?? null,
      }));
    },
  });
}

/** Empresa selecionada no momento (persistida como UUID em localStorage — não é dado pessoal). */
export function useEmpresaAtual() {
  const { data: empresas } = useEmpresas();
  const [empresaId, setEmpresaId] = useState<string | null>(() =>
    typeof window === "undefined" ? null : window.localStorage.getItem(CHAVE_EMPRESA_ATUAL),
  );

  useEffect(() => {
    if (!empresas || empresas.length === 0) return;
    const existe = empresas.some((e) => e.empresaId === empresaId);
    if (!existe) {
      const primeira = empresas[0]?.empresaId;
      if (primeira) {
        setEmpresaId(primeira);
        window.localStorage.setItem(CHAVE_EMPRESA_ATUAL, primeira);
      }
    }
  }, [empresas, empresaId]);

  function selecionar(id: string) {
    setEmpresaId(id);
    window.localStorage.setItem(CHAVE_EMPRESA_ATUAL, id);
  }

  const atual = empresas?.find((e) => e.empresaId === empresaId) ?? null;

  return { empresas: empresas ?? [], atual, selecionar };
}

export interface MembroEmpresa {
  usuarioId: string;
  nome: string;
  papel: "dono" | "gestor" | "usuario";
}

/**
 * Membros da empresa atual, com nome — pra seletores de "responsável".
 * `membros_empresa` é uma view que já junta `empresa_membros` + `perfis`
 * (as duas só se relacionam via `auth.users`, sem FK direta — o
 * PostgREST não conseguia embedar, por isso antes eram duas consultas).
 */
export function useMembrosEmpresa(empresaId: string | null) {
  return useQuery({
    queryKey: ["membros-empresa", empresaId],
    enabled: !!empresaId,
    queryFn: async (): Promise<MembroEmpresa[]> => {
      const { data, error } = await supabase
        .from("membros_empresa")
        .select("usuario_id, papel, nome")
        .eq("empresa_id", empresaId as string)
        .order("nome", { ascending: true });
      if (error) throw error;
      // As colunas da view vêm tipadas como nullable (o gerador de tipos
      // não enxerga os "not null" das tabelas de origem através de uma
      // view), mas usuario_id nunca é nulo de fato — filtra defensivo.
      return (data ?? [])
        .filter(
          (linha): linha is typeof linha & { usuario_id: string } => linha.usuario_id !== null,
        )
        .map((linha) => ({
          usuarioId: linha.usuario_id,
          papel: linha.papel as MembroEmpresa["papel"],
          nome: linha.nome ?? "—",
        }));
    },
  });
}
