import { z } from "zod";
import type { CampoPersonalizado } from "@/features/contatos/api/useCamposPersonalizados";

/**
 * Validação genérica dos campos personalizados de uma empresa (PRD §3.2),
 * reusada tanto por Contatos quanto por Vencimentos — a obrigatoriedade e
 * o formato variam por empresa, então só dá pra validar em runtime.
 */
export function validarCamposPersonalizados(
  campos: Record<string, unknown>,
  camposPersonalizados: CampoPersonalizado[],
  ctx: z.RefinementCtx,
) {
  for (const campo of camposPersonalizados) {
    const valor = campos[campo.chave];
    const vazio = valor === undefined || valor === null || valor === "";

    if (campo.obrigatorio && vazio) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["campos", campo.chave],
        message: `${campo.rotulo} é obrigatório`,
      });
      continue;
    }
    if (vazio) continue;

    if (campo.tipo === "numero" && Number.isNaN(Number(valor))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["campos", campo.chave],
        message: `${campo.rotulo} precisa ser um número`,
      });
    }
  }
}
