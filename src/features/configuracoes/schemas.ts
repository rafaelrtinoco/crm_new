import { z } from "zod";
import { horaValida } from "@/features/configuracoes/logica/horarioComercial";

/**
 * Validação de forma, espelhando o trigger `validar_empresa_antes_de_salvar`
 * (fuso/horario_comercial/cor_primaria) — não duplica a regra de negócio,
 * só pega erro óbvio antes de gastar uma viagem ao servidor.
 */
const diaHorarioSchema = z
  .object({
    fechado: z.boolean(),
    inicio: z.string(),
    fim: z.string(),
  })
  .superRefine((dia, ctx) => {
    if (dia.fechado) return;
    if (!horaValida(dia.inicio)) {
      ctx.addIssue({ code: "custom", path: ["inicio"], message: "Horário inválido" });
    }
    if (!horaValida(dia.fim)) {
      ctx.addIssue({ code: "custom", path: ["fim"], message: "Horário inválido" });
    }
    if (horaValida(dia.inicio) && horaValida(dia.fim) && dia.inicio >= dia.fim) {
      ctx.addIssue({ code: "custom", path: ["fim"], message: "Fim precisa ser depois do início" });
    }
  });

export const configuracoesEmpresaSchema = z.object({
  nome: z.string().min(2, "Informe o nome da empresa"),
  fuso: z.string().min(1, "Escolha o fuso horário"),
  horario: z.object({
    segSex: diaHorarioSchema,
    sab: diaHorarioSchema,
    dom: diaHorarioSchema,
  }),
  logoUrl: z.string().url().nullable(),
  corPrimaria: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Cor precisa ser um hex de 6 dígitos (#RRGGBB)")
    .nullable(),
});

export type ConfiguracoesEmpresaFormInput = z.infer<typeof configuracoesEmpresaSchema>;
