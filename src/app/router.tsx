import { createBrowserRouter } from "react-router-dom";
import { Smoke } from "@/app/paginas/Smoke";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Smoke />,
  },
]);
