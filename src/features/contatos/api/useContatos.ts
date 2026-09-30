import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface Contato {
  id: string;
  nome: string;
  status: string;
  temperatura: string | null;
  telefone: string | null;
  email: string | null;
  responsavelId: string | null;
  ultimoContatoEm: string | null;
}

export interface FiltrosContatos {
  busca?: string;
  status?: string;
  temperatura?: string;
  responsavelId?: string;
  tagId?: string;
  /** Criado a partir desta data ("YYYY-MM-DD") — cards da tela "Hoje" ("Novos clientes"). */
  criadoDesde?: string;
  /** Sem contato registrado, ou registrado antes desta data — card "Clientes p/ reativar". */
  semContatoDesde?: string;
  /** Sem nenhuma tag — card "Clientes sem tag". */
  semTag?: boolean;
  /** Sem nenhum negócio com status "aberto" — card "Sem negócio aberto". */
  semNegocioAberto?: boolean;
}

/** Lista de contatos da empresa atual, com os filtros do PRD §6.3. */
export function useContatos(empresaId: string | null, filtros: FiltrosContatos = {}) {
  return useQuery({
    queryKey: ["contatos", empresaId, filtros],
    enabled: !!empresaId,
    queryFn: async (): Promise<Contato[]> => {
      // Filtro por tag em duas etapas: o supabase-js não tipa bem um
      // `select` condicional (embed só quando há filtro de tag), então
      // resolve os ids do lado de cá em vez de montar a string dinâmica.
      let idsComTag: string[] | null = null;
      if (filtros.tagId) {
        const { data: vinculos, error: erroTags } = await supabase
          .from("contato_tags")
          .select("contato_id")
          .eq("tag_id", filtros.tagId);
        if (erroTags) throw erroTags;
        idsComTag = (vinculos ?? []).map((v) => v.contato_id);
        if (idsComTag.length === 0) return [];
      }

      // "Sem tag"/"sem negócio aberto" são o oposto de um `in` — mesma
      // resolução em duas etapas do filtro de tag acima (anti-join que
      // o supabase-js não expressa num único `select`), só que
      // excluindo os ids em vez de incluir.
      let idsSemTag: string[] | null = null;
      if (filtros.semTag) {
        const { data: vinculos, error: erroSemTag } = await supabase
          .from("contato_tags")
          .select("contato_id")
          .eq("empresa_id", empresaId as string);
        if (erroSemTag) throw erroSemTag;
        idsSemTag = [...new Set((vinculos ?? []).map((v) => v.contato_id))];
      }

      let idsComNegocioAberto: string[] | null = null;
      if (filtros.semNegocioAberto) {
        const { data: negocios, error: erroNegocios } = await supabase
          .from("negocios")
          .select("contato_id")
          .eq("empresa_id", empresaId as string)
          .eq("status", "aberto")
          .is("deleted_at", null);
        if (erroNegocios) throw erroNegocios;
        idsComNegocioAberto = [...new Set((negocios ?? []).map((n) => n.contato_id))];
      }

      let query = supabase
        .from("contatos")
        .select("id, nome, status, temperatura, telefone, email, responsavel_id, ultimo_contato_em")
        .eq("empresa_id", empresaId as string)
        .is("deleted_at", null)
        .order("nome", { ascending: true });

      if (filtros.status) query = query.eq("status", filtros.status);
      if (filtros.temperatura) query = query.eq("temperatura", filtros.temperatura);
      if (filtros.responsavelId) query = query.eq("responsavel_id", filtros.responsavelId);
      if (idsComTag) query = query.in("id", idsComTag);
      if (filtros.criadoDesde) query = query.gte("created_at", `${filtros.criadoDesde}T00:00:00Z`);
      if (filtros.semContatoDesde) {
        query = query.or(
          `ultimo_contato_em.is.null,ultimo_contato_em.lt.${filtros.semContatoDesde}T00:00:00Z`,
        );
      }
      if (idsSemTag && idsSemTag.length > 0)
        query = query.not("id", "in", `(${idsSemTag.join(",")})`);
      if (idsComNegocioAberto && idsComNegocioAberto.length > 0) {
        query = query.not("id", "in", `(${idsComNegocioAberto.join(",")})`);
      }
      if (filtros.busca) {
        const termo = `%${filtros.busca}%`;
        query = query.or(
          `nome.ilike.${termo},telefone.ilike.${termo},email.ilike.${termo},cpf_cnpj.ilike.${termo}`,
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map((c) => ({
        id: c.id,
        nome: c.nome,
        status: c.status,
        temperatura: c.temperatura,
        telefone: c.telefone,
        email: c.email,
        responsavelId: c.responsavel_id,
        ultimoContatoEm: c.ultimo_contato_em,
      }));
    },
  });
}

export interface ContatoCompleto extends Contato {
  cpfCnpj: string | null;
  nascimento: string | null;
  origem: string | null;
  endereco: Record<string, unknown> | null;
  campos: Record<string, unknown>;
}

export function useContato(contatoId: string | null) {
  return useQuery({
    queryKey: ["contato", contatoId],
    enabled: !!contatoId,
    queryFn: async (): Promise<ContatoCompleto | null> => {
      const { data, error } = await supabase
        .from("contatos")
        .select(
          "id, nome, status, temperatura, telefone, email, cpf_cnpj, nascimento, origem, endereco, campos, responsavel_id, ultimo_contato_em",
        )
        .eq("id", contatoId as string)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        id: data.id,
        nome: data.nome,
        status: data.status,
        temperatura: data.temperatura,
        telefone: data.telefone,
        email: data.email,
        cpfCnpj: data.cpf_cnpj,
        nascimento: data.nascimento,
        origem: data.origem,
        endereco: (data.endereco ?? null) as Record<string, unknown> | null,
        campos: (data.campos ?? {}) as Record<string, unknown>,
        responsavelId: data.responsavel_id,
        ultimoContatoEm: data.ultimo_contato_em,
      };
    },
  });
}
