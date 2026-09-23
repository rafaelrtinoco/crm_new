import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useFormularioPublico,
  useSubmeterFormularioPublico,
} from "@/features/captura/api/useCapturaPublica";

const ROTULO_CAMPO: Record<string, string> = {
  nome: "Nome",
  telefone: "Telefone / WhatsApp",
  email: "E-mail",
};

interface FormularioEmbutivelProps {
  formularioId: string;
}

/**
 * O formulário em si — reusado tanto na rota nua `/f/...` (pra iframe)
 * quanto embutido dentro da página de captura completa `/p/...`.
 */
export function FormularioEmbutivel({ formularioId }: FormularioEmbutivelProps) {
  const { data: formulario, isLoading, isError } = useFormularioPublico(formularioId);
  const submeter = useSubmeterFormularioPublico(formularioId);
  const [enviado, setEnviado] = useState(false);

  async function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const dados = Object.fromEntries(new FormData(evento.currentTarget)) as Record<string, string>;
    await submeter.mutateAsync(dados);
    setEnviado(true);
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (isError || !formulario) {
    return <p className="text-sm text-muted-foreground">Formulário indisponível no momento.</p>;
  }

  if (enviado) {
    return (
      <p className="rounded-lg border border-success bg-success/10 p-4 text-sm">
        Recebemos seus dados — em breve alguém da nossa equipe entra em contato. Obrigado!
      </p>
    );
  }

  return (
    <form className="space-y-3" onSubmit={aoEnviar}>
      {formulario.campos.map((campo) => (
        <div key={campo} className="space-y-1.5">
          <Label htmlFor={campo}>{ROTULO_CAMPO[campo] ?? campo}</Label>
          <Input
            id={campo}
            name={campo}
            type={campo === "email" ? "email" : campo === "telefone" ? "tel" : "text"}
            required={campo === "nome"}
          />
        </div>
      ))}
      {submeter.isError && (
        <p className="text-sm text-destructive">
          Não foi possível enviar — confira os dados e tente de novo.
        </p>
      )}
      <Button type="submit" disabled={submeter.isPending} className="w-full">
        {submeter.isPending ? "Enviando…" : "Enviar"}
      </Button>
    </form>
  );
}
