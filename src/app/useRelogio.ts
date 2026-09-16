import { useEffect, useState } from "react";

/**
 * Instante atual, atualizado a cada minuto — usado pro relógio da
 * topbar. Sem argumento de fuso: o hook só tica o `Date`, a conversão
 * pro fuso da empresa acontece na hora de formatar (`formatarDataHoraFuso`),
 * nunca aqui — mantém o hook simples e sem acoplamento.
 */
export function useRelogio(): Date {
  const [agora, setAgora] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  return agora;
}
