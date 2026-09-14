import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface NichoTemplate {
  nicho: string;
  nomeExibicao: string;
}

/** Catálogo de nichos disponíveis (dado global, PRD §3.2) pro select do onboarding. */
export function useNichoTemplates() {
  return useQuery({
    queryKey: ["nicho-templates"],
    queryFn: async (): Promise<NichoTemplate[]> => {
      const { data, error } = await supabase
        .from("nicho_templates")
        .select("nicho, nome_exibicao")
        .order("nome_exibicao", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((t) => ({ nicho: t.nicho, nomeExibicao: t.nome_exibicao }));
    },
  });
}

/** Cria a empresa, vira dono, aplica o template do nicho — tudo em criar_empresa_com_onboarding(). */
export function useCriarEmpresa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { nome: string; nicho: string; aceiteTermos: boolean }) => {
      const { data, error } = await supabase.rpc("criar_empresa_com_onboarding", {
        p_nome: input.nome,
        p_nicho: input.nicho,
        p_aceite_termos: input.aceiteTermos,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["empresas"] });
    },
  });
}

/** Consome um convite pendente e entra na empresa com o papel definido nele. */
export function useAceitarConvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (token: string) => {
      const { data, error } = await supabase.rpc("aceitar_convite", { p_token: token });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["empresas"] });
    },
  });
}

export interface Convite {
  id: string;
  email: string;
  papel: "dono" | "gestor" | "usuario";
  status: string;
  token: string;
}

/** Convites da empresa (RLS já restringe a gestor+ — ver migration 1A `plataforma`). */
export function useConvites(empresaId: string | null) {
  return useQuery({
    queryKey: ["convites", empresaId],
    enabled: !!empresaId,
    queryFn: async (): Promise<Convite[]> => {
      const { data, error } = await supabase
        .from("convites")
        .select("id, email, papel, status, token")
        .eq("empresa_id", empresaId as string)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Convite[];
    },
  });
}

export function useCriarConvite(empresaId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { email: string; papel: "gestor" | "usuario" }) => {
      if (!empresaId) throw new Error("Selecione uma empresa antes de convidar.");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("convites")
        .insert({
          empresa_id: empresaId,
          email: input.email,
          papel: input.papel,
          created_by: user?.id,
        })
        .select("id, email, papel, status, token")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["convites", empresaId] });
    },
  });
}
