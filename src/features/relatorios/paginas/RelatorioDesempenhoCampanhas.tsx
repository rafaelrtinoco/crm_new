import { useState } from "react";
import { Link } from "react-router-dom";
import { Download, Mail, MessageCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatarDataHoraFuso } from "@/lib/datas";
import { useEmpresaAtual } from "@/features/onboarding/api/useEmpresas";
import { FiltroPeriodo } from "@/features/relatorios/components/FiltroPeriodo";
import { periodoPadrao } from "@/features/relatorios/logica/periodo";
import { exportarXlsx } from "@/features/relatorios/logica/exportarXlsx";
import { useRelatorioDesempenhoCampanhas } from "@/features/relatorios/api/useRelatorios";

export function RelatorioDesempenhoCampanhas() {
  const { atual } = useEmpresaAtual();
  const fuso = atual?.fuso ?? "America/Sao_Paulo";
  const [periodo, setPeriodo] = useState(() => periodoPadrao(fuso));
  const { data: linhas, isLoading } = useRelatorioDesempenhoCampanhas(
    atual?.empresaId ?? null,
    periodo,
  );

  async function exportar() {
    if (!linhas) return;
    await exportarXlsx(
      "desempenho-campanhas.xlsx",
      [
        "Campanha",
        "Canal",
        "Disparada em",
        "Enviados",
        "Bloqueados",
        "Opt-outs",
        "Negócios gerados",
      ],
      linhas.map((linha) => [
        linha.nome,
        linha.canal === "email" ? "E-mail" : "WhatsApp",
        formatarDataHoraFuso(new Date(linha.disparadaEm), fuso),
        linha.enviados,
        linha.bloqueados,
        linha.optouts,
        linha.negociosGerados,
      ]),
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Desempenho de campanhas</h1>
        <Button variant="outline" onClick={exportar} disabled={!linhas || linhas.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          Exportar XLSX
        </Button>
      </div>

      <FiltroPeriodo periodo={periodo} onChange={setPeriodo} />

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

      {!isLoading && linhas && linhas.length === 0 && (
        <EmptyState
          icone={Send}
          titulo="Nenhuma campanha disparada no período"
          descricao="Ajuste o período ou dispare uma campanha pra um segmento salvo."
          acao={{ rotulo: "Ver campanhas", href: "/campanhas" }}
        />
      )}

      {!isLoading && linhas && linhas.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campanha</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Disparada em</TableHead>
              <TableHead className="text-right">Enviados</TableHead>
              <TableHead className="text-right">Bloqueados</TableHead>
              <TableHead className="text-right">Opt-outs</TableHead>
              <TableHead className="text-right">Negócios gerados</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.map((linha) => (
              <TableRow key={linha.campanhaId}>
                <TableCell>
                  <Link
                    to={`/campanhas/${linha.campanhaId}`}
                    className="font-medium hover:underline"
                  >
                    {linha.nome}
                  </Link>
                </TableCell>
                <TableCell>
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    {linha.canal === "email" ? (
                      <Mail className="h-3.5 w-3.5" />
                    ) : (
                      <MessageCircle className="h-3.5 w-3.5" />
                    )}
                    {linha.canal === "email" ? "E-mail" : "WhatsApp"}
                  </span>
                </TableCell>
                <TableCell>{formatarDataHoraFuso(new Date(linha.disparadaEm), fuso)}</TableCell>
                <TableCell className="text-right">{linha.enviados}</TableCell>
                <TableCell className="text-right">{linha.bloqueados}</TableCell>
                <TableCell className="text-right">{linha.optouts}</TableCell>
                <TableCell className="text-right">{linha.negociosGerados}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
