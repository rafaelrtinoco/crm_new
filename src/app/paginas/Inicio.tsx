import { useAuth } from "@/features/auth/api/useAuth";
import { useEmpresaAtual } from "@/features/onboarding/api/useEmpresas";

/**
 * Placeholder pós-login/onboarding. Some no incremento 1D-4, quando a
 * tela "Hoje" (PRD §6.2) existir de verdade.
 */
export function Inicio() {
  const { usuario } = useAuth();
  const { atual } = useEmpresaAtual();

  const nome = (usuario?.user_metadata as { nome?: string } | undefined)?.nome ?? usuario?.email;

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-8">
      <h1 className="font-display text-2xl font-medium">Bem-vindo(a), {nome}</h1>
      <p className="text-muted-foreground">
        Você está em <strong>{atual?.nome}</strong>. A tela &quot;Hoje&quot; chega no incremento
        1D-4.
      </p>
    </main>
  );
}
