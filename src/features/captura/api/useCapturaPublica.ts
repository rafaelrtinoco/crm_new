import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface FormularioPublico {
  nome: string;
  campos: string[];
}

/** Lido sem sessão (visitante anônimo) — `obter_formulario_publico` é `security definer`. */
export function useFormularioPublico(formularioId: string | null) {
  return useQuery({
    queryKey: ["formulario-publico", formularioId],
    enabled: !!formularioId,
    queryFn: async (): Promise<FormularioPublico> => {
      const { data, error } = await supabase.rpc("obter_formulario_publico", {
        p_formulario_id: formularioId as string,
      });
      if (error) throw error;
      const linha = data?.[0];
      if (!linha) throw new Error("Formulário não encontrado ou inativo.");
      return { nome: linha.nome, campos: (linha.campos as string[]) ?? [] };
    },
  });
}

export interface PaginaCapturaPublica {
  formularioId: string | null;
  titulo: string;
  texto: string | null;
  imagemUrl: string | null;
  whatsappNumero: string | null;
  whatsappMensagem: string | null;
  empresaNome: string;
  empresaLogoUrl: string | null;
  empresaCorPrimaria: string | null;
}

/** Lido sem sessão — `obter_pagina_captura_publica` é `security definer`. */
export function usePaginaCapturaPublica(empresaSlug: string | null, paginaSlug: string | null) {
  return useQuery({
    queryKey: ["pagina-captura-publica", empresaSlug, paginaSlug],
    enabled: !!empresaSlug && !!paginaSlug,
    queryFn: async (): Promise<PaginaCapturaPublica> => {
      const { data, error } = await supabase.rpc("obter_pagina_captura_publica", {
        p_empresa_slug: empresaSlug as string,
        p_pagina_slug: paginaSlug as string,
      });
      if (error) throw error;
      const linha = data?.[0];
      if (!linha) throw new Error("Página não encontrada.");
      return {
        formularioId: linha.formulario_id,
        titulo: linha.titulo,
        texto: linha.texto,
        imagemUrl: linha.imagem_url,
        whatsappNumero: linha.whatsapp_numero,
        whatsappMensagem: linha.whatsapp_mensagem,
        empresaNome: linha.empresa_nome,
        empresaLogoUrl: linha.empresa_logo_url,
        empresaCorPrimaria: linha.empresa_cor_primaria,
      };
    },
  });
}

/** Extrai utm_* da URL atual — usado nos dois pontos de entrada públicos. */
export function lerUtmDaUrl(): Record<string, string> {
  const params = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  for (const chave of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) {
    const valor = params.get(chave);
    if (valor) utm[chave] = valor;
  }
  return utm;
}

/** `submeter_formulario` é `security definer`, chamada sem sessão — cliente anônimo comum. */
export function useSubmeterFormularioPublico(formularioId: string | null) {
  return useMutation({
    mutationFn: async (dados: Record<string, string>) => {
      if (!formularioId) throw new Error("Formulário inválido.");
      const { error } = await supabase.rpc("submeter_formulario", {
        p_formulario_id: formularioId,
        p_dados: dados,
        p_utm: lerUtmDaUrl(),
      });
      if (error) throw error;
    },
  });
}
