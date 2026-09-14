import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { formatarTelefone } from "@/lib/formatadores";
import { useVocabulario } from "@/lib/vocabulario";
import { useEmpresaAtual } from "@/features/onboarding/api/useEmpresas";
import { useContatos, type FiltrosContatos } from "@/features/contatos/api/useContatos";
import { useTags } from "@/features/contatos/api/useTags";

const rotuloStatus: Record<string, string> = {
  lead: "Lead",
  cliente: "Cliente",
  inativo: "Inativo",
};
const rotuloTemperatura: Record<string, string> = {
  quente: "Quente",
  morno: "Morno",
  frio: "Frio",
};

const SEM_FILTRO = "todos";

export function ListaContatos() {
  const { atual } = useEmpresaAtual();
  const vocabulario = useVocabulario();
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState(SEM_FILTRO);
  const [temperatura, setTemperatura] = useState(SEM_FILTRO);
  const [tagId, setTagId] = useState(SEM_FILTRO);

  const filtros: FiltrosContatos = {
    busca: busca || undefined,
    status: status === SEM_FILTRO ? undefined : status,
    temperatura: temperatura === SEM_FILTRO ? undefined : temperatura,
    tagId: tagId === SEM_FILTRO ? undefined : tagId,
  };

  const { data: contatos, isLoading } = useContatos(atual?.empresaId ?? null, filtros);
  const { data: tags } = useTags(atual?.empresaId ?? null);

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{vocabulario.contatoPlural}</h1>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/contatos/importar">Importar planilha</Link>
          </Button>
          <Button asChild>
            <Link to="/contatos/novo">Novo {vocabulario.contato.toLowerCase()}</Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Buscar por nome, telefone, e-mail ou CPF/CNPJ"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="max-w-xs"
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SEM_FILTRO}>Todos os status</SelectItem>
            <SelectItem value="lead">Lead</SelectItem>
            <SelectItem value="cliente">Cliente</SelectItem>
            <SelectItem value="inativo">Inativo</SelectItem>
          </SelectContent>
        </Select>
        <Select value={temperatura} onValueChange={setTemperatura}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Temperatura" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SEM_FILTRO}>Qualquer temperatura</SelectItem>
            <SelectItem value="quente">Quente</SelectItem>
            <SelectItem value="morno">Morno</SelectItem>
            <SelectItem value="frio">Frio</SelectItem>
          </SelectContent>
        </Select>
        {tags && tags.length > 0 && (
          <Select value={tagId} onValueChange={setTagId}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Tag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SEM_FILTRO}>Qualquer tag</SelectItem>
              {tags.map((tag) => (
                <SelectItem key={tag.id} value={tag.id}>
                  {tag.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

      {!isLoading && contatos && contatos.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhum {vocabulario.contato.toLowerCase()} encontrado. Que tal cadastrar o primeiro?
        </p>
      )}

      {!isLoading && contatos && contatos.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Temperatura</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Último contato</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contatos.map((contato) => (
              <TableRow key={contato.id} className="cursor-pointer">
                <TableCell>
                  <Link to={`/contatos/${contato.id}`} className="font-medium hover:underline">
                    {contato.nome}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {rotuloStatus[contato.status] ?? contato.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {contato.temperatura ? (
                    <Badge variant="outline">{rotuloTemperatura[contato.temperatura]}</Badge>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>{contato.telefone ? formatarTelefone(contato.telefone) : "—"}</TableCell>
                <TableCell>
                  {contato.ultimoContatoEm
                    ? formatarDataBR(contato.ultimoContatoEm.slice(0, 10))
                    : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
