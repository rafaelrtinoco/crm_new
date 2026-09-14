import { describe, expect, it } from "vitest";
import { sugerirCampo, sugerirMapeamento } from "./mapeamentoColunas";

describe("sugerirCampo", () => {
  it("reconhece sinônimos de telefone", () => {
    expect(sugerirCampo("Celular")).toBe("telefone");
    expect(sugerirCampo("WhatsApp")).toBe("telefone");
    expect(sugerirCampo("phone")).toBe("telefone");
  });

  it("reconhece sinônimos com acento e caixa diferente", () => {
    expect(sugerirCampo("E-MAIL")).toBe("email");
    expect(sugerirCampo("Aniversário")).toBe("nascimento");
  });

  it("reconhece CPF/CNPJ", () => {
    expect(sugerirCampo("CPF/CNPJ")).toBe("cpfCnpj");
    expect(sugerirCampo("Documento")).toBe("cpfCnpj");
  });

  it("reconhece campos de vencimento", () => {
    expect(sugerirCampo("Data de Vencimento")).toBe("dataVencimento");
    expect(sugerirCampo("Tipo")).toBe("vencimentoTipo");
    expect(sugerirCampo("Valor")).toBe("valor");
  });

  it("não sugere nada pra coluna desconhecida", () => {
    expect(sugerirCampo("Coluna Misteriosa XYZ")).toBeNull();
  });
});

describe("sugerirMapeamento", () => {
  it("monta o mapeamento pra todas as colunas do cabeçalho", () => {
    const mapeamento = sugerirMapeamento(["Nome", "Celular", "Coluna Desconhecida"]);
    expect(mapeamento).toEqual({
      Nome: "nome",
      Celular: "telefone",
      "Coluna Desconhecida": null,
    });
  });
});
