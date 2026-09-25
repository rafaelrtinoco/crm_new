/**
 * Fusos horários oficiais do Brasil (produto é só PT-BR, mesmo raciocínio
 * de `docs/design-system.md` sobre só carregar os subsets latin/latin-ext
 * de fonte). O trigger `validar_empresa_antes_de_salvar` aceita qualquer
 * fuso de `pg_timezone_names` — esta lista é só a curadoria do seletor,
 * não uma restrição de banco.
 */
export const FUSOS_BRASIL = [
  { valor: "America/Noronha", rotulo: "Fernando de Noronha (UTC-2)" },
  { valor: "America/Sao_Paulo", rotulo: "Brasília, São Paulo, Rio de Janeiro (UTC-3)" },
  { valor: "America/Bahia", rotulo: "Salvador (UTC-3)" },
  { valor: "America/Fortaleza", rotulo: "Fortaleza (UTC-3)" },
  { valor: "America/Recife", rotulo: "Recife (UTC-3)" },
  { valor: "America/Maceio", rotulo: "Maceió (UTC-3)" },
  { valor: "America/Belem", rotulo: "Belém (UTC-3)" },
  { valor: "America/Araguaina", rotulo: "Araguaína (UTC-3)" },
  { valor: "America/Campo_Grande", rotulo: "Campo Grande (UTC-4)" },
  { valor: "America/Cuiaba", rotulo: "Cuiabá (UTC-4)" },
  { valor: "America/Santarem", rotulo: "Santarém (UTC-3)" },
  { valor: "America/Porto_Velho", rotulo: "Porto Velho (UTC-4)" },
  { valor: "America/Boa_Vista", rotulo: "Boa Vista (UTC-4)" },
  { valor: "America/Manaus", rotulo: "Manaus (UTC-4)" },
  { valor: "America/Rio_Branco", rotulo: "Rio Branco (UTC-5)" },
] as const;
