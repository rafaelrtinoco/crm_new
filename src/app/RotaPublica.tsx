import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/features/auth/api/useAuth";

/** /entrar e /cadastro não fazem sentido pra quem já está logado. */
export function RotaPublica() {
  const { usuario, carregando } = useAuth();

  if (carregando) return null;
  if (usuario) return <Navigate to="/" replace />;

  return <Outlet />;
}
