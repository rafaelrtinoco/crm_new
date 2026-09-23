import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMetricasCampanha } from "@/features/campanhas/api/useCampanhas";

interface CardMetricasCampanhaProps {
  campanhaId: string;
}

function Metrica({
  rotulo,
  valor,
  indisponivel,
}: {
  rotulo: string;
  valor: number;
  indisponivel?: boolean;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {rotulo}
      </p>
      <p className="text-2xl font-extrabold tracking-tight">{indisponivel ? "—" : valor}</p>
    </div>
  );
}

/**
 * `entregues`/`lidos` sempre aparecem como "—", não "0" — é uma
 * limitação do provider mock (ADR 0005), não um fato ("zero entregues"
 * seria uma afirmação falsa sobre mensagens que nem foram checadas).
 */
export function CardMetricasCampanha({ campanhaId }: CardMetricasCampanhaProps) {
  const { data: metricas, isLoading } = useMetricasCampanha(campanhaId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Métricas</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {metricas && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Metrica rotulo="Enviados" valor={metricas.enviados} />
            <Metrica rotulo="Entregues" valor={metricas.entregues} indisponivel />
            <Metrica rotulo="Lidos" valor={metricas.lidos} indisponivel />
            <Metrica rotulo="Bloqueados" valor={metricas.bloqueados} />
            <Metrica rotulo="Opt-outs" valor={metricas.optouts} />
            <Metrica rotulo="Negócios gerados" valor={metricas.negociosGerados} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
