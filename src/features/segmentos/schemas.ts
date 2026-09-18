import { z } from "zod";

export const CAMPOS_SEGMENTO = [
  "status",
  "temperatura",
  "tags",
  "origem",
  "cidade",
  "idade",
  "responsavel_id",
  "sem_contato_dias",
  "vencimento_tipo_mes",
  "personalizado",
] as const;

export type CampoSegmento = (typeof CAMPOS_SEGMENTO)[number];

/**
 * Validação de forma (não duplica a validação de negócio, que mora no
 * banco — `validar_criterios_segmento` + `contato_bate_criterios` são a
 * fonte da verdade). Aqui só pega erro óbvio antes de gastar uma
 * viagem ao servidor: campo vazio, faixa invertida etc.
 */
export const regraSegmentoSchema = z
  .object({
    campo: z.enum(CAMPOS_SEGMENTO),
    operador: z.string().min(1),
    chave: z.string().optional(),
    valor: z.unknown(),
  })
  .superRefine((regra, ctx) => {
    switch (regra.campo) {
      case "status":
      case "temperatura":
      case "tags":
      case "origem":
      case "responsavel_id":
        if (!Array.isArray(regra.valor) || regra.valor.length === 0) {
          ctx.addIssue({ code: "custom", message: "Escolha ao menos um valor" });
        }
        break;
      case "cidade":
        if (typeof regra.valor !== "string" || regra.valor.trim() === "") {
          ctx.addIssue({ code: "custom", message: "Informe a cidade" });
        }
        break;
      case "idade": {
        const valor = regra.valor as [number, number] | undefined;
        if (!Array.isArray(valor) || valor.length !== 2 || valor[0] > valor[1]) {
          ctx.addIssue({ code: "custom", message: "Informe uma faixa de idade válida" });
        }
        break;
      }
      case "sem_contato_dias":
        if (typeof regra.valor !== "number" || regra.valor < 0) {
          ctx.addIssue({ code: "custom", message: "Informe um número de dias válido" });
        }
        break;
      case "vencimento_tipo_mes": {
        const valor = regra.valor as { vencimento_tipo_id?: string; mes?: number } | undefined;
        if (!valor?.vencimento_tipo_id || !valor?.mes) {
          ctx.addIssue({ code: "custom", message: "Escolha o tipo e o mês de vencimento" });
        }
        break;
      }
      case "personalizado":
        if (!regra.chave) {
          ctx.addIssue({ code: "custom", message: "Escolha o campo personalizado" });
        }
        if (regra.valor === undefined || regra.valor === null || regra.valor === "") {
          ctx.addIssue({ code: "custom", message: "Informe o valor" });
        }
        break;
    }
  });

export const segmentoSchema = z.object({
  nome: z.string().min(2, "Informe o nome do segmento"),
  regras: z.array(regraSegmentoSchema).default([]),
});

export type SegmentoFormInput = z.infer<typeof segmentoSchema>;
