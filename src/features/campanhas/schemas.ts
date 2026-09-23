import { z } from "zod";

export const CANAIS_CAMPANHA = ["email", "whatsapp"] as const;
export type CanalCampanha = (typeof CANAIS_CAMPANHA)[number];

export const blocoSchema = z.object({
  tipo: z.enum(["texto", "imagem"]),
  conteudo: z.string().min(1, "Preencha o conteúdo do bloco"),
});
export type BlocoFormInput = z.infer<typeof blocoSchema>;

export const templateSchema = z.object({
  nome: z.string().min(2, "Informe o nome do template"),
  canal: z.enum(CANAIS_CAMPANHA),
  conteudo: z.string().min(1, "Informe o conteúdo do template"),
});
export type TemplateFormInput = z.infer<typeof templateSchema>;

/**
 * Validação de forma (a regra de negócio — template obrigatório e
 * aprovado pra WhatsApp — mora no banco, em `disparar_campanha`). Aqui
 * só evita submeter um formulário obviamente incompleto: WhatsApp sem
 * template escolhido, e-mail sem nenhum bloco de conteúdo.
 */
export const campanhaSchema = z
  .object({
    nome: z.string().min(2, "Informe o nome da campanha"),
    canal: z.enum(CANAIS_CAMPANHA),
    segmentoId: z.string().min(1, "Escolha um segmento"),
    templateId: z.string().nullable().default(null),
    assunto: z.string().nullable().default(null),
    blocos: z.array(blocoSchema).default([]),
    agendarPara: z.string().nullable().default(null),
  })
  .superRefine((dados, ctx) => {
    if (dados.canal === "whatsapp" && !dados.templateId) {
      ctx.addIssue({
        code: "custom",
        path: ["templateId"],
        message: "Escolha um template pra WhatsApp",
      });
    }
    if (dados.canal === "email" && dados.blocos.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["blocos"],
        message: "Adicione ao menos um bloco de conteúdo",
      });
    }
  });
export type CampanhaFormInput = z.infer<typeof campanhaSchema>;
