export type CampoDestino =
  | "nome"
  | "telefone"
  | "email"
  | "cpfCnpj"
  | "nascimento"
  | "origem"
  | "vencimentoTipo"
  | "dataVencimento"
  | "valor";

export const rotuloCampoDestino: Record<CampoDestino, string> = {
  nome: "Nome",
  telefone: "Telefone/WhatsApp",
  email: "E-mail",
  cpfCnpj: "CPF/CNPJ",
  nascimento: "Data de nascimento",
  origem: "Origem",
  vencimentoTipo: "Tipo de vencimento",
  dataVencimento: "Data de vencimento",
  valor: "Valor",
};

const SINONIMOS: Record<CampoDestino, string[]> = {
  nome: ["nome", "name", "nome completo", "cliente"],
  telefone: ["telefone", "celular", "whatsapp", "phone", "fone", "tel"],
  email: ["email", "e-mail", "correio"],
  cpfCnpj: ["cpf", "cnpj", "cpf/cnpj", "documento"],
  nascimento: ["nascimento", "data de nascimento", "data nascimento", "aniversario", "aniversário"],
  origem: ["origem", "source", "canal"],
  vencimentoTipo: ["tipo", "tipo de vencimento", "produto"],
  dataVencimento: ["vencimento", "data de vencimento", "data vencimento", "data do vencimento"],
  valor: ["valor", "preco", "preço", "price"],
};

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Sugere o campo de destino pra um cabeçalho de coluna, por sinônimo conhecido. */
export function sugerirCampo(cabecalho: string): CampoDestino | null {
  const normalizado = normalizar(cabecalho);
  for (const [campo, sinonimos] of Object.entries(SINONIMOS) as [CampoDestino, string[]][]) {
    if (sinonimos.some((sinonimo) => normalizar(sinonimo) === normalizado)) return campo;
  }
  return null;
}

/** Monta o mapeamento inicial (cabeçalho → campo sugerido) pra todas as colunas do arquivo. */
export function sugerirMapeamento(cabecalhos: string[]): Record<string, CampoDestino | null> {
  const mapeamento: Record<string, CampoDestino | null> = {};
  for (const cabecalho of cabecalhos) {
    mapeamento[cabecalho] = sugerirCampo(cabecalho);
  }
  return mapeamento;
}
