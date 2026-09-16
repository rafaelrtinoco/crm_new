/**
 * Datas de calendário (vencimento, aniversário) trafegam como `date` (string
 * "YYYY-MM-DD"), nunca como `Date` do navegador. "Hoje" e a régua são sempre
 * calculados no fuso da empresa — nunca no do servidor ou do navegador do usuário.
 */

/** Retorna a data de hoje ("YYYY-MM-DD") no fuso informado. */
export function hojeNoFuso(fuso: string): string {
  const formatador = new Intl.DateTimeFormat("en-CA", {
    timeZone: fuso,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatador.format(new Date());
}

/** Formata uma data de calendário ("YYYY-MM-DD") como dd/mm/aaaa. */
export function formatarDataBR(data: string): string {
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

/** Converte dd/mm/aaaa para "YYYY-MM-DD". Lança erro se o formato for inválido. */
export function paraDataISO(dataBR: string): string {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dataBR);
  if (!match || !match[1] || !match[2] || !match[3]) {
    throw new Error(`Data inválida: "${dataBR}". Formato esperado: dd/mm/aaaa.`);
  }
  const [, dia, mes, ano] = match;
  return `${ano}-${mes}-${dia}`;
}

/**
 * Soma meses ou anos a uma data de calendário ("YYYY-MM-DD"). Usada pra
 * sugerir a próxima data de vencimento numa renovação (PRD §6.4) —
 * mantém o dia quando possível, ou usa o último dia do mês (ex.: 31/jan
 * + 1 mês vira 28/29 fev, não 3/mar).
 */
export function somarPeriodo(data: string, unidade: "mes" | "ano", quantidade: number): string {
  const [ano, mes, dia] = data.split("-").map(Number) as [number, number, number];
  const mesesParaSomar = unidade === "ano" ? quantidade * 12 : quantidade;
  const dataUTC = new Date(Date.UTC(ano, mes - 1 + mesesParaSomar, dia));
  return dataUTC.toISOString().slice(0, 10);
}

/** Diferença em dias inteiros entre duas datas de calendário ("YYYY-MM-DD"). */
export function diferencaEmDias(dataA: string, dataB: string): number {
  const msPorDia = 24 * 60 * 60 * 1000;
  const paraUTC = (data: string) => {
    const [ano, mes, dia] = data.split("-").map(Number) as [number, number, number];
    return Date.UTC(ano, mes - 1, dia);
  };
  return Math.round((paraUTC(dataB) - paraUTC(dataA)) / msPorDia);
}

/**
 * Data por extenso + hora, no fuso informado — nunca no fuso do
 * navegador (mesma regra de `hojeNoFuso`). `data` representa um
 * instante absoluto; é a opção `timeZone` do `Intl.DateTimeFormat` que
 * faz a conversão na hora de formatar, sem precisar "deslocar" o objeto
 * `Date`. Usado no relógio da topbar (`AppShell.tsx`).
 */
export function formatarDataHoraFuso(data: Date, fuso: string): string {
  const dataFmt = new Intl.DateTimeFormat("pt-BR", {
    timeZone: fuso,
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(data);
  const horaFmt = new Intl.DateTimeFormat("pt-BR", {
    timeZone: fuso,
    hour: "2-digit",
    minute: "2-digit",
  }).format(data);
  return `${dataFmt} • ${horaFmt}`;
}

export interface DiaCalendario {
  /** "YYYY-MM-DD" */
  data: string;
  /** false pros dias do mês anterior/seguinte que completam a semana. */
  noMes: boolean;
}

/**
 * Grade de semanas (domingo–sábado) do mês pedido, incluindo dias do mês
 * anterior/seguinte pra completar a primeira e a última semana — sempre
 * um múltiplo de 7. Matemática pura em UTC (não usa o relógio nem o
 * fuso do navegador — a grade em si é só aritmética de calendário,
 * indiferente a fuso; quem decide "qual mês" é o chamador, via
 * `hojeNoFuso`).
 */
export function gradeCalendario(ano: number, mes: number): DiaCalendario[] {
  const paraISO = (d: Date) => d.toISOString().slice(0, 10);

  const primeiroDia = new Date(Date.UTC(ano, mes, 1));
  const diaSemanaInicio = primeiroDia.getUTCDay();
  const ultimoDiaMes = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();

  const grade: DiaCalendario[] = [];

  for (let i = diaSemanaInicio; i > 0; i--) {
    grade.push({ data: paraISO(new Date(Date.UTC(ano, mes, 1 - i))), noMes: false });
  }
  for (let dia = 1; dia <= ultimoDiaMes; dia++) {
    grade.push({ data: paraISO(new Date(Date.UTC(ano, mes, dia))), noMes: true });
  }
  let diaExtra = 1;
  while (grade.length % 7 !== 0) {
    grade.push({ data: paraISO(new Date(Date.UTC(ano, mes + 1, diaExtra))), noMes: false });
    diaExtra += 1;
  }

  return grade;
}
