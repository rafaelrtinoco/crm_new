import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatarDataBR } from "@/lib/datas";
import { formatarBRL } from "@/lib/formatadores";
import { useEmpresaAtual } from "@/features/onboarding/api/useEmpresas";
import { DialogoRenovacao } from "@/features/vencimentos/components/DialogoRenovacao";
import { useVencimento } from "@/features/vencimentos/api/useVencimentos";
import {
  useAtualizarStatusVencimento,
  useExcluirVencimento,
} from "@/features/vencimentos/api/useMutacoesVencimento";

const rotuloStatus: Record<string, string> = {
  pendente: "Pendente",
  em_regua: "Em régua",
  cliente_respondeu: "Cliente respondeu",
  em_negociacao: "Em negociação",
  renovado: "Renovado",
  nao_renovado: "Não renovado",
  cancelado: "Cancelado",
};

const statusFinalizado = new Set(["renovado", "nao_renovado", "cancelado"]);

export function DetalheVencimento() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { atual } = useEmpresaAtual();
  const { data: vencimento, isLoading } = useVencimento(id ?? null);
  const atualizarStatus = useAtualizarStatusVencimento(atual?.empresaId ?? null, id as string);
  const excluirVencimento = useExcluirVencimento(atual?.empresaId ?? null);
  const [dialogoAberto, setDialogoAberto] = useState(false);

  if (!isLoading && !vencimento) return <Navigate to="/vencimentos" replace />;

  async function excluir() {
    if (!id) return;
    if (!window.confirm("Excluir este vencimento? Essa ação não pode ser desfeita.")) return;
    await excluirVencimento.mutateAsync(id);
    navigate("/vencimentos", { replace: true });
  }

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <Link to="/vencimentos" className="text-sm text-muted-foreground hover:underline">
          ← Vencimentos
        </Link>
        {vencimento && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to={`/vencimentos/${id}/editar`}>Editar</Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={excluir}>
              Excluir
            </Button>
          </div>
        )}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

      {vencimento && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-xl">
              <Link to={`/contatos/${vencimento.contatoId}`} className="hover:underline">
                {vencimento.contatoNome}
              </Link>
              <Badge variant="secondary">
                {rotuloStatus[vencimento.status] ?? vencimento.status}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Descrição:</span>{" "}
                {vencimento.descricao || "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Vencimento:</span>{" "}
                {formatarDataBR(vencimento.dataVencimento)}
              </p>
              <p>
                <span className="text-muted-foreground">Valor:</span>{" "}
                {vencimento.valor != null ? formatarBRL(vencimento.valor) : "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Recorrência:</span> {vencimento.recorrencia}
              </p>
            </div>

            {!statusFinalizado.has(vencimento.status) && (
              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
                <Button size="sm" onClick={() => setDialogoAberto(true)}>
                  Marcar como renovado
                </Button>
                <Select
                  onValueChange={(status) => atualizarStatus.mutate(status)}
                  disabled={atualizarStatus.isPending}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Mudar status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="em_regua">Em régua</SelectItem>
                    <SelectItem value="cliente_respondeu">Cliente respondeu</SelectItem>
                    <SelectItem value="em_negociacao">Em negociação</SelectItem>
                    <SelectItem value="nao_renovado">Não renovado</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <DialogoRenovacao
              vencimento={vencimento}
              empresaId={atual?.empresaId ?? null}
              open={dialogoAberto}
              onOpenChange={setDialogoAberto}
              onRenovado={(novoId) => navigate(`/vencimentos/${novoId}`)}
            />
          </CardContent>
        </Card>
      )}
    </main>
  );
}
