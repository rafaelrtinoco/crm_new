import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/features/auth/api/useAuth";

/** Redireciona pra /entrar quem não está autenticado, guardando a rota de origem. */
export function RotaProtegida() {
  const { usuario, carregando } = useAuth();
  const location = useLocation();

  if (carregando) return null;
  if (!usuario) return <Navigate to="/entrar" state={{ de: location.pathname }} replace />;

  return <Outlet />;
}
