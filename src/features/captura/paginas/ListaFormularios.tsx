import { Link } from "react-router-dom";
import { ClipboardList, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { useEmpresaAtual } from "@/features/onboarding/api/useEmpresas";
import { useExcluirFormulario, useFormularios } from "@/features/captura/api/useFormularios";

export function ListaFormularios() {
  const { atual } = useEmpresaAtual();
  const empresaId = atual?.empresaId ?? null;
  const { data: formularios, isLoading } = useFormularios(empresaId);
  const excluirFormulario = useExcluirFormulario(empresaId);

  async function excluir(id: string, nome: string) {
    if (!window.confirm(`Excluir o formulário "${nome}"? Essa ação não pode ser desfeita.`)) return;
    await excluirFormulario.mutateAsync(id);
  }

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Formulários de captura</h1>
        <Button asChild>
          <Link to="/captura/formularios/novo">
            <Plus className="mr-2 h-4 w-4" />
            Novo formulário
          </Link>
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

      {!isLoading && formularios && formularios.length === 0 && (
        <EmptyState
          icone={ClipboardList}
          titulo="Nenhum formulário criado"
          descricao="Crie um formulário pra embutir no seu site ou numa página de captura — cada envio já entra como lead, distribuído pro responsável certo."
          acao={{ rotulo: "Novo formulário", href: "/captura/formularios/novo" }}
        />
      )}

      {!isLoading && formularios && formularios.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Distribuição</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {formularios.map((formulario) => (
              <TableRow key={formulario.id}>
                <TableCell>
                  <Link
                    to={`/captura/formularios/${formulario.id}/editar`}
                    className="font-medium hover:underline"
                  >
                    {formulario.nome}
                  </Link>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formulario.distribuicaoTipo === "rodizio" ? "Rodízio" : "Fixo"}
                </TableCell>
                <TableCell>
                  <Badge variant={formulario.ativo ? "success" : "outline"}>
                    {formulario.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => excluir(formulario.id, formulario.nome)}
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
