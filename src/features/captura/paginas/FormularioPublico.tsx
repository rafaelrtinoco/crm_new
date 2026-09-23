import { useParams } from "react-router-dom";
import { FormularioEmbutivel } from "@/features/captura/components/FormularioEmbutivel";

/**
 * Rota pública nua, pensada pra `<iframe>` — sem sidebar, sem
 * autenticação (`:empresaSlug` só compõe a URL "bonita" pra quem
 * incorpora; o formulário em si já é identificado pelo `:formularioId`,
 * globalmente único).
 */
export function FormularioPublico() {
  const { formularioId } = useParams<{ formularioId: string }>();

  if (!formularioId) return null;

  return (
    <main className="mx-auto max-w-md p-4">
      <FormularioEmbutivel formularioId={formularioId} />
    </main>
  );
}
