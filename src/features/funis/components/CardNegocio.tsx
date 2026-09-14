import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { formatarDataBR } from "@/lib/datas";
import { formatarBRL } from "@/lib/formatadores";
import type { Negocio } from "@/features/funis/api/useNegocios";

interface Props {
  negocio: Negocio;
  hoje: string;
  diasNaEtapa: number;
}

/** Card arrastável do quadro (PRD §6.5) — dias parado na etapa e destaque de urgência. */
export function CardNegocio({ negocio, hoje, diasNaEtapa }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: negocio.id,
  });
  const vencido = negocio.proximoPassoEm < hoje;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      {...listeners}
      {...attributes}
      className={`space-y-2 rounded-md border bg-card p-3 text-sm shadow-sm ${
        isDragging ? "opacity-50" : ""
      } ${vencido ? "border-urgencia" : "border-border"}`}
    >
      <Link
        to={`/funis/negocios/${negocio.id}`}
        onClick={(e) => e.stopPropagation()}
        className="font-medium hover:underline"
      >
        {negocio.contatoNome}
      </Link>
      {negocio.valorEstimado != null && (
        <p className="text-muted-foreground">{formatarBRL(negocio.valorEstimado)}</p>
      )}
      <div
        className={`flex items-center justify-between rounded px-1.5 py-1 text-xs ${
          vencido ? "bg-urgencia/15 text-urgencia" : "text-muted-foreground"
        }`}
      >
        <span>{negocio.proximoPassoAcao}</span>
        <span>{formatarDataBR(negocio.proximoPassoEm)}</span>
      </div>
      <Badge variant="outline" className="text-[11px] font-normal">
        {diasNaEtapa === 0 ? "Entrou hoje" : `${diasNaEtapa}d na etapa`}
      </Badge>
    </div>
  );
}
