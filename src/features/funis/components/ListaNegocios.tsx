import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatarDataBR } from "@/lib/datas";
import { formatarBRL } from "@/lib/formatadores";
import type { Etapa } from "@/features/funis/api/useFunis";
import type { Negocio } from "@/features/funis/api/useNegocios";

interface Props {
  negocios: Negocio[];
  etapas: Etapa[];
  hoje: string;
}

/** Visão em lista dos negócios (PRD §6.5) — padrão no mobile, alternativa no desktop. */
export function ListaNegocios({ negocios, etapas, hoje }: Props) {
  const nomeEtapa = new Map(etapas.map((e) => [e.id, e.nome]));

  if (negocios.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum negócio neste funil.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Contato</TableHead>
          <TableHead>Etapa</TableHead>
          <TableHead>Valor</TableHead>
          <TableHead>Próximo passo</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {negocios.map((negocio) => {
          const vencido = negocio.proximoPassoEm < hoje;
          return (
            <TableRow key={negocio.id}>
              <TableCell>
                <Link to={`/funis/negocios/${negocio.id}`} className="font-medium hover:underline">
                  {negocio.contatoNome}
                </Link>
              </TableCell>
              <TableCell>
                <Badge variant="secondary">{nomeEtapa.get(negocio.etapaId) ?? "—"}</Badge>
              </TableCell>
              <TableCell>
                {negocio.valorEstimado != null ? formatarBRL(negocio.valorEstimado) : "—"}
              </TableCell>
              <TableCell className={vencido ? "text-urgencia" : undefined}>
                {negocio.proximoPassoAcao} — {formatarDataBR(negocio.proximoPassoEm)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
