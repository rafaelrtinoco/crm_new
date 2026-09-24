import { hojeNoFuso } from "@/lib/datas";

export interface Periodo {
  /** "YYYY-MM-DD" */
  dataInicio: string;
  /** "YYYY-MM-DD" */
  dataFim: string;
}

/** Período padrão dos relatórios ao abrir a tela: últimos 30 dias, no fuso da empresa. */
export function periodoPadrao(fuso: string): Periodo {
  const dataFim = hojeNoFuso(fuso);
  const [ano, mes, dia] = dataFim.split("-").map(Number) as [number, number, number];
  const dataInicio = new Date(Date.UTC(ano, mes - 1, dia - 29)).toISOString().slice(0, 10);
  return { dataInicio, dataFim };
}
