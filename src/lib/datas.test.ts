import { describe, expect, it } from "vitest";
import { formatarDataHoraFuso, gradeCalendario } from "./datas";

describe("gradeCalendario", () => {
  it("começa no domingo e termina no sábado, com múltiplo de 7 dias", () => {
    const grade = gradeCalendario(2026, 8); // setembro/2026 (mês 0-indexado)
    expect(grade.length % 7).toBe(0);
    expect(new Date(`${grade[0]?.data}T00:00:00Z`).getUTCDay()).toBe(0);
    expect(new Date(`${grade[grade.length - 1]?.data}T00:00:00Z`).getUTCDay()).toBe(6);
  });

  it("marca noMes=true só pros dias do mês pedido", () => {
    const grade = gradeCalendario(2026, 8); // setembro/2026 tem 30 dias
    const doMes = grade.filter((d) => d.noMes);
    expect(doMes).toHaveLength(30);
    expect(doMes[0]?.data).toBe("2026-09-01");
    expect(doMes[doMes.length - 1]?.data).toBe("2026-09-30");
  });

  it("preenche os dias do mês anterior/seguinte com noMes=false", () => {
    const grade = gradeCalendario(2026, 8);
    const foraDoMes = grade.filter((d) => !d.noMes);
    for (const dia of foraDoMes) {
      expect(dia.data.startsWith("2026-09")).toBe(false);
    }
  });

  it("funciona em fevereiro (28/29 dias) e dezembro (virada de ano)", () => {
    const fevereiro = gradeCalendario(2026, 1);
    expect(fevereiro.filter((d) => d.noMes)).toHaveLength(28);

    const dezembro = gradeCalendario(2026, 11);
    const doMes = dezembro.filter((d) => d.noMes);
    expect(doMes).toHaveLength(31);
    // dias de janeiro/2027 completando a última semana, se houver.
    const foraDoMes = dezembro.filter((d) => !d.noMes && d.data > "2026-12-31");
    for (const dia of foraDoMes) {
      expect(dia.data.startsWith("2027-01")).toBe(true);
    }
  });
});

describe("formatarDataHoraFuso", () => {
  it("converte pro fuso pedido, não pro fuso do ambiente onde roda", () => {
    const instante = new Date(Date.UTC(2026, 8, 16, 17, 30)); // 16/set/2026 17:30 UTC

    // America/Sao_Paulo é UTC-3 (sem horário de verão desde 2019).
    expect(formatarDataHoraFuso(instante, "America/Sao_Paulo")).toContain("14:30");
    // Mesmo instante, fuso diferente — a hora exibida muda.
    expect(formatarDataHoraFuso(instante, "UTC")).toContain("17:30");
  });
});
