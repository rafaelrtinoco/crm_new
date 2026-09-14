import { Link, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/api/useAuth";
import { useEmpresaAtual, useEmpresas } from "@/features/onboarding/api/useEmpresas";

/**
 * Placeholder pós-login/onboarding. Some no incremento 1D, quando a
 * tela "Hoje" (PRD §6.2) existir de verdade.
 */
export function Inicio() {
  const { usuario } = useAuth();
  const { data: empresas, isLoading } = useEmpresas();
  const { atual } = useEmpresaAtual();

  if (isLoading) return null;
  if (!empresas || empresas.length === 0) return <Navigate to="/onboarding" replace />;

  const nome = (usuario?.user_metadata as { nome?: string } | undefined)?.nome ?? usuario?.email;

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-8">
      <h1 className="text-2xl font-semibold">Bem-vindo(a), {nome}</h1>
      <p className="text-muted-foreground">
        Você está em <strong>{atual?.nome}</strong>. A tela &quot;Hoje&quot; chega no incremento 1D.
      </p>
      <div className="flex gap-2">
        <Button asChild>
          <Link to="/contatos">Contatos</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/convidar">Convidar equipe</Link>
        </Button>
      </div>
    </main>
  );
}
