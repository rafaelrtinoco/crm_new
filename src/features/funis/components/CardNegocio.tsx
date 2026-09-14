import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatarDataBR } from "@/lib/datas";
import { formatarBRL } from "@/lib/formatadores";
import type { Negocio } from "@/features/funis/api/useNegocios";

interface Props {
  negocio: Negocio;
  hoje: string;
  diasNaEtapa: number;
  corIndex: number;
}

/**
 * Identificação visual por fase — puramente decorativa, não carrega
 * significado de ação/estado (por isso não usa `primary`/`accent`).
 * Cicla pela posição da etapa no funil, já que etapas são dinâmicas
 * por empresa (vêm do template do nicho).
 */
const CORES_ETAPA = [
  "border-l-violet-500 bg-violet-50 dark:border-l-violet-400 dark:bg-violet-950/30",
  "border-l-pink-500 bg-pink-50 dark:border-l-pink-400 dark:bg-pink-950/30",
  "border-l-amber-500 bg-amber-50 dark:border-l-amber-400 dark:bg-amber-950/30",
  "border-l-emerald-500 bg-emerald-50 dark:border-l-emerald-400 dark:bg-emerald-950/30",
  "border-l-cyan-500 bg-cyan-50 dark:border-l-cyan-400 dark:bg-cyan-950/30",
  "border-l-fuchsia-500 bg-fuchsia-50 dark:border-l-fuchsia-400 dark:bg-fuchsia-950/30",
];

/** Card arrastável do quadro (PRD §6.5) — cor por fase, dias parado na etapa e destaque de urgência. */
export function CardNegocio({ negocio, hoje, diasNaEtapa, corIndex }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: negocio.id,
  });
  const vencido = negocio.proximoPassoEm < hoje;
  const corEtapa = CORES_ETAPA[corIndex % CORES_ETAPA.length];

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      {...listeners}
      {...attributes}
      className={cn(
        "space-y-2 rounded-md border border-l-4 p-3 text-sm",
        corEtapa,
        vencido ? "border-urgencia" : "border-border",
        isDragging && "opacity-50",
      )}
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
