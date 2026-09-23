import { z } from "zod";

export const DISTRIBUICOES = ["rodizio", "fixo"] as const;
export type DistribuicaoTipo = (typeof DISTRIBUICOES)[number];

const distribuicaoBase = z.object({
  distribuicaoTipo: z.enum(DISTRIBUICOES),
  responsavelFixoId: z.string().nullable().default(null),
});

function exigirResponsavelSeFixo<T extends z.infer<typeof distribuicaoBase>>(
  dados: T,
  ctx: z.RefinementCtx,
) {
  if (dados.distribuicaoTipo === "fixo" && !dados.responsavelFixoId) {
    ctx.addIssue({
      code: "custom",
      path: ["responsavelFixoId"],
      message: "Escolha o responsável fixo",
    });
  }
}

export const formularioSchema = z
  .object({
    nome: z.string().min(2, "Informe o nome do formulário"),
    ...distribuicaoBase.shape,
  })
  .superRefine(exigirResponsavelSeFixo);
export type FormularioFormInput = z.infer<typeof formularioSchema>;

export const paginaCapturaSchema = z.object({
  slug: z
    .string()
    .min(2, "Informe a URL da página")
    .regex(/^[a-z0-9-]+$/, "Use só letras minúsculas, números e hífen"),
  titulo: z.string().min(2, "Informe o título"),
  texto: z.string().nullable().default(null),
  imagemUrl: z.string().nullable().default(null),
  formularioId: z.string().nullable().default(null),
  whatsappNumero: z.string().nullable().default(null),
  whatsappMensagem: z.string().nullable().default(null),
});
export type PaginaCapturaFormInput = z.infer<typeof paginaCapturaSchema>;

export const integracaoSchema = z
  .object({
    nome: z.string().min(2, "Informe o nome da integração"),
    ...distribuicaoBase.shape,
  })
  .superRefine(exigirResponsavelSeFixo);
export type IntegracaoFormInput = z.infer<typeof integracaoSchema>;
