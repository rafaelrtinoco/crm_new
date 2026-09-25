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

// ---------------------------------------------------------------------
// Fatia 2 (Núcleo) — um schema por entidade, espelhando os `check` que
// já existem nas tabelas (não duplica a regra de negócio, só pega erro
// óbvio antes da viagem ao servidor).
// ---------------------------------------------------------------------

export const funilSchema = z.object({
  nome: z.string().min(2, "Informe o nome do funil"),
  tipo: z.enum(["venda_nova", "renovacao", "personalizado"]),
  ordem: z.coerce.number().int().min(0),
});

export type FunilFormInput = z.infer<typeof funilSchema>;

export const etapaSchema = z.object({
  nome: z.string().min(2, "Informe o nome da etapa"),
  tipo: z.enum(["normal", "ganho", "perdido"]),
  ordem: z.coerce.number().int().min(0),
});

export type EtapaFormInput = z.infer<typeof etapaSchema>;

export const vencimentoTipoSchema = z.object({
  nome: z.string().min(2, "Informe o nome do tipo de vencimento"),
  recorrenciaPadrao: z.enum(["unica", "mensal", "anual", "personalizada"]),
});

export type VencimentoTipoFormInput = z.infer<typeof vencimentoTipoSchema>;

export const campoPersonalizadoSchema = z
  .object({
    chave: z
      .string()
      .regex(/^[a-z][a-z0-9_]*$/, "Use só letras minúsculas, números e _ (começando com letra)"),
    rotulo: z.string().min(2, "Informe o rótulo do campo"),
    tipo: z.enum(["texto", "numero", "data", "selecao", "booleano"]),
    opcoes: z.array(z.string().min(1)).nullable(),
    obrigatorio: z.boolean(),
    ordem: z.coerce.number().int().min(0),
  })
  .superRefine((campo, ctx) => {
    if (campo.tipo === "selecao" && (!campo.opcoes || campo.opcoes.length < 2)) {
      ctx.addIssue({
        code: "custom",
        path: ["opcoes"],
        message: "Informe ao menos 2 opções pra um campo de seleção",
      });
    }
  });

export type CampoPersonalizadoFormInput = z.infer<typeof campoPersonalizadoSchema>;

export const tagSchema = z.object({
  nome: z.string().min(1, "Informe o nome da tag"),
  cor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Cor precisa ser um hex de 6 dígitos (#RRGGBB)")
    .nullable(),
});

export type TagFormInput = z.infer<typeof tagSchema>;

export const motivoPerdaSchema = z.object({
  nome: z.string().min(2, "Informe o motivo da perda"),
});

export type MotivoPerdaFormInput = z.infer<typeof motivoPerdaSchema>;
