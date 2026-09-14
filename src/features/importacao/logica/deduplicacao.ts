export interface DadosDeduplicaveis {
  telefone?: string;
  email?: string;
  cpfCnpj?: string;
}

export interface ChavesExistentes {
  telefones: Set<string>;
  emails: Set<string>;
  cpfsCnpjs: Set<string>;
}

function normalizarTelefone(valor: string): string {
  return valor.replace(/\D/g, "");
}

function normalizarEmail(valor: string): string {
  return valor.trim().toLowerCase();
}

function normalizarDocumento(valor: string): string {
  return valor.replace(/\D/g, "");
}

/** Monta as chaves de dedup a partir dos contatos já cadastrados na empresa. */
export function construirChavesExistentes(contatos: DadosDeduplicaveis[]): ChavesExistentes {
  const chaves: ChavesExistentes = {
    telefones: new Set(),
    emails: new Set(),
    cpfsCnpjs: new Set(),
  };
  for (const contato of contatos) {
    if (contato.telefone) chaves.telefones.add(normalizarTelefone(contato.telefone));
    if (contato.email) chaves.emails.add(normalizarEmail(contato.email));
    if (contato.cpfCnpj) chaves.cpfsCnpjs.add(normalizarDocumento(contato.cpfCnpj));
  }
  return chaves;
}

/** PRD §6.1 — deduplicação por telefone, e-mail e CPF/CNPJ. */
export function ehDuplicado(linha: DadosDeduplicaveis, chaves: ChavesExistentes): boolean {
  if (linha.telefone && chaves.telefones.has(normalizarTelefone(linha.telefone))) return true;
  if (linha.email && chaves.emails.has(normalizarEmail(linha.email))) return true;
  if (linha.cpfCnpj && chaves.cpfsCnpjs.has(normalizarDocumento(linha.cpfCnpj))) return true;
  return false;
}

/**
 * Duplicidade dentro do próprio arquivo: se duas linhas têm o mesmo
 * telefone/e-mail/CPF-CNPJ, só a primeira ocorrência conta como nova.
 */
export function marcarDuplicadosNoArquivo(linhas: DadosDeduplicaveis[]): boolean[] {
  const vistos: ChavesExistentes = {
    telefones: new Set(),
    emails: new Set(),
    cpfsCnpjs: new Set(),
  };
  return linhas.map((linha) => {
    const duplicado = ehDuplicado(linha, vistos);
    if (linha.telefone) vistos.telefones.add(normalizarTelefone(linha.telefone));
    if (linha.email) vistos.emails.add(normalizarEmail(linha.email));
    if (linha.cpfCnpj) vistos.cpfsCnpjs.add(normalizarDocumento(linha.cpfCnpj));
    return duplicado;
  });
}
