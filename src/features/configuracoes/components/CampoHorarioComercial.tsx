import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  DiaHorario,
  FormularioHorarioComercial,
} from "@/features/configuracoes/logica/horarioComercial";

interface LinhaDiaProps {
  rotulo: string;
  idPrefixo: string;
  dia: DiaHorario;
  onChange: (dia: DiaHorario) => void;
  erroInicio?: string;
  erroFim?: string;
}

function LinhaDia({ rotulo, idPrefixo, dia, onChange, erroInicio, erroFim }: LinhaDiaProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 py-2">
      <span className="w-20 shrink-0 text-sm font-medium">{rotulo}</span>
      <div className="flex items-center gap-2">
        <Checkbox
          id={`${idPrefixo}-fechado`}
          checked={dia.fechado}
          onCheckedChange={(marcado) => onChange({ ...dia, fechado: marcado === true })}
        />
        <Label htmlFor={`${idPrefixo}-fechado`} className="font-normal text-muted-foreground">
          Fechado
        </Label>
      </div>
      {!dia.fechado && (
        <div className="flex items-center gap-2">
          <div className="space-y-1">
            <Input
              type="time"
              className="w-32"
              value={dia.inicio}
              onChange={(e) => onChange({ ...dia, inicio: e.target.value })}
              aria-label={`${rotulo} — início`}
            />
            {erroInicio && <p className="text-xs text-destructive">{erroInicio}</p>}
          </div>
          <span className="text-muted-foreground">até</span>
          <div className="space-y-1">
            <Input
              type="time"
              className="w-32"
              value={dia.fim}
              onChange={(e) => onChange({ ...dia, fim: e.target.value })}
              aria-label={`${rotulo} — fim`}
            />
            {erroFim && <p className="text-xs text-destructive">{erroFim}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

interface ErrosHorario {
  segSex?: { inicio?: string; fim?: string };
  sab?: { inicio?: string; fim?: string };
  dom?: { inicio?: string; fim?: string };
}

interface CampoHorarioComercialProps {
  value: FormularioHorarioComercial;
  onChange: (value: FormularioHorarioComercial) => void;
  erros?: ErrosHorario;
}

/** Horário comercial por dia — usado pra decidir quando a fila de envios reagenda uma mensagem em vez de mandar na hora. */
export function CampoHorarioComercial({ value, onChange, erros }: CampoHorarioComercialProps) {
  return (
    <div className="divide-y">
      <LinhaDia
        rotulo="Seg a sex"
        idPrefixo="horario-seg-sex"
        dia={value.segSex}
        onChange={(dia) => onChange({ ...value, segSex: dia })}
        erroInicio={erros?.segSex?.inicio}
        erroFim={erros?.segSex?.fim}
      />
      <LinhaDia
        rotulo="Sábado"
        idPrefixo="horario-sab"
        dia={value.sab}
        onChange={(dia) => onChange({ ...value, sab: dia })}
        erroInicio={erros?.sab?.inicio}
        erroFim={erros?.sab?.fim}
      />
      <LinhaDia
        rotulo="Domingo"
        idPrefixo="horario-dom"
        dia={value.dom}
        onChange={(dia) => onChange({ ...value, dom: dia })}
        erroInicio={erros?.dom?.inicio}
        erroFim={erros?.dom?.fim}
      />
    </div>
  );
}
