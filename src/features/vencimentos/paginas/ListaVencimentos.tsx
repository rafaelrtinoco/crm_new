import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatarDataBR } from "@/lib/datas";
import { formatarBRL } from "@/lib/formatadores";
import { useVocabulario } from "@/lib/vocabulario";
import { useEmpresaAtual } from "@/features/onboarding/api/useEmpresas";
import { useVencimentoTipos } from "@/features/vencimentos/api/useVencimentoTipos";
import { useVencimentos, type FiltrosVencimentos } from "@/features/vencimentos/api/useVencimentos";

const rotuloStatus: Record<string, string> = {
  pendente: "Pendente",
  em_regua: "Em régua",
  cliente_respondeu: "Cliente respondeu",
  em_negociacao: "Em negociação",
  renovado: "Renovado",
  nao_renovado: "Não renovado",
  cancelado: "Cancelado",
};

const SEM_FILTRO = "todos";

export function ListaVencimentos() {
  const { atual } = useEmpresaAtual();
  const vocabulario = useVocabulario();
  const [status, setStatus] = useState(SEM_FILTRO);
  const [tipoId, setTipoId] = useState(SEM_FILTRO);

  const filtros: FiltrosVencimentos = {
    status: status === SEM_FILTRO ? undefined : status,
    vencimentoTipoId: tipoId === SEM_FILTRO ? undefined : tipoId,
  };

  const { data: vencimentos, isLoading } = useVencimentos(atual?.empresaId ?? null, filtros);
  const { data: tipos } = useVencimentoTipos(atual?.empresaId ?? null);

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{vocabulario.vencimentoPlural}</h1>
        <Button asChild>
          <Link to="/vencimentos/novo">Novo {vocabulario.vencimento.toLowerCase()}</Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SEM_FILTRO}>Todos os status</SelectItem>
            {Object.entries(rotuloStatus).map(([valor, rotulo]) => (
              <SelectItem key={valor} value={valor}>
                {rotulo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {tipos && tipos.length > 0 && (
          <Select value={tipoId} onValueChange={setTipoId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SEM_FILTRO}>Qualquer tipo</SelectItem>
              {tipos.map((tipo) => (
                <SelectItem key={tipo.id} value={tipo.id}>
                  {tipo.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

      {!isLoading && vencimentos && vencimentos.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhum {vocabulario.vencimento.toLowerCase()} encontrado.
        </p>
      )}

      {!isLoading && vencimentos && vencimentos.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contato</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vencimentos.map((vencimento) => (
              <TableRow key={vencimento.id}>
                <TableCell>
                  <Link
                    to={`/vencimentos/${vencimento.id}`}
                    className="font-medium hover:underline"
                  >
                    {vencimento.contatoNome}
                  </Link>
                </TableCell>
                <TableCell>{vencimento.descricao || "—"}</TableCell>
                <TableCell>{formatarDataBR(vencimento.dataVencimento)}</TableCell>
                <TableCell>
                  {vencimento.valor != null ? formatarBRL(vencimento.valor) : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {rotuloStatus[vencimento.status] ?? vencimento.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
