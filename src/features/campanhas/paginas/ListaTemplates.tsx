import { Link } from "react-router-dom";
import { FileText, Plus } from "lucide-react";
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
import {
  useAprovarTemplate,
  useExcluirTemplate,
  useTemplates,
} from "@/features/campanhas/api/useTemplates";

export function ListaTemplates() {
  const { atual } = useEmpresaAtual();
  const empresaId = atual?.empresaId ?? null;
  const { data: templates, isLoading } = useTemplates(empresaId);
  const excluirTemplate = useExcluirTemplate(empresaId);

  async function excluir(id: string, nome: string) {
    if (!window.confirm(`Excluir o template "${nome}"? Essa ação não pode ser desfeita.`)) return;
    await excluirTemplate.mutateAsync(id);
  }

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Templates de mensagem</h1>
        <Button asChild>
          <Link to="/campanhas/templates/novo">
            <Plus className="mr-2 h-4 w-4" />
            Novo template
          </Link>
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

      {!isLoading && templates && templates.length === 0 && (
        <EmptyState
          icone={FileText}
          titulo="Nenhum template criado"
          descricao="Templates de WhatsApp precisam de aprovação antes de entrar numa campanha."
          acao={{ rotulo: "Novo template", href: "/campanhas/templates/novo" }}
        />
      )}

      {!isLoading && templates && templates.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((template) => (
              <LinhaTemplate
                key={template.id}
                template={template}
                empresaId={empresaId}
                onExcluir={() => excluir(template.id, template.nome)}
              />
            ))}
          </TableBody>
        </Table>
      )}
    </main>
  );
}

function LinhaTemplate({
  template,
  empresaId,
  onExcluir,
}: {
  template: { id: string; nome: string; canal: string; status: string };
  empresaId: string | null;
  onExcluir: () => void;
}) {
  const aprovarTemplate = useAprovarTemplate(empresaId, template.id);

  return (
    <TableRow>
      <TableCell>
        <Link
          to={`/campanhas/templates/${template.id}/editar`}
          className="font-medium hover:underline"
        >
          {template.nome}
        </Link>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {template.canal === "email" ? "E-mail" : "WhatsApp"}
      </TableCell>
      <TableCell>
        <Badge variant={template.status === "aprovado" ? "success" : "outline"}>
          {template.status === "aprovado" ? "Aprovado" : "Rascunho"}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        {template.canal === "whatsapp" && template.status === "rascunho" && (
          <Button
            variant="ghost"
            size="sm"
            disabled={aprovarTemplate.isPending}
            onClick={() => aprovarTemplate.mutate()}
          >
            Aprovar
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onExcluir}>
          Excluir
        </Button>
      </TableCell>
    </TableRow>
  );
}
