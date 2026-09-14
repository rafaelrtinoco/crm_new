import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/features/auth/api/useAuth";
import { useAceitarConvite } from "@/features/onboarding/api/useOnboarding";

/** Rota /convite/:token — PRD §6.1 (convites de equipe). */
export function AceitarConvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { usuario, carregando } = useAuth();
  const aceitarConvite = useAceitarConvite();
  const [erro, setErro] = useState<string | null>(null);

  async function aoAceitar() {
    if (!token) return;
    setErro(null);
    try {
      await aceitarConvite.mutateAsync(token);
      navigate("/", { replace: true });
    } catch (erroCapturado) {
      // A função aceitar_convite() no banco já devolve uma mensagem
      // específica (e-mail errado, expirado, já usado) — mostrar essa,
      // não uma genérica que esconde a causa real.
      const mensagem =
        erroCapturado instanceof Error
          ? erroCapturado.message
          : "Não foi possível aceitar o convite. Tente de novo em instantes.";
      setErro(mensagem);
    }
  }

  if (carregando) return null;

  if (!usuario) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Você foi convidado</CardTitle>
            <CardDescription>Entre ou crie sua conta pra aceitar o convite.</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button asChild className="flex-1">
              <Link to="/entrar" state={{ de: `/convite/${token}` }}>
                Entrar
              </Link>
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <Link to="/cadastro" state={{ de: `/convite/${token}` }}>
                Criar conta
              </Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Aceitar convite</CardTitle>
          <CardDescription>Você vai entrar como membro desta empresa.</CardDescription>
        </CardHeader>
        <CardContent>
          {erro && <p className="mb-3 text-sm text-destructive">{erro}</p>}
          <Button className="w-full" onClick={aoAceitar} disabled={aceitarConvite.isPending}>
            {aceitarConvite.isPending ? "Aceitando…" : "Aceitar convite"}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
