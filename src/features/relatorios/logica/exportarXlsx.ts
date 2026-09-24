type Celula = string | number;

/** Gera e baixa uma planilha .xlsx a partir de cabeçalhos + linhas — biblioteca carregada sob demanda (mesmo padrão de `parseArquivo.ts`, importação). */
export async function exportarXlsx(
  nomeArquivo: string,
  cabecalhos: string[],
  linhas: Celula[][],
): Promise<void> {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const planilha = workbook.addWorksheet("Relatório");
  planilha.addRow(cabecalhos).font = { bold: true };
  linhas.forEach((linha) => planilha.addRow(linha));
  planilha.columns.forEach((coluna) => {
    coluna.width = 22;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  link.click();
  URL.revokeObjectURL(url);
}
