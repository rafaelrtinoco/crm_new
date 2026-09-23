import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface PaginaCaptura {
  id: string;
  slug: string;
  titulo: string;
  texto: string | null;
  imagemUrl: string | null;
  formularioId: string | null;
  whatsappNumero: string | null;
  whatsappMensagem: string | null;
  ativo: boolean;
}

const COLUNAS_PAGINA =
  "id, slug, titulo, texto, imagem_url, formulario_id, whatsapp_numero, whatsapp_mensagem, ativo";

interface LinhaPagina {
  id: string;
  slug: string;
  titulo: string;
  texto: string | null;
  imagem_url: string | null;
  formulario_id: string | null;
  whatsapp_numero: string | null;
  whatsapp_mensagem: string | null;
  ativo: boolean;
}

function paraPagina(linha: LinhaPagina): PaginaCaptura {
  return {
    id: linha.id,
    slug: linha.slug,
    titulo: linha.titulo,
    texto: linha.texto,
    imagemUrl: linha.imagem_url,
    formularioId: linha.formulario_id,
    whatsappNumero: linha.whatsapp_numero,
    whatsappMensagem: linha.whatsapp_mensagem,
    ativo: linha.ativo,
  };
}

/** Páginas de captura da empresa — qualquer membro lê, só gestor+ escreve. */
export function usePaginasCaptura(empresaId: string | null) {
  return useQuery({
    queryKey: ["paginas-captura", empresaId],
    enabled: !!empresaId,
    queryFn: async (): Promise<PaginaCaptura[]> => {
      const { data, error } = await supabase
        .from("paginas_captura")
        .select(COLUNAS_PAGINA)
        .eq("empresa_id", empresaId as string)
        .is("deleted_at", null)
        .order("titulo", { ascending: true });
      if (error) throw error;
      return (data ?? []).map(paraPagina as (l: unknown) => PaginaCaptura);
    },
  });
}

export function usePaginaCaptura(paginaId: string | null) {
  return useQuery({
    queryKey: ["pagina-captura", paginaId],
    enabled: !!paginaId,
    queryFn: async (): Promise<PaginaCaptura> => {
      const { data, error } = await supabase
        .from("paginas_captura")
        .select(COLUNAS_PAGINA)
        .eq("id", paginaId as string)
        .single();
      if (error) throw error;
      return paraPagina(data as unknown as LinhaPagina);
    },
  });
}

export interface PaginaCapturaInput {
  slug: string;
  titulo: string;
  texto: string | null;
  imagemUrl: string | null;
  formularioId: string | null;
  whatsappNumero: string | null;
  whatsappMensagem: string | null;
}

function paraLinha(dados: PaginaCapturaInput) {
  return {
    slug: dados.slug,
    titulo: dados.titulo,
    texto: dados.texto,
    imagem_url: dados.imagemUrl,
    formulario_id: dados.formularioId,
    whatsapp_numero: dados.whatsappNumero,
    whatsapp_mensagem: dados.whatsappMensagem,
  };
}

export function useCriarPaginaCaptura(empresaId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dados: PaginaCapturaInput) => {
      if (!empresaId) throw new Error("Selecione uma empresa antes de criar uma página.");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("paginas_captura")
        .insert({ empresa_id: empresaId, ...paraLinha(dados), created_by: user?.id })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["paginas-captura", empresaId] }),
  });
}

export function useAtualizarPaginaCaptura(empresaId: string | null, paginaId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dados: PaginaCapturaInput) => {
      const { error } = await supabase
        .from("paginas_captura")
        .update(paraLinha(dados))
        .eq("id", paginaId);
      if (error) throw error;
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["paginas-captura", empresaId] }),
        queryClient.invalidateQueries({ queryKey: ["pagina-captura", paginaId] }),
      ]),
  });
}

export function useExcluirPaginaCaptura(empresaId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (paginaId: string) => {
      const { error } = await supabase
        .from("paginas_captura")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", paginaId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["paginas-captura", empresaId] }),
  });
}

/**
 * `empresas` só tem policy de UPDATE pra `dono` — `definir_slug_empresa`
 * é a única forma de um gestor configurar a URL pública da própria
 * empresa (correção 5 da migration de captura-leads).
 */
export function useDefinirSlugEmpresa(empresaId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (slug: string) => {
      if (!empresaId) throw new Error("Selecione uma empresa antes de configurar a URL pública.");
      const { error } = await supabase.rpc("definir_slug_empresa", {
        p_empresa_id: empresaId,
        p_slug: slug,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["empresas"] }),
  });
}
