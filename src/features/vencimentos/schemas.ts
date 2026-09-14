import { z } from "zod";
import { validarCamposPersonalizados } from "@/lib/camposPersonalizados";
import type { CampoPersonalizado } from "@/features/contatos/api/useCamposPersonalizados";

export const vencimentoSchemaBase = z.object({
  contatoId: z.string().min(1, "Selecione o contato"),
  vencimentoTipoId: z.string().optional(),
  descricao: z.string().optional(),
  dataVencimento: z.string().min(1, "Informe a data de vencimento"),
  valor: z.string().optional(),
  recorrencia: z.enum(["unica", "mensal", "anual", "personalizada"]),
  responsavelId: z.string().optional(),
  campos: z.record(z.string(), z.unknown()).default({}),
});

export type VencimentoInput = z.infer<typeof vencimentoSchemaBase>;

/** Mesmo padrão de `contatos/schemas.ts` — validação dinâmica dos campos do nicho. */
export function construirVencimentoSchema(camposPersonalizados: CampoPersonalizado[]) {
  return vencimentoSchemaBase.superRefine((valores, ctx) => {
    validarCamposPersonalizados(valores.campos, camposPersonalizados, ctx);
  });
}
