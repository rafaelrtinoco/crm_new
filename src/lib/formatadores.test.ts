import { describe, expect, it } from "vitest";
import {
  formatarBRL,
  formatarCEP,
  formatarCNPJ,
  formatarCPF,
  formatarCpfCnpj,
  formatarTelefone,
  validarCNPJ,
  validarCPF,
} from "./formatadores";

describe("formatarBRL", () => {
  it("formata número como moeda BRL", () => {
    expect(formatarBRL(1234.5)).toBe("R$ 1.234,50");
  });
});

describe("formatarTelefone", () => {
  it("formata celular com 11 dígitos", () => {
    expect(formatarTelefone("11987654321")).toBe("(11) 98765-4321");
  });

  it("formata fixo com 10 dígitos", () => {
    expect(formatarTelefone("1132654321")).toBe("(11) 3265-4321");
  });
});

describe("formatarCEP", () => {
  it("formata CEP", () => {
    expect(formatarCEP("01310100")).toBe("01310-100");
  });
});

describe("formatarCPF / formatarCNPJ", () => {
  it("formata CPF", () => {
    expect(formatarCPF("52998224725")).toBe("529.982.247-25");
  });

  it("formata CNPJ", () => {
    expect(formatarCNPJ("11222333000181")).toBe("11.222.333/0001-81");
  });

  it("formatarCpfCnpj escolhe pelo tamanho", () => {
    expect(formatarCpfCnpj("52998224725")).toBe("529.982.247-25");
    expect(formatarCpfCnpj("11222333000181")).toBe("11.222.333/0001-81");
  });
});

describe("validarCPF", () => {
  it("aceita CPF válido conhecido", () => {
    expect(validarCPF("529.982.247-25")).toBe(true);
  });

  it("rejeita CPF com dígito verificador errado", () => {
    expect(validarCPF("529.982.247-26")).toBe(false);
  });

  it("rejeita CPF com todos os dígitos iguais", () => {
    expect(validarCPF("111.111.111-11")).toBe(false);
  });

  it("rejeita CPF com tamanho errado", () => {
    expect(validarCPF("123")).toBe(false);
  });
});

describe("validarCNPJ", () => {
  it("aceita CNPJ válido conhecido", () => {
    expect(validarCNPJ("11.222.333/0001-81")).toBe(true);
  });

  it("rejeita CNPJ com dígito verificador errado", () => {
    expect(validarCNPJ("11.222.333/0001-82")).toBe(false);
  });

  it("rejeita CNPJ com todos os dígitos iguais", () => {
    expect(validarCNPJ("11.111.111/1111-11")).toBe(false);
  });
});
