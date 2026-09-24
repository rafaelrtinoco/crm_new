import { useState } from "react";
import { Download, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useEmpresaAtual } from "@/features/onboarding/api/useEmpresas";
import { FiltroPeriodo } from "@/features/relatorios/components/FiltroPeriodo";
import { periodoPadrao } from "@/features/relatorios/logica/periodo";
import { exportarXlsx } from "@/features/relatorios/logica/exportarXlsx";
import { useRelatorioLeadsPorOrigem } from "@/features/relatorios/api/useRelatorios";

function formatarTaxa(taxa: number): string {
  return `${(taxa * 100).toFixed(1)}%`;
}

export function RelatorioLeadsOrigem() {
  const { atual } = useEmpresaAtual();
  const [periodo, setPeriodo] = useState(() => periodoPadrao(atual?.fuso ?? "America/Sao_Paulo"));
  const { data: linhas, isLoading } = useRelatorioLeadsPorOrigem(atual?.empresaId ?? null, periodo);

  async function exportar() {
    if (!linhas) return;
    await exportarXlsx(
      "leads-por-origem.xlsx",
      ["Origem", "Campanha (UTM)", "Total de leads", "Convertidos", "Taxa de conversão"],
      linhas.map((linha) => [
        linha.origem ?? "—",
        linha.utmCampaign ?? "—",
        linha.totalLeads,
        linha.convertidos,
        formatarTaxa(linha.taxaConversao),
      ]),
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Leads por origem</h1>
        <Button variant="outline" onClick={exportar} disabled={!linhas || linhas.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          Exportar XLSX
        </Button>
      </div>

      <FiltroPeriodo periodo={periodo} onChange={setPeriodo} />

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

      {!isLoading && linhas && linhas.length === 0 && (
        <EmptyState
          icone={TrendingUp}
          titulo="Nenhum lead no período"
          descricao="Ajuste o período ou aguarde novos leads entrarem por formulário, página de captura ou webhook."
        />
      )}

      {!isLoading && linhas && linhas.length > 0 && (
        <>
          <Card variant="destaque">
            <CardHeader className="pb-0">
              <CardTitle className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                Leads por origem
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={linhas} margin={{ left: -20 }}>
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="origem"
                    tickFormatter={(valor: string | null) => valor ?? "Sem origem"}
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
                    labelFormatter={(valor) => (valor ? String(valor) : "Sem origem")}
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      color: "hsl(var(--popover-foreground))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar
                    dataKey="totalLeads"
                    name="Total de leads"
                    fill="hsl(var(--primary))"
                    radius={4}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Origem</TableHead>
                <TableHead>Campanha (UTM)</TableHead>
                <TableHead className="text-right">Total de leads</TableHead>
                <TableHead className="text-right">Convertidos</TableHead>
                <TableHead className="text-right">Taxa de conversão</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((linha) => (
                <TableRow key={`${linha.origem ?? "sem-origem"}-${linha.utmCampaign ?? "sem-utm"}`}>
                  <TableCell>{linha.origem ?? "—"}</TableCell>
                  <TableCell>{linha.utmCampaign ?? "—"}</TableCell>
                  <TableCell className="text-right">{linha.totalLeads}</TableCell>
                  <TableCell className="text-right">{linha.convertidos}</TableCell>
                  <TableCell className="text-right">{formatarTaxa(linha.taxaConversao)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </main>
  );
}
