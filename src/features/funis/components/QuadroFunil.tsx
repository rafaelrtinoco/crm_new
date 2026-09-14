import { DndContext, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import { diferencaEmDias } from "@/lib/datas";
import { CardNegocio } from "@/features/funis/components/CardNegocio";
import type { Etapa } from "@/features/funis/api/useFunis";
import type { Negocio } from "@/features/funis/api/useNegocios";

interface ColunaProps {
  etapa: Etapa;
  negocios: Negocio[];
  hoje: string;
  corIndex: number;
}

function Coluna({ etapa, negocios, hoje, corIndex }: ColunaProps) {
  const { setNodeRef, isOver } = useDroppable({ id: etapa.id });

  return (
    <div
      ref={setNodeRef}
      className={`flex w-72 shrink-0 flex-col rounded-lg border border-border bg-muted/60 ${
        isOver ? "ring-2 ring-primary" : ""
      }`}
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <p className="text-sm font-medium">{etapa.nome}</p>
        <span className="text-xs text-muted-foreground">{negocios.length}</span>
      </div>
      <div className="flex-1 space-y-2 p-2">
        {negocios.map((negocio) => (
          <CardNegocio
            key={negocio.id}
            negocio={negocio}
            hoje={hoje}
            corIndex={corIndex}
            diasNaEtapa={Math.max(0, diferencaEmDias(negocio.entrouNaEtapaEm.slice(0, 10), hoje))}
          />
        ))}
        {negocios.length === 0 && (
          <p className="px-1 py-2 text-xs text-muted-foreground">Nenhum negócio aqui.</p>
        )}
      </div>
    </div>
  );
}

interface Props {
  etapas: Etapa[];
  negocios: Negocio[];
  hoje: string;
  onSoltar: (negocioId: string, novaEtapaId: string) => void;
}

/** Quadro kanban (PRD §6.5) — arrastar entre etapas exige confirmar o próximo passo. */
export function QuadroFunil({ etapas, negocios, hoje, onSoltar }: Props) {
  function aoSoltar(evento: DragEndEvent) {
    const { active, over } = evento;
    if (!over) return;
    const negocio = negocios.find((n) => n.id === active.id);
    if (!negocio || negocio.etapaId === over.id) return;
    onSoltar(String(active.id), String(over.id));
  }

  return (
    <DndContext onDragEnd={aoSoltar}>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {etapas.map((etapa, indice) => (
          <Coluna
            key={etapa.id}
            etapa={etapa}
            negocios={negocios.filter((n) => n.etapaId === etapa.id)}
            hoje={hoje}
            corIndex={indice}
          />
        ))}
      </div>
    </DndContext>
  );
}
