import { Check } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { PrimeirosPassos } from "@/features/hoje/api/useResumoHoje";

interface Props {
  passos: PrimeirosPassos;
}

const itens = [
  { chave: "importouContatos" as const, rotulo: "Importar contatos", rota: "/contatos/importar" },
  {
    chave: "cadastrouVencimento" as const,
    rotulo: "Cadastrar um vencimento",
    rota: "/vencimentos/novo",
  },
  { chave: "convidouEquipe" as const, rotulo: "Convidar a equipe", rota: "/convidar" },
];

/**
 * Checklist "Primeiros passos" (PRD §6.1), adiado do 1B pro 1D. Só os 3
 * itens viáveis na Fase 1 — WhatsApp/régua entram quando a Fase 2 existir.
 * Some da tela assim que os 3 estiverem completos.
 */
export function BarraPrimeirosPassos({ passos }: Props) {
  if (passos.completo) return null;

  const concluidos = itens.filter((item) => passos[item.chave]).length;

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
          Primeiros passos
        </h2>
        <span className="text-xs text-muted-foreground">
          {concluidos}/{itens.length}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${(concluidos / itens.length) * 100}%` }}
        />
      </div>
      <ul className="grid gap-2 sm:grid-cols-3">
        {itens.map((item) => {
          const feito = passos[item.chave];
          return (
            <li key={item.chave}>
              {feito ? (
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 text-primary" />
                  <span className="line-through">{item.rotulo}</span>
                </span>
              ) : (
                <Link
                  to={item.rota}
                  className={cn(
                    "flex items-center gap-1.5 text-sm font-medium text-primary hover:underline",
                  )}
                >
                  {item.rotulo}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
