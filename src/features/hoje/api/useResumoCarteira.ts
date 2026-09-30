import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { diferencaEmDias } from "@/lib/datas";

const DIAS_PARA_ESFRIAR = 90;

export interface ResumoCarteira {
  clientesAtivos: number;
  clientesInativos: number;
  novosClientesMes: number;
  clientesParaReativar: number;
  clientesSemTag: number;
  clientesSemNegocioAberto: number;
}

/**
 * Cards da carteira de clientes existente (pedido do usuário, sem item
 * de PRD próprio) — reaproveita colunas/tabelas que já existem, sem
 * migration nova: `contatos.status`/`ultimo_contato_em` (o limite de 90
 * dias é o mesmo padrão já citado no PRD §6.11 pro "termômetro de
 * relacionamento", que em si não está implementado), `contato_tags` e
 * `negocios.status`. "Sem tag"/"sem negócio aberto" exigem anti-join
 * (contato sem nenhuma linha relacionada) — o cliente do PostgREST não
 * expressa isso num único `count: exact`, então busca os ids dos dois
 * lados e calcula a diferença no cliente (base de contatos pequena o
 * bastante pra isso ser barato; mesmo espírito de `useVencimentosPorSemana`,
 * que já bucketiza no cliente).
 */
export function useResumoCarteira(empresaId: string | null, hoje: string) {
  return useQuery({
    queryKey: ["hoje-resumo-carteira", empresaId, hoje],
    enabled: !!empresaId,
    queryFn: async (): Promise<ResumoCarteira> => {
      const inicioMes = `${hoje.slice(0, 7)}-01`;

      const [ativos, inativos, novos, clientes, tags, negociosAbertos] = await Promise.all([
        supabase
          .from("contatos")
          .select("id", { count: "exact", head: true })
          .eq("empresa_id", empresaId as string)
          .eq("status", "cliente")
          .is("deleted_at", null),
        supabase
          .from("contatos")
          .select("id", { count: "exact", head: true })
          .eq("empresa_id", empresaId as string)
          .eq("status", "inativo")
          .is("deleted_at", null),
        supabase
          .from("contatos")
          .select("id", { count: "exact", head: true })
          .eq("empresa_id", empresaId as string)
          .eq("status", "cliente")
          .is("deleted_at", null)
          .gte("created_at", `${inicioMes}T00:00:00Z`),
        supabase
          .from("contatos")
          .select("id, ultimo_contato_em")
          .eq("empresa_id", empresaId as string)
          .eq("status", "cliente")
          .is("deleted_at", null),
        supabase
          .from("contato_tags")
          .select("contato_id")
          .eq("empresa_id", empresaId as string),
        supabase
          .from("negocios")
          .select("contato_id")
          .eq("empresa_id", empresaId as string)
          .eq("status", "aberto")
          .is("deleted_at", null),
      ]);

      const clientesComTag = new Set((tags.data ?? []).map((t) => t.contato_id));
      const clientesComNegocioAberto = new Set(
        (negociosAbertos.data ?? []).map((n) => n.contato_id),
      );

      const listaClientes = clientes.data ?? [];
      const clientesParaReativar = listaClientes.filter(
        (c) =>
          !c.ultimo_contato_em ||
          diferencaEmDias(c.ultimo_contato_em.slice(0, 10), hoje) > DIAS_PARA_ESFRIAR,
      ).length;
      const clientesSemTag = listaClientes.filter((c) => !clientesComTag.has(c.id)).length;
      const clientesSemNegocioAberto = listaClientes.filter(
        (c) => !clientesComNegocioAberto.has(c.id),
      ).length;

      return {
        clientesAtivos: ativos.count ?? 0,
        clientesInativos: inativos.count ?? 0,
        novosClientesMes: novos.count ?? 0,
        clientesParaReativar,
        clientesSemTag,
        clientesSemNegocioAberto,
      };
    },
  });
}
