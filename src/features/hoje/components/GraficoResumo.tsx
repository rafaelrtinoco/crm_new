import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ResumoNumeros, VencimentoPorSemana } from "@/features/hoje/api/useResumoHoje";

interface Props {
  resumo: ResumoNumeros;
  vencimentosPorSemana: VencimentoPorSemana[];
}

const COR_RENOVADO = "hsl(var(--primary))";
const COR_NAO_RENOVADO = "hsl(var(--urgencia))";

/** Gráficos da tela "Hoje" — vencimentos das próximas semanas e taxa de renovação do mês. */
export function GraficoResumo({ resumo, vencimentosPorSemana }: Props) {
  const temVencimentos = vencimentosPorSemana.some((item) => item.quantidade > 0);
  const dadosRenovacao = [
    { nome: "Renovados", valor: resumo.renovadosMes, cor: COR_RENOVADO },
    { nome: "Não renovados", valor: resumo.naoRenovadosMes, cor: COR_NAO_RENOVADO },
  ];
  const temRenovacao = resumo.renovadosMes + resumo.naoRenovadosMes > 0;

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-sm font-semibold">Vencimentos nas próximas semanas</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {temVencimentos ? (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={vencimentosPorSemana} margin={{ left: -20 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="semana"
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                  stroke="hsl(var(--muted-foreground))"
                />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted))" }}
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    color: "hsl(var(--popover-foreground))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar
                  dataKey="quantidade"
                  name="Vencimentos"
                  fill="hsl(var(--primary))"
                  radius={4}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Nenhum vencimento nos próximos 30 dias.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-sm font-semibold">Taxa de renovação do mês</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4 pt-4">
          {temRenovacao ? (
            <>
              <ResponsiveContainer width={120} height={120}>
                <PieChart>
                  <Pie
                    data={dadosRenovacao}
                    dataKey="valor"
                    nameKey="nome"
                    innerRadius={35}
                    outerRadius={55}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {dadosRenovacao.map((item) => (
                      <Cell key={item.nome} fill={item.cor} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 text-sm">
                <p className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: COR_RENOVADO }}
                  />
                  {resumo.renovadosMes} renovado{resumo.renovadosMes === 1 ? "" : "s"}
                </p>
                <p className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: COR_NAO_RENOVADO }}
                  />
                  {resumo.naoRenovadosMes} não renovado{resumo.naoRenovadosMes === 1 ? "" : "s"}
                </p>
              </div>
            </>
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Nenhum vencimento resolvido este mês ainda.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
