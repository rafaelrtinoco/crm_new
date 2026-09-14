import { LogOut } from "lucide-react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/api/useAuth";
import { supabase } from "@/lib/supabase";

/** Redireciona pra /entrar quem não está autenticado, guardando a rota de origem. */
export function RotaProtegida() {
  const { usuario, carregando } = useAuth();
  const location = useLocation();

  if (carregando) return null;
  if (!usuario) return <Navigate to="/entrar" state={{ de: location.pathname }} replace />;

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-end border-b border-border px-4 py-2">
        <Button variant="ghost" size="sm" onClick={() => supabase.auth.signOut()}>
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </header>
      <Outlet />
    </div>
  );
}
