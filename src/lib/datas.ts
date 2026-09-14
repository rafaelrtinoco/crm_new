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
