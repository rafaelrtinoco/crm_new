import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/features/auth/api/useAuth";

const CHAVE_EMPRESA_ATUAL = "facility:empresa-atual";

export interface EmpresaMembro {
  empresaId: string;
  nome: string;
  nicho: string;
  papel: "dono" | "gestor" | "usuario";
  vocabulario: unknown;
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
        .select("empresa_id, papel, empresas(nome, nicho, vocabulario)")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((linha) => ({
        empresaId: linha.empresa_id,
        papel: linha.papel as EmpresaMembro["papel"],
        nome: linha.empresas?.nome ?? "",
        nicho: linha.empresas?.nicho ?? "",
        vocabulario: linha.empresas?.vocabulario,
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
