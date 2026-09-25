import type { Json } from "@/types/database";

/** Um dia da semana: fechado, ou aberto numa janela "HH:MM" – "HH:MM". */
export interface DiaHorario {
  fechado: boolean;
  inicio: string;
  fim: string;
}

/** Estado de formulário — espelha as três chaves de `empresas.horario_comercial`. */
export interface FormularioHorarioComercial {
  segSex: DiaHorario;
  sab: DiaHorario;
  dom: DiaHorario;
}

const PADRAO_FECHADO: DiaHorario = { fechado: true, inicio: "08:00", fim: "18:00" };

const REGEX_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

function diaDoJson(valor: unknown): DiaHorario {
  if (valor === null || valor === undefined) return { ...PADRAO_FECHADO };
  if (Array.isArray(valor) && valor.length === 2) {
    const [inicio, fim] = valor;
    if (typeof inicio === "string" && typeof fim === "string") {
      return { fechado: false, inicio, fim };
    }
  }
  return { ...PADRAO_FECHADO };
}

/** `empresas.horario_comercial` (jsonb) → estado de formulário. */
export function horarioComercialParaFormulario(json: Json): FormularioHorarioComercial {
  const valor = (json ?? {}) as Record<string, unknown>;
  return {
    segSex: diaDoJson(valor.seg_sex),
    sab: diaDoJson(valor.sab),
    dom: diaDoJson(valor.dom),
  };
}

/** Estado de formulário → `empresas.horario_comercial` (jsonb) — mesma forma que o trigger valida. */
export function formularioParaHorarioComercial(form: FormularioHorarioComercial): Json {
  const paraJson = (dia: DiaHorario): Json => (dia.fechado ? null : [dia.inicio, dia.fim]);
  return {
    seg_sex: paraJson(form.segSex),
    sab: paraJson(form.sab),
    dom: paraJson(form.dom),
  } as unknown as Json;
}

/** "HH:MM" válido segundo o mesmo formato que o trigger `janela_horario_valida` exige. */
export function horaValida(valor: string): boolean {
  return REGEX_HORA.test(valor);
}

/** Um dia aberto precisa de início e fim válidos, com início < fim (comparação de string funciona porque o formato é sempre "HH:MM" com zero à esquerda). */
export function diaHorarioValido(dia: DiaHorario): boolean {
  if (dia.fechado) return true;
  return horaValida(dia.inicio) && horaValida(dia.fim) && dia.inicio < dia.fim;
}
