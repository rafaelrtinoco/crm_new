import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { ListChecks, Pencil, Plus, Trash2, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useEmpresaAtual } from "@/features/onboarding/api/useEmpresas";
import { DialogoEtapas } from "@/features/configuracoes/components/DialogoEtapas";
import {
  useAtualizarFunil,
  useCriarFunil,
  useExcluirFunil,
  useFunisConfig,
  type FunilConfig,
} from "@/features/configuracoes/api/useFunisConfig";
import { funilSchema, type FunilFormInput } from "@/features/configuracoes/schemas";

const ROTULO_TIPO_FUNIL: Record<FunilFormInput["tipo"], string> = {
  venda_nova: "Venda nova",
  renovacao: "Renovação",
  personalizado: "Personalizado",
};

function DialogoFunil({
  open,
  onOpenChange,
  funil,
  proximaOrdem,
  onSalvar,
  pendente,
}: {
  open: boolean;
  onOpenChange: (aberto: boolean) => void;
  funil: FunilConfig | null;
  proximaOrdem: number;
  onSalvar: (dados: FunilFormInput) => Promise<void>;
  pendente: boolean;
}) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FunilFormInput>({
    resolver: zodResolver(funilSchema),
    defaultValues: { nome: "", tipo: "personalizado", ordem: proximaOrdem },
  });

  useEffect(() => {
    reset({
      nome: funil?.nome ?? "",
      tipo: funil?.tipo ?? "personalizado",
      ordem: funil?.ordem ?? proximaOrdem,
    });
  }, [funil, open, proximaOrdem, reset]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{funil ? "Editar funil" : "Novo funil"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSalvar)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="funil-nome">Nome</Label>
            <Input id="funil-nome" {...register("nome")} />
            {errors.nome && <p className="text-sm text-destructive">{errors.nome.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="funil-tipo">Tipo</Label>
            <Controller
              control={control}
              name="tipo"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="funil-tipo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROTULO_TIPO_FUNIL).map(([valor, rotulo]) => (
                      <SelectItem key={valor} value={valor}>
                        {rotulo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          {!funil && (
            <p className="text-xs text-muted-foreground">
              As etapas do funil são configuradas depois, pelo botão "Etapas" na lista.
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={pendente}>
              {pendente ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Funis — PRD §6.15/§6.5. Etapas são geridas num Dialog próprio (`DialogoEtapas`), não rota. */
export function ListaFunis() {
  const { atual } = useEmpresaAtual();
  const empresaId = atual?.empresaId ?? null;
  const { data: funis, isLoading } = useFunisConfig(empresaId);
  const criar = useCriarFunil(empresaId);
  const atualizar = useAtualizarFunil(empresaId);
  const excluir = useExcluirFunil(empresaId);

  const [dialogoAberto, setDialogoAberto] = useState(false);
  const [editando, setEditando] = useState<FunilConfig | null>(null);
  const [etapasDoFunil, setEtapasDoFunil] = useState<FunilConfig | null>(null);
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);

  if (atual && atual.papel === "usuario") {
    return (
      <main className="mx-auto max-w-2xl p-4">
        <p className="text-sm text-muted-foreground">
          Só o dono ou um gestor da empresa pode alterar essa configuração.
        </p>
      </main>
    );
  }

  async function salvar(dados: FunilFormInput) {
    if (editando) {
      await atualizar.mutateAsync({ id: editando.id, dados });
    } else {
      await criar.mutateAsync(dados);
    }
    setDialogoAberto(false);
  }

  async function excluirFunil(id: string) {
    setErroExclusao(null);
    if (!window.confirm("Excluir este funil?")) return;
    try {
      await excluir.mutateAsync(id);
    } catch (erro) {
      setErroExclusao(erro instanceof Error ? erro.message : "Não foi possível excluir.");
    }
  }

  const proximaOrdem = (funis?.length ?? 0) + 1;

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Funis</h1>
        <Button
          onClick={() => {
            setEditando(null);
            setDialogoAberto(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Novo
        </Button>
      </div>

      {erroExclusao && <p className="text-sm text-destructive">{erroExclusao}</p>}

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

      {!isLoading && funis && funis.length === 0 && (
        <EmptyState
          icone={Workflow}
          titulo="Nenhum funil cadastrado"
          descricao="Funis organizam negócios em etapas, do lead até o fechamento."
          acao={{
            rotulo: "Novo funil",
            onClick: () => {
              setEditando(null);
              setDialogoAberto(true);
            },
          }}
        />
      )}

      {!isLoading && funis && funis.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {funis.map((funil) => (
              <TableRow key={funil.id}>
                <TableCell>{funil.nome}</TableCell>
                <TableCell className="text-muted-foreground">
                  {ROTULO_TIPO_FUNIL[funil.tipo]}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => setEtapasDoFunil(funil)}>
                    <ListChecks className="mr-1.5 h-4 w-4" />
                    Etapas
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditando(funil);
                      setDialogoAberto(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => excluirFunil(funil.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <DialogoFunil
        open={dialogoAberto}
        onOpenChange={setDialogoAberto}
        funil={editando}
        proximaOrdem={proximaOrdem}
        onSalvar={salvar}
        pendente={criar.isPending || atualizar.isPending}
      />

      <DialogoEtapas
        funilId={etapasDoFunil?.id ?? null}
        funilNome={etapasDoFunil?.nome ?? ""}
        empresaId={empresaId}
        open={!!etapasDoFunil}
        onOpenChange={(aberto) => {
          if (!aberto) setEtapasDoFunil(null);
        }}
      />
    </main>
  );
}
