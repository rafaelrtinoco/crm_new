const CABECALHOS = [
  "Nome",
  "Telefone",
  "Email",
  "CPF/CNPJ",
  "Data de nascimento",
  "Origem",
  "Tipo de vencimento",
  "Data de vencimento",
  "Valor",
];

const LINHA_EXEMPLO = [
  "João Silva",
  "(11) 98888-0000",
  "joao@exemplo.com",
  "529.982.247-25",
  "1990-05-20",
  "Indicação",
  "Seguro auto",
  "2026-12-01",
  "2400.00",
];

function paraCsv(linhas: string[][]): string {
  return linhas
    .map((linha) => linha.map((celula) => `"${celula.replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

/** Gera e baixa o modelo de planilha (PRD §6.1: "modelo de planilha pra download"). */
export function baixarModelo(): void {
  const conteudo = paraCsv([CABECALHOS, LINHA_EXEMPLO]);
  const blob = new Blob([conteudo], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "modelo-importacao-facility.csv";
  link.click();
  URL.revokeObjectURL(url);
}
