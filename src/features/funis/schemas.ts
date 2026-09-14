import { z } from "zod";

/**
 * proximoPassoEm/proximoPassoAcao são obrigatórios espelhando as colunas
 * `not null` de `negocios` — PRD §6.5: "próximo passo obrigatório".
 */
export const negocioSchema = z.object({
  contatoId: z.string().min(1, "Selecione o contato"),
  funilId: z.string().min(1, "Selecione o funil"),
  etapaId: z.string().min(1, "Selecione a etapa"),
  valorEstimado: z.string().optional(),
  responsavelId: z.string().optional(),
  previsaoFechamento: z.string().optional(),
  proximoPassoEm: z.string().min(1, "Informe a data do próximo passo"),
  proximoPassoAcao: z.string().min(1, "Informe o próximo passo"),
});

export type NegocioInput = z.infer<typeof negocioSchema>;

/** Confirmar/trocar o próximo passo ao mover um card entre etapas (PRD §6.5). */
export const proximoPassoSchema = z.object({
  proximoPassoEm: z.string().min(1, "Informe a data do próximo passo"),
  proximoPassoAcao: z.string().min(1, "Informe o próximo passo"),
});

export type ProximoPassoInput = z.infer<typeof proximoPassoSchema>;

export const perdaSchema = z.object({
  motivoPerdaId: z.string().min(1, "Selecione o motivo"),
  reativarEm: z.string().optional(),
});

export type PerdaInput = z.infer<typeof perdaSchema>;
