import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ResumoNumeros } from "@/features/hoje/api/useResumoHoje";

interface Props {
  resumo: ResumoNumeros;
}

/** Cards resumidos abaixo da lista de ações (PRD §6.2). */
export function CardsResumo({ resumo }: Props) {
  const itens = [
    { rotulo: "Leads na semana", valor: String(resumo.leadsNaSemana) },
    { rotulo: "Negócios em aberto", valor: String(resumo.negociosAbertos) },
    { rotulo: "Vencimentos em 30 dias", valor: String(resumo.vencimentosProximos30Dias) },
    {
      rotulo: "Taxa de renovação do mês",
      valor:
        resumo.taxaRenovacaoMes != null ? `${Math.round(resumo.taxaRenovacaoMes * 100)}%` : "—",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {itens.map((item) => (
        <Card key={item.rotulo}>
          <CardHeader className="pb-1">
            <CardTitle className="font-display text-2xl font-normal">{item.valor}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">{item.rotulo}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
