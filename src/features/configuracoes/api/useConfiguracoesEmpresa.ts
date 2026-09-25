import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Json } from "@/types/database";

export interface ConfiguracoesEmpresa {
  id: string;
  nome: string;
  fuso: string;
  horarioComercial: Json;
  logoUrl: string | null;
  corPrimaria: string | null;
  carteiraCompartilhada: boolean;
}

const COLUNAS = "id, nome, fuso, horario_comercial, logo_url, cor_primaria, carteira_compartilhada";

interface LinhaEmpresa {
  id: string;
  nome: string;
  fuso: string;
  horario_comercial: Json;
  logo_url: string | null;
  cor_primaria: string | null;
  carteira_compartilhada: boolean;
}

function paraConfiguracoes(linha: LinhaEmpresa): ConfiguracoesEmpresa {
  return {
    id: linha.id,
    nome: linha.nome,
    fuso: linha.fuso,
    horarioComercial: linha.horario_comercial,
    logoUrl: linha.logo_url,
    corPrimaria: linha.cor_primaria,
    carteiraCompartilhada: linha.carteira_compartilhada,
  };
}

/** Dados completos da empresa pra tela de Configurações — `useEmpresas()` só traz o essencial pro seletor/topbar. */
export function useConfiguracoesEmpresa(empresaId: string | null) {
  return useQuery({
    queryKey: ["empresa-configuracoes", empresaId],
    enabled: !!empresaId,
    queryFn: async (): Promise<ConfiguracoesEmpresa> => {
      const { data, error } = await supabase
        .from("empresas")
        .select(COLUNAS)
        .eq("id", empresaId as string)
        .single();
      if (error) throw error;
      return paraConfiguracoes(data);
    },
  });
}

export interface AtualizarConfiguracoesInput {
  nome: string;
  fuso: string;
  horarioComercial: Json;
  logoUrl: string | null;
  corPrimaria: string | null;
}

/**
 * `atualizar_configuracoes_empresa` — só gestor+ (checado no banco).
 * Invalida `["empresas", ...]` também: é a query que alimenta o
 * seletor de empresa/topbar/relógio (`useEmpresas()`), que ficaria com
 * nome/fuso desatualizados sem isso.
 */
export function useAtualizarConfiguracoesEmpresa(empresaId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dados: AtualizarConfiguracoesInput) => {
      if (!empresaId) throw new Error("Selecione uma empresa antes de salvar.");
      const { error } = await supabase.rpc("atualizar_configuracoes_empresa", {
        p_empresa_id: empresaId,
        p_nome: dados.nome,
        p_fuso: dados.fuso,
        p_horario_comercial: dados.horarioComercial,
        // A RPC aceita null (colunas são nullable) — o gerador de tipos
        // não marca parâmetro de função plpgsql como nullable, só o tipo
        // base da coluna.
        p_logo_url: dados.logoUrl as string,
        p_cor_primaria: dados.corPrimaria as string,
      });
      if (error) throw error;
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["empresa-configuracoes", empresaId] }),
        queryClient.invalidateQueries({ queryKey: ["empresas"] }),
      ]),
  });
}

/**
 * Carteira compartilhada muda quem lê contato de quem
 * (`pode_acessar_responsavel`) — fica fora da RPC de configurações de
 * propósito, só o dono grava (policy nativa `empresas_update_dono`).
 */
export function useAlternarCarteiraCompartilhada(empresaId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (valor: boolean) => {
      if (!empresaId) throw new Error("Selecione uma empresa antes de salvar.");
      const { error } = await supabase
        .from("empresas")
        .update({ carteira_compartilhada: valor })
        .eq("id", empresaId);
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["empresa-configuracoes", empresaId] }),
  });
}

const TAMANHO_MAXIMO_LOGO = 2 * 1024 * 1024;
const TIPOS_ACEITOS = ["image/png", "image/jpeg", "image/webp"];

/**
 * Upload pro bucket `logos` (público — a página de captura é anônima).
 * Só retorna a URL pública; quem grava em `empresas.logo_url` é
 * `useAtualizarConfiguracoesEmpresa`, no submit do formulário.
 */
export function useUploadLogo(empresaId: string | null) {
  return useMutation({
    mutationFn: async (arquivo: File): Promise<string> => {
      if (!empresaId) throw new Error("Selecione uma empresa antes de enviar o logo.");
      if (!TIPOS_ACEITOS.includes(arquivo.type)) {
        throw new Error("Envie uma imagem PNG, JPEG ou WebP.");
      }
      if (arquivo.size > TAMANHO_MAXIMO_LOGO) {
        throw new Error("O logo precisa ter até 2 MB.");
      }

      const extensao = arquivo.name.split(".").pop() ?? "png";
      const caminho = `${empresaId}/logo-${Date.now()}.${extensao}`;

      const { error: erroUpload } = await supabase.storage
        .from("logos")
        .upload(caminho, arquivo, { upsert: true, contentType: arquivo.type });
      if (erroUpload) throw erroUpload;

      const {
        data: { publicUrl },
      } = supabase.storage.from("logos").getPublicUrl(caminho);
      return publicUrl;
    },
  });
}
