import { Link } from "react-router-dom";
import { Mail, MessageCircle, Plus, Send } from "lucide-react";
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
import { useCampanhas, type StatusCampanha } from "@/features/campanhas/api/useCampanhas";

const ROTULO_STATUS: Record<StatusCampanha, string> = {
  rascunho: "Rascunho",
  agendada: "Agendada",
  enviando: "Enviando",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

const VARIANTE_STATUS: Record<
  StatusCampanha,
  "outline" | "info" | "warning" | "success" | "destructive"
> = {
  rascunho: "outline",
  agendada: "info",
  enviando: "warning",
  concluida: "success",
  cancelada: "destructive",
};

export function ListaCampanhas() {
  const { atual } = useEmpresaAtual();
  const { data: campanhas, isLoading } = useCampanhas(atual?.empresaId ?? null);

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Campanhas</h1>
        <Button asChild>
          <Link to="/campanhas/novo">
            <Plus className="mr-2 h-4 w-4" />
            Nova campanha
          </Link>
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

      {!isLoading && campanhas && campanhas.length === 0 && (
        <EmptyState
          icone={Send}
          titulo="Nenhuma campanha criada"
          descricao="Crie uma campanha pra disparar mensagem em massa pra um segmento salvo."
          acao={{ rotulo: "Nova campanha", href: "/campanhas/novo" }}
        />
      )}

      {!isLoading && campanhas && campanhas.length > 0 && (
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
            {campanhas.map((campanha) => (
              <TableRow key={campanha.id}>
                <TableCell>
                  <Link to={`/campanhas/${campanha.id}`} className="font-medium hover:underline">
                    {campanha.nome}
                  </Link>
                </TableCell>
                <TableCell>
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    {campanha.canal === "email" ? (
                      <Mail className="h-3.5 w-3.5" />
                    ) : (
                      <MessageCircle className="h-3.5 w-3.5" />
                    )}
                    {campanha.canal === "email" ? "E-mail" : "WhatsApp"}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant={VARIANTE_STATUS[campanha.status]}>
                    {ROTULO_STATUS[campanha.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button asChild variant="ghost" size="sm">
                    <Link to={`/campanhas/${campanha.id}`}>Ver</Link>
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
