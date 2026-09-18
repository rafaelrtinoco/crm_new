import { Link } from "react-router-dom";
import { Plus, Users2 } from "lucide-react";
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
import { useVocabulario } from "@/lib/vocabulario";
import { useEmpresaAtual } from "@/features/onboarding/api/useEmpresas";
import { useExcluirSegmento, useSegmentos } from "@/features/segmentos/api/useSegmentos";
import { ContagemSegmentoSalvo } from "@/features/segmentos/components/ContagemSegmentoSalvo";

export function ListaSegmentos() {
  const { atual } = useEmpresaAtual();
  const vocabulario = useVocabulario();
  const { data: segmentos, isLoading } = useSegmentos(atual?.empresaId ?? null);
  const excluirSegmento = useExcluirSegmento(atual?.empresaId ?? null);

  async function excluir(id: string, nome: string) {
    if (!window.confirm(`Excluir o segmento "${nome}"? Essa ação não pode ser desfeita.`)) return;
    await excluirSegmento.mutateAsync(id);
  }

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Segmentos</h1>
        <Button asChild>
          <Link to="/segmentos/novo">
            <Plus className="mr-2 h-4 w-4" />
            Novo segmento
          </Link>
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

      {!isLoading && segmentos && segmentos.length === 0 && (
        <EmptyState
          icone={Users2}
          titulo="Nenhum segmento criado"
          descricao={`Crie um segmento pra filtrar ${vocabulario.contatoPlural.toLowerCase()} por status, tags, origem e outros critérios.`}
          acao={{ rotulo: "Novo segmento", href: "/segmentos/novo" }}
        />
      )}

      {!isLoading && segmentos && segmentos.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Regras</TableHead>
              <TableHead>{vocabulario.contatoPlural}</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {segmentos.map((segmento) => (
              <TableRow key={segmento.id}>
                <TableCell>
                  <Link
                    to={`/segmentos/${segmento.id}/editar`}
                    className="font-medium hover:underline"
                  >
                    {segmento.nome}
                  </Link>
                </TableCell>
                <TableCell>{segmento.regras.length}</TableCell>
                <TableCell>
                  <ContagemSegmentoSalvo segmentoId={segmento.id} />
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => excluir(segmento.id, segmento.nome)}
                  >
                    Excluir
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
