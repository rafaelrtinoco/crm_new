/** Formatadores e validadores de padrões Brasil (PRD §4). */

export function formatarBRL(valor: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
}

function apenasDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

export function formatarTelefone(valor: string): string {
  const digitos = apenasDigitos(valor).slice(0, 11);
  if (digitos.length <= 10) {
    return digitos.replace(/^(\d{0,2})(\d{0,4})(\d{0,4})$/, (_, ddd, p1, p2) =>
      [ddd && `(${ddd}`, ddd.length === 2 && ") ", p1, p2 && `-${p2}`].filter(Boolean).join(""),
    );
  }
  return digitos.replace(/^(\d{0,2})(\d{0,5})(\d{0,4})$/, (_, ddd, p1, p2) =>
    [ddd && `(${ddd}`, ddd.length === 2 && ") ", p1, p2 && `-${p2}`].filter(Boolean).join(""),
  );
}

export function formatarCEP(valor: string): string {
  return apenasDigitos(valor)
    .slice(0, 8)
    .replace(/^(\d{5})(\d{0,3})$/, (_, p1, p2) => (p2 ? `${p1}-${p2}` : p1));
}

export function formatarCPF(valor: string): string {
  return apenasDigitos(valor)
    .slice(0, 11)
    .replace(/^(\d{0,3})(\d{0,3})(\d{0,3})(\d{0,2})$/, (_, p1, p2, p3, p4) =>
      [p1, p2 && `.${p2}`, p3 && `.${p3}`, p4 && `-${p4}`].filter(Boolean).join(""),
    );
}

export function formatarCNPJ(valor: string): string {
  return apenasDigitos(valor)
    .slice(0, 14)
    .replace(/^(\d{0,2})(\d{0,3})(\d{0,3})(\d{0,4})(\d{0,2})$/, (_, p1, p2, p3, p4, p5) =>
      [p1, p2 && `.${p2}`, p3 && `.${p3}`, p4 && `/${p4}`, p5 && `-${p5}`].filter(Boolean).join(""),
    );
}

/** Formata CPF (11 dígitos) ou CNPJ (14 dígitos) conforme o tamanho do valor. */
export function formatarCpfCnpj(valor: string): string {
  const digitos = apenasDigitos(valor);
  return digitos.length > 11 ? formatarCNPJ(valor) : formatarCPF(valor);
}

/** Calcula um dígito verificador módulo 11 a partir dos dígitos e pesos dados (mesma ordem). */
function digitoVerificador(digitos: string, pesos: number[]): number {
  const soma = pesos.reduce((acc, peso, idx) => acc + Number(digitos[idx]) * peso, 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function validarCPF(valor: string): boolean {
  const digitos = apenasDigitos(valor);
  if (digitos.length !== 11 || /^(\d)\1{10}$/.test(digitos)) return false;

  const dv1 = digitoVerificador(digitos, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const dv2 = digitoVerificador(digitos, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return Number(digitos[9]) === dv1 && Number(digitos[10]) === dv2;
}

export function validarCNPJ(valor: string): boolean {
  const digitos = apenasDigitos(valor);
  if (digitos.length !== 14 || /^(\d)\1{13}$/.test(digitos)) return false;

  const dv1 = digitoVerificador(digitos, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const dv2 = digitoVerificador(digitos, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return Number(digitos[12]) === dv1 && Number(digitos[13]) === dv2;
}
