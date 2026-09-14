import { createBrowserRouter } from "react-router-dom";
import { RotaProtegida } from "@/app/RotaProtegida";
import { RotaPublica } from "@/app/RotaPublica";
import { Inicio } from "@/app/paginas/Inicio";
import { Privacidade } from "@/app/paginas/Privacidade";
import { Termos } from "@/app/paginas/Termos";
import { Entrar } from "@/features/auth/paginas/Entrar";
import { Cadastro } from "@/features/auth/paginas/Cadastro";
import { AceitarConvite } from "@/features/onboarding/paginas/AceitarConvite";
import { Convidar } from "@/features/onboarding/paginas/Convidar";
import { CriarEmpresa } from "@/features/onboarding/paginas/CriarEmpresa";

export const router = createBrowserRouter([
  {
    element: <RotaPublica />,
    children: [
      { path: "/entrar", element: <Entrar /> },
      { path: "/cadastro", element: <Cadastro /> },
    ],
  },
  { path: "/termos", element: <Termos /> },
  { path: "/privacidade", element: <Privacidade /> },
  { path: "/convite/:token", element: <AceitarConvite /> },
  {
    element: <RotaProtegida />,
    children: [
      { path: "/", element: <Inicio /> },
      { path: "/onboarding", element: <CriarEmpresa /> },
      { path: "/convidar", element: <Convidar /> },
    ],
  },
]);
