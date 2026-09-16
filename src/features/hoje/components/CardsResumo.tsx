import { CalendarClock, Percent, Users, Workflow } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { ResumoNumeros } from "@/features/hoje/api/useResumoHoje";

interface Props {
  resumo: ResumoNumeros;
}

/** Cards resumidos no topo da tela "Hoje" (PRD §6.2) — ver docs/design-system.md. */
export function CardsResumo({ resumo }: Props) {
  const itens = [
    { rotulo: "Leads na semana", valor: String(resumo.leadsNaSemana), Icone: Users },
    { rotulo: "Negócios em aberto", valor: String(resumo.negociosAbertos), Icone: Workflow },
    {
      rotulo: "Vencimentos em 30 dias",
      valor: String(resumo.vencimentosProximos30Dias),
      Icone: CalendarClock,
    },
    {
      rotulo: "Taxa de renovação do mês",
      valor:
        resumo.taxaRenovacaoMes != null ? `${Math.round(resumo.taxaRenovacaoMes * 100)}%` : "—",
      Icone: Percent,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {itens.map((item) => (
        <Card key={item.rotulo} variant="destaque">
          <CardContent className="space-y-3 p-5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <item.Icone className="h-4 w-4" />
            </span>
            <p className="font-display text-2xl font-extrabold leading-none tracking-[-0.02em]">
              {item.valor}
            </p>
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              {item.rotulo}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
