import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AcaoEmptyState {
  rotulo: string;
  href?: string;
  onClick?: () => void;
}

interface EmptyStateProps {
  icone: LucideIcon;
  titulo: string;
  descricao?: string;
  acao?: AcaoEmptyState;
  /** Versão compacta pra contextos apertados (ex.: coluna de kanban) — sem padding grande nem botão. */
  compacto?: boolean;
  className?: string;
  children?: ReactNode;
}

/**
 * Estado vazio padronizado — todo lugar que hoje mostra só um `<p>`
 * cinza deveria usar este componente (regra do usuário: "se houver
 * mais no projeto, aplique essa regra também").
 */
export function EmptyState({
  icone: Icone,
  titulo,
  descricao,
  acao,
  compacto = false,
  className,
  children,
}: EmptyStateProps) {
  if (compacto) {
    return (
      <div className={cn("flex flex-col items-center gap-1.5 px-2 py-4 text-center", className)}>
        <Icone className="h-4 w-4 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">{titulo}</p>
      </div>
    );
  }

  return (
    <div
      className={cn("flex flex-col items-center justify-center gap-3 p-12 text-center", className)}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icone className="h-5 w-5" />
      </span>
      <div className="space-y-1">
        <p className="text-lg font-semibold">{titulo}</p>
        {descricao && <p className="text-sm text-muted-foreground">{descricao}</p>}
      </div>
      {acao &&
        (acao.href ? (
          <Button asChild variant="outline">
            <Link to={acao.href}>{acao.rotulo}</Link>
          </Button>
        ) : (
          <Button variant="outline" onClick={acao.onClick}>
            {acao.rotulo}
          </Button>
        ))}
      {children}
    </div>
  );
}
