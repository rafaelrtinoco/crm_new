import { z } from "zod";

export const tarefaSchema = z.object({
  tipo: z.enum(["ligar", "whatsapp", "email", "reuniao", "outro"]),
  titulo: z.string().min(2, "Informe o título"),
  dataVencimento: z.string().min(1, "Informe a data"),
  responsavelId: z.string().optional(),
  contatoId: z.string().optional(),
  negocioId: z.string().optional(),
});

export type TarefaInput = z.infer<typeof tarefaSchema>;
