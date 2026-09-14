import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().min(1, "Informe o e-mail").email("E-mail inválido"),
  senha: z.string().min(1, "Informe a senha"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const cadastroSchema = z.object({
  nome: z.string().min(2, "Informe seu nome"),
  telefone: z
    .string()
    .min(1, "Informe o WhatsApp")
    .regex(/^\(\d{2}\)\s?\d{4,5}-?\d{4}$/, "Telefone inválido. Use (11) 98888-0000"),
  email: z.string().min(1, "Informe o e-mail").email("E-mail inválido"),
  senha: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres"),
  aceiteTermos: z.literal(true, {
    errorMap: () => ({ message: "É preciso aceitar os Termos de Uso e a Política de Privacidade" }),
  }),
});

export type CadastroInput = z.infer<typeof cadastroSchema>;
