import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Periodo } from "@/features/relatorios/logica/periodo";

interface Props {
  periodo: Periodo;
  onChange: (periodo: Periodo) => void;
}

/** Filtro de período (data início/fim) compartilhado pelas telas de relatório. */
export function FiltroPeriodo({ periodo, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="space-y-1">
        <Label htmlFor="relatorio-data-inicio" className="text-xs text-muted-foreground">
          De
        </Label>
        <Input
          id="relatorio-data-inicio"
          type="date"
          value={periodo.dataInicio}
          max={periodo.dataFim}
          onChange={(evento) => onChange({ ...periodo, dataInicio: evento.target.value })}
          className="w-40"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="relatorio-data-fim" className="text-xs text-muted-foreground">
          Até
        </Label>
        <Input
          id="relatorio-data-fim"
          type="date"
          value={periodo.dataFim}
          min={periodo.dataInicio}
          onChange={(evento) => onChange({ ...periodo, dataFim: evento.target.value })}
          className="w-40"
        />
      </div>
    </div>
  );
}
