import { z } from "zod";
import { validarCamposPersonalizados } from "@/lib/camposPersonalizados";
import { validarCNPJ, validarCPF } from "@/lib/formatadores";
import type { CampoPersonalizado } from "@/features/contatos/api/useCamposPersonalizados";

export const enderecoSchema = z.object({
  cep: z.string().optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
});

export const contatoSchemaBase = z.object({
  nome: z.string().min(2, "Informe o nome"),
  status: z.enum(["lead", "cliente", "inativo"]),
  temperatura: z.enum(["quente", "morno", "frio", ""]).optional(),
  origem: z.string().optional(),
  telefone: z.string().optional(),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  cpfCnpj: z
    .string()
    .optional()
    .refine((valor) => {
      if (!valor) return true;
      const digitos = valor.replace(/\D/g, "");
      if (digitos.length === 11) return validarCPF(valor);
      if (digitos.length === 14) return validarCNPJ(valor);
      return false;
    }, "CPF ou CNPJ inválido"),
  nascimento: z.string().optional(),
  responsavelId: z.string().optional(),
  endereco: enderecoSchema.optional(),
  campos: z.record(z.string(), z.unknown()).default({}),
});

export type ContatoInput = z.infer<typeof contatoSchemaBase>;

/**
 * Estende o schema base com a validação dos campos personalizados da
 * empresa (obrigatoriedade, formato conforme `tipo`). Como os campos
 * variam por empresa, o schema só pode ser montado em runtime.
 */
export function construirContatoSchema(camposPersonalizados: CampoPersonalizado[]) {
  return contatoSchemaBase.superRefine((valores, ctx) => {
    validarCamposPersonalizados(valores.campos, camposPersonalizados, ctx);
  });
}
