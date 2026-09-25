import { describe, expect, it } from "vitest";
import {
  diaHorarioValido,
  formularioParaHorarioComercial,
  horarioComercialParaFormulario,
  horaValida,
} from "./horarioComercial";

describe("horarioComercialParaFormulario", () => {
  it("converte o jsonb padrão do template (seg-sex aberto, fim de semana fechado)", () => {
    const form = horarioComercialParaFormulario({
      seg_sex: ["08:00", "18:00"],
      sab: null,
      dom: null,
    });
    expect(form.segSex).toEqual({ fechado: false, inicio: "08:00", fim: "18:00" });
    expect(form.sab.fechado).toBe(true);
    expect(form.dom.fechado).toBe(true);
  });

  it("trata chave ausente como dia fechado", () => {
    const form = horarioComercialParaFormulario({ seg_sex: ["08:00", "18:00"] });
    expect(form.sab.fechado).toBe(true);
    expect(form.dom.fechado).toBe(true);
  });
});

describe("formularioParaHorarioComercial", () => {
  it("converte de volta pra jsonb, dia fechado vira null", () => {
    const json = formularioParaHorarioComercial({
      segSex: { fechado: false, inicio: "09:00", fim: "19:00" },
      sab: { fechado: false, inicio: "09:00", fim: "12:00" },
      dom: { fechado: true, inicio: "08:00", fim: "18:00" },
    });
    expect(json).toEqual({
      seg_sex: ["09:00", "19:00"],
      sab: ["09:00", "12:00"],
      dom: null,
    });
  });

  it("é o inverso de horarioComercialParaFormulario pro caso do template padrão", () => {
    const original = { seg_sex: ["08:00", "18:00"], sab: null, dom: null };
    const ida = horarioComercialParaFormulario(original);
    const volta = formularioParaHorarioComercial(ida);
    expect(volta).toEqual(original);
  });
});

describe("horaValida", () => {
  it("aceita HH:MM com zero à esquerda", () => {
    expect(horaValida("08:00")).toBe(true);
    expect(horaValida("23:59")).toBe(true);
  });

  it("rejeita hora sem zero à esquerda ou fora do range", () => {
    expect(horaValida("8:00")).toBe(false);
    expect(horaValida("24:00")).toBe(false);
    expect(horaValida("12:60")).toBe(false);
  });
});

describe("diaHorarioValido", () => {
  it("dia fechado é sempre válido, mesmo com horas malformadas", () => {
    expect(diaHorarioValido({ fechado: true, inicio: "", fim: "" })).toBe(true);
  });

  it("dia aberto exige início < fim", () => {
    expect(diaHorarioValido({ fechado: false, inicio: "08:00", fim: "18:00" })).toBe(true);
    expect(diaHorarioValido({ fechado: false, inicio: "18:00", fim: "08:00" })).toBe(false);
    expect(diaHorarioValido({ fechado: false, inicio: "08:00", fim: "08:00" })).toBe(false);
  });
});
