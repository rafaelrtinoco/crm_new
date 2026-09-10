import { useEffect, useState } from "react";

type Tema = "claro" | "escuro";
const CHAVE_TEMA = "facility:tema";

function lerTemaSalvo(): Tema {
  if (typeof window === "undefined") return "claro";
  const salvo = window.localStorage.getItem(CHAVE_TEMA);
  if (salvo === "claro" || salvo === "escuro") return salvo;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "escuro" : "claro";
}

/** Alterna e persiste o tema claro/escuro (preferência de UI, não é dado pessoal). */
export function useTema() {
  const [tema, setTema] = useState<Tema>(lerTemaSalvo);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", tema === "escuro");
    window.localStorage.setItem(CHAVE_TEMA, tema);
  }, [tema]);

  return {
    tema,
    alternar: () => setTema((atual) => (atual === "claro" ? "escuro" : "claro")),
  };
}
