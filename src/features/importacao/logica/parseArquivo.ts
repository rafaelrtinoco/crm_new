import type { CellValue } from "exceljs";

export interface ArquivoParseado {
  cabecalhos: string[];
  linhas: Record<string, string>[];
}

function celulaParaTexto(valor: CellValue): string {
  if (valor == null) return "";
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  if (typeof valor === "object") {
    if ("text" in valor && typeof valor.text === "string") return valor.text;
    if ("richText" in valor && Array.isArray(valor.richText)) {
      return valor.richText.map((trecho) => trecho.text).join("");
    }
    if ("result" in valor) return String(valor.result ?? "");
    return "";
  }
  return String(valor);
}

async function parseCsv(arquivo: File): Promise<ArquivoParseado> {
  const { default: Papa } = await import("papaparse");
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(arquivo, {
      header: true,
      skipEmptyLines: true,
      complete: (resultado) => {
        resolve({ cabecalhos: resultado.meta.fields ?? [], linhas: resultado.data });
      },
      error: (erro: Error) => reject(erro),
    });
  });
}

async function parseXlsx(arquivo: File): Promise<ArquivoParseado> {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const buffer = await arquivo.arrayBuffer();
  await workbook.xlsx.load(buffer);
  const planilha = workbook.worksheets[0];
  if (!planilha) throw new Error("Planilha vazia.");

  const linhasValores: string[][] = [];
  planilha.eachRow((linha) => {
    const valores = (linha.values as CellValue[]).slice(1).map(celulaParaTexto);
    linhasValores.push(valores);
  });

  const [cabecalhos, ...linhasDados] = linhasValores;
  if (!cabecalhos) throw new Error("Planilha vazia.");

  const linhas = linhasDados.map((valores) => {
    const linha: Record<string, string> = {};
    cabecalhos.forEach((cabecalho, indice) => {
      linha[cabecalho] = valores[indice] ?? "";
    });
    return linha;
  });

  return { cabecalhos, linhas };
}

/** Lê um .csv ou .xlsx no navegador — bibliotecas carregadas sob demanda (code-split). */
export async function parseArquivo(arquivo: File): Promise<ArquivoParseado> {
  const extensao = arquivo.name.split(".").pop()?.toLowerCase();
  if (extensao === "xlsx") return parseXlsx(arquivo);
  return parseCsv(arquivo);
}
