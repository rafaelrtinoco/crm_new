import { z } from "zod";

export const empresaSchema = z.object({
  nome: z.string().min(2, "Informe o nome da empresa"),
  nicho: z.string().min(1, "Escolha o nicho"),
});

export type EmpresaInput = z.infer<typeof empresaSchema>;

export const conviteSchema = z.object({
  email: z.string().min(1, "Informe o e-mail").email("E-mail inválido"),
  papel: z.enum(["gestor", "usuario"], { errorMap: () => ({ message: "Escolha um papel" }) }),
});

export type ConviteInput = z.infer<typeof conviteSchema>;
