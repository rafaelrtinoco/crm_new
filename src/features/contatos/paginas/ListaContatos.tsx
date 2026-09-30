import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Upload, Users, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
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
import { formatarDataBR, hojeNoFuso, subtrairDias } from "@/lib/datas";
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
const DIAS_PARA_REATIVAR = 90;

/**
 * Filtros "de carteira" que só chegam aqui via link dos cards da tela
 * "Hoje" (`?carteira=...`) — não têm controle próprio na barra de
 * filtros, só um indicador com botão de limpar. Ver
 * `src/features/hoje/components/CardsCarteira.tsx`.
 */
const ROTULO_CARTEIRA: Record<string, string> = {
  novos: "Novos clientes este mês",
  reativar: `Sem contato há mais de ${DIAS_PARA_REATIVAR} dias`,
  "sem-tag": "Sem nenhuma tag",
  "sem-negocio": "Sem negócio aberto",
};

export function ListaContatos() {
  const { atual } = useEmpresaAtual();
  const vocabulario = useVocabulario();
  const [searchParams, setSearchParams] = useSearchParams();
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState(searchParams.get("status") ?? SEM_FILTRO);
  const [temperatura, setTemperatura] = useState(SEM_FILTRO);
  const [tagId, setTagId] = useState(SEM_FILTRO);

  const carteira = searchParams.get("carteira");
  const hoje = useMemo(() => hojeNoFuso(atual?.fuso ?? "America/Sao_Paulo"), [atual?.fuso]);

  const filtrosCarteira: FiltrosContatos = useMemo(() => {
    switch (carteira) {
      case "novos":
        return { criadoDesde: `${hoje.slice(0, 7)}-01` };
      case "reativar":
        return { semContatoDesde: subtrairDias(hoje, DIAS_PARA_REATIVAR) };
      case "sem-tag":
        return { semTag: true };
      case "sem-negocio":
        return { semNegocioAberto: true };
      default:
        return {};
    }
  }, [carteira, hoje]);

  const filtros: FiltrosContatos = {
    busca: busca || undefined,
    status: status === SEM_FILTRO ? undefined : status,
    temperatura: temperatura === SEM_FILTRO ? undefined : temperatura,
    tagId: tagId === SEM_FILTRO ? undefined : tagId,
    ...filtrosCarteira,
  };

  const { data: contatos, isLoading } = useContatos(atual?.empresaId ?? null, filtros);
  const { data: tags } = useTags(atual?.empresaId ?? null);

  function limparFiltroCarteira() {
    setSearchParams((parametrosAtuais) => {
      const novo = new URLSearchParams(parametrosAtuais);
      novo.delete("carteira");
      return novo;
    });
  }

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{vocabulario.contatoPlural}</h1>
        <div className="ml-auto flex items-center gap-2">
          <Button asChild variant="outline">
            <Link to="/contatos/importar">
              <Upload className="mr-2 h-4 w-4" />
              Importar planilha
            </Link>
          </Button>
          <Button asChild>
            <Link to="/contatos/novo">
              <Plus className="mr-2 h-4 w-4" />
              Novo {vocabulario.contato.toLowerCase()}
            </Link>
          </Button>
        </div>
      </div>

      {carteira && ROTULO_CARTEIRA[carteira] && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1.5">
            {ROTULO_CARTEIRA[carteira]}
            <button
              type="button"
              onClick={limparFiltroCarteira}
              className="rounded-full hover:bg-muted-foreground/20"
              aria-label="Limpar filtro"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Buscar por nome, telefone, e-mail ou CPF/CNPJ"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="max-w-xs"
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40 max-w-[180px]">
            <SelectValue className="truncate" placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SEM_FILTRO}>Todos os status</SelectItem>
            <SelectItem value="lead">Lead</SelectItem>
            <SelectItem value="cliente">Cliente</SelectItem>
            <SelectItem value="inativo">Inativo</SelectItem>
          </SelectContent>
        </Select>
        <Select value={temperatura} onValueChange={setTemperatura}>
          <SelectTrigger className="w-40 max-w-[180px]">
            <SelectValue className="truncate" placeholder="Temperatura" />
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
            <SelectTrigger className="w-40 max-w-[180px]">
              <SelectValue className="truncate" placeholder="Tag" />
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
        <EmptyState
          icone={Users}
          titulo={`Nenhum ${vocabulario.contato.toLowerCase()} encontrado`}
          descricao={`Que tal cadastrar o primeiro ${vocabulario.contato.toLowerCase()}?`}
          acao={{ rotulo: `Novo ${vocabulario.contato.toLowerCase()}`, href: "/contatos/novo" }}
        />
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
