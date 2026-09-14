import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SecaoProps {
  titulo: string;
  quantidade: number;
  children: ReactNode;
}

/** Wrapper de seção da tela "Hoje" — bloco vazio simplesmente não aparece. */
export function SecaoAcoesHoje({ titulo, quantidade, children }: SecaoProps) {
  if (quantidade === 0) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground">
        {titulo} <span className="text-foreground">({quantidade})</span>
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

interface ItemAcaoProps {
  titulo: string;
  subtitulo: string;
  urgente?: boolean;
  acoes: ReactNode;
}

/** Linha de item de ação — mesmo visual de `ItemTarefa`, sem depender dele. */
export function ItemAcao({ titulo, subtitulo, urgente, acoes }: ItemAcaoProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-md border px-3 py-2.5",
        urgente ? "border-urgencia bg-urgencia/5" : "border-border",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{titulo}</p>
        <p className="truncate text-xs text-muted-foreground">{subtitulo}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">{acoes}</div>
    </div>
  );
}
