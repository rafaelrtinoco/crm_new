import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface Notificacao {
  id: string;
  tipo: string;
  titulo: string;
  corpo: string;
  url: string | null;
  lidaEm: string | null;
  createdAt: string;
}

const LIMITE = 30;

/** Central de notificações (PRD §6.14) — só as do usuário logado, na empresa atual. */
export function useNotificacoes(empresaId: string | null) {
  return useQuery({
    queryKey: ["notificacoes", empresaId],
    enabled: !!empresaId,
    refetchInterval: 60_000,
    queryFn: async (): Promise<Notificacao[]> => {
      const { data, error } = await supabase
        .from("notificacoes")
        .select("id, tipo, titulo, corpo, url, lida_em, created_at")
        .eq("empresa_id", empresaId as string)
        .order("created_at", { ascending: false })
        .limit(LIMITE);
      if (error) throw error;
      return (data ?? []).map((n) => ({
        id: n.id,
        tipo: n.tipo,
        titulo: n.titulo,
        corpo: n.corpo,
        url: n.url,
        lidaEm: n.lida_em,
        createdAt: n.created_at,
      }));
    },
  });
}

export function useMarcarNotificacaoLida(empresaId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (notificacaoId: string) => {
      const { error } = await supabase
        .from("notificacoes")
        .update({ lida_em: new Date().toISOString() })
        .eq("id", notificacaoId)
        .is("lida_em", null);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notificacoes", empresaId] }),
  });
}

export function useMarcarTodasLidas(empresaId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!empresaId) return;
      const { error } = await supabase
        .from("notificacoes")
        .update({ lida_em: new Date().toISOString() })
        .eq("empresa_id", empresaId)
        .is("lida_em", null);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notificacoes", empresaId] }),
  });
}
