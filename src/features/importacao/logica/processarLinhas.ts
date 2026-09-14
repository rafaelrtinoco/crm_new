import { validarCNPJ, validarCPF } from "@/lib/formatadores";
import {
  ehDuplicado,
  marcarDuplicadosNoArquivo,
  type ChavesExistentes,
  type DadosDeduplicaveis,
} from "@/features/importacao/logica/deduplicacao";
import type { CampoDestino } from "@/features/importacao/logica/mapeamentoColunas";

export interface DadosLinha extends DadosDeduplicaveis {
  nome?: string;
  nascimento?: string;
  origem?: string;
  vencimentoTipoNome?: string;
  dataVencimento?: string;
  valor?: string;
}

export interface LinhaProcessada {
  linha: number;
  dados: DadosLinha;
  status: "valida" | "erro" | "duplicada";
  mensagem?: string;
}

function documentoValido(cpfCnpj: string): boolean {
  const digitos = cpfCnpj.replace(/\D/g, "");
  if (digitos.length === 11) return validarCPF(cpfCnpj);
  if (digitos.length === 14) return validarCNPJ(cpfCnpj);
  return false;
}

/**
 * Aplica o mapeamento de colunas às linhas brutas do arquivo e valida
 * cada uma (PRD §6.1: mapeamento, prévia, validação, deduplicação).
 * Função pura — sem chamada ao Supabase, testável isoladamente.
 */
export function processarLinhas(
  linhasBrutas: Record<string, string>[],
  mapeamento: Record<string, CampoDestino | null>,
  chavesExistentes: ChavesExistentes,
): LinhaProcessada[] {
  const linhasComDados = linhasBrutas.map((bruta, indice) => {
    const dados: DadosLinha = {};
    for (const [cabecalho, campo] of Object.entries(mapeamento)) {
      if (!campo) continue;
      const valor = bruta[cabecalho]?.trim();
      if (valor) (dados as Record<string, string>)[campo] = valor;
    }
    // +2: a primeira linha do arquivo é o cabeçalho, e planilhas contam a partir de 1.
    return { linha: indice + 2, dados };
  });

  const duplicadosNoArquivo = marcarDuplicadosNoArquivo(linhasComDados.map((l) => l.dados));

  return linhasComDados.map((linha, indice) => {
    if (!linha.dados.nome) {
      return { ...linha, status: "erro" as const, mensagem: "Nome é obrigatório" };
    }
    if (linha.dados.cpfCnpj && !documentoValido(linha.dados.cpfCnpj)) {
      return { ...linha, status: "erro" as const, mensagem: "CPF ou CNPJ inválido" };
    }
    if (duplicadosNoArquivo[indice] || ehDuplicado(linha.dados, chavesExistentes)) {
      return {
        ...linha,
        status: "duplicada" as const,
        mensagem: "Já existe um contato com este telefone, e-mail ou CPF/CNPJ",
      };
    }
    return { ...linha, status: "valida" as const };
  });
}
