import { describe, expect, it } from "vitest";
import { construirChavesExistentes, ehDuplicado, marcarDuplicadosNoArquivo } from "./deduplicacao";

describe("ehDuplicado", () => {
  it("detecta duplicidade por telefone, ignorando formatação", () => {
    const chaves = construirChavesExistentes([{ telefone: "(11) 98888-0001" }]);
    expect(ehDuplicado({ telefone: "11988880001" }, chaves)).toBe(true);
  });

  it("detecta duplicidade por e-mail, ignorando caixa", () => {
    const chaves = construirChavesExistentes([{ email: "Joao@Exemplo.com" }]);
    expect(ehDuplicado({ email: "joao@exemplo.com" }, chaves)).toBe(true);
  });

  it("detecta duplicidade por CPF/CNPJ, ignorando pontuação", () => {
    const chaves = construirChavesExistentes([{ cpfCnpj: "529.982.247-25" }]);
    expect(ehDuplicado({ cpfCnpj: "52998224725" }, chaves)).toBe(true);
  });

  it("não marca como duplicado quando não bate nada", () => {
    const chaves = construirChavesExistentes([{ telefone: "11988880001" }]);
    expect(ehDuplicado({ telefone: "11988880002" }, chaves)).toBe(false);
  });
});

describe("marcarDuplicadosNoArquivo", () => {
  it("só marca a partir da segunda ocorrência da mesma chave", () => {
    const resultado = marcarDuplicadosNoArquivo([
      { telefone: "11988880001" },
      { telefone: "11988880002" },
      { telefone: "11988880001" },
    ]);
    expect(resultado).toEqual([false, false, true]);
  });
});
