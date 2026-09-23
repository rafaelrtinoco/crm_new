import { useState } from "react";
import { Link } from "react-router-dom";
import { LayoutTemplate, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
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
  useDefinirSlugEmpresa,
  useExcluirPaginaCaptura,
  usePaginasCaptura,
} from "@/features/captura/api/usePaginasCaptura";

function ConfiguracaoSlug({ slugAtual }: { slugAtual: string | null }) {
  const { atual } = useEmpresaAtual();
  const [slug, setSlug] = useState(slugAtual ?? "");
  const definirSlug = useDefinirSlugEmpresa(atual?.empresaId ?? null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">URL pública da empresa</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">
          É essa parte da URL que aparece em toda página de captura:{" "}
          <code>/p/{slug || "sua-empresa"}/…</code>
        </p>
        <div className="flex items-center gap-2">
          <Input
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
            placeholder="sua-empresa"
            className="max-w-xs"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!slug || slug === slugAtual || definirSlug.isPending}
            onClick={() => definirSlug.mutate(slug)}
          >
            Salvar
          </Button>
        </div>
        {definirSlug.isError && (
          <p className="text-sm text-destructive">
            Não foi possível salvar — talvez essa URL já esteja em uso por outra empresa.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function ListaPaginasCaptura() {
  const { atual } = useEmpresaAtual();
  const empresaId = atual?.empresaId ?? null;
  const { data: paginas, isLoading } = usePaginasCaptura(empresaId);
  const excluirPagina = useExcluirPaginaCaptura(empresaId);

  async function excluir(id: string, titulo: string) {
    if (!window.confirm(`Excluir a página "${titulo}"? Essa ação não pode ser desfeita.`)) return;
    await excluirPagina.mutateAsync(id);
  }

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Páginas de captura</h1>
        <Button asChild>
          <Link to="/captura/paginas/novo">
            <Plus className="mr-2 h-4 w-4" />
            Nova página
          </Link>
        </Button>
      </div>

      <ConfiguracaoSlug slugAtual={atual?.slug ?? null} />

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

      {!isLoading && paginas && paginas.length === 0 && (
        <EmptyState
          icone={LayoutTemplate}
          titulo="Nenhuma página de captura criada"
          descricao="Crie uma página pública com a marca da sua empresa pra receber leads de anúncios ou redes sociais."
          acao={{ rotulo: "Nova página", href: "/captura/paginas/novo" }}
        />
      )}

      {!isLoading && paginas && paginas.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>URL</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginas.map((pagina) => (
              <TableRow key={pagina.id}>
                <TableCell>
                  <Link
                    to={`/captura/paginas/${pagina.id}/editar`}
                    className="font-medium hover:underline"
                  >
                    {pagina.titulo}
                  </Link>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  /p/{atual?.slug ?? "…"}/{pagina.slug}
                </TableCell>
                <TableCell>
                  <Badge variant={pagina.ativo ? "success" : "outline"}>
                    {pagina.ativo ? "Ativa" : "Inativa"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => excluir(pagina.id, pagina.titulo)}
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
