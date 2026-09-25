import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { CalendarClock, Pencil, Plus, Trash2 } from "lucide-react";
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
import {
  useAtualizarVencimentoTipo,
  useCriarVencimentoTipo,
  useExcluirVencimentoTipo,
  useVencimentoTiposConfig,
  type VencimentoTipoConfig,
} from "@/features/configuracoes/api/useVencimentoTiposConfig";
import {
  vencimentoTipoSchema,
  type VencimentoTipoFormInput,
} from "@/features/configuracoes/schemas";

const ROTULO_RECORRENCIA: Record<VencimentoTipoFormInput["recorrenciaPadrao"], string> = {
  unica: "Única",
  mensal: "Mensal",
  anual: "Anual",
  personalizada: "Personalizada",
};

function DialogoVencimentoTipo({
  open,
  onOpenChange,
  tipo,
  onSalvar,
  pendente,
}: {
  open: boolean;
  onOpenChange: (aberto: boolean) => void;
  tipo: VencimentoTipoConfig | null;
  onSalvar: (dados: VencimentoTipoFormInput) => Promise<void>;
  pendente: boolean;
}) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<VencimentoTipoFormInput>({
    resolver: zodResolver(vencimentoTipoSchema),
    defaultValues: { nome: "", recorrenciaPadrao: "anual" },
  });

  useEffect(() => {
    reset({ nome: tipo?.nome ?? "", recorrenciaPadrao: tipo?.recorrenciaPadrao ?? "anual" });
  }, [tipo, open, reset]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {tipo ? "Editar tipo de vencimento" : "Novo tipo de vencimento"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSalvar)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tipo-nome">Nome</Label>
            <Input id="tipo-nome" {...register("nome")} />
            {errors.nome && <p className="text-sm text-destructive">{errors.nome.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tipo-recorrencia">Recorrência padrão</Label>
            <Controller
              control={control}
              name="recorrenciaPadrao"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="tipo-recorrencia">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROTULO_RECORRENCIA).map(([valor, rotulo]) => (
                      <SelectItem key={valor} value={valor}>
                        {rotulo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
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

/** Tipos de vencimento — PRD §6.15/§6.4 (usados ao cadastrar um vencimento). */
export function ListaVencimentoTipos() {
  const { atual } = useEmpresaAtual();
  const empresaId = atual?.empresaId ?? null;
  const { data: tipos, isLoading } = useVencimentoTiposConfig(empresaId);
  const criar = useCriarVencimentoTipo(empresaId);
  const atualizar = useAtualizarVencimentoTipo(empresaId);
  const excluir = useExcluirVencimentoTipo(empresaId);

  const [dialogoAberto, setDialogoAberto] = useState(false);
  const [editando, setEditando] = useState<VencimentoTipoConfig | null>(null);
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

  async function salvar(dados: VencimentoTipoFormInput) {
    if (editando) {
      await atualizar.mutateAsync({ id: editando.id, dados });
    } else {
      await criar.mutateAsync(dados);
    }
    setDialogoAberto(false);
  }

  async function excluirTipo(id: string) {
    setErroExclusao(null);
    if (!window.confirm("Excluir este tipo de vencimento?")) return;
    try {
      await excluir.mutateAsync(id);
    } catch (erro) {
      setErroExclusao(erro instanceof Error ? erro.message : "Não foi possível excluir.");
    }
  }

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Tipos de vencimento</h1>
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

      {!isLoading && tipos && tipos.length === 0 && (
        <EmptyState
          icone={CalendarClock}
          titulo="Nenhum tipo de vencimento cadastrado"
          descricao="Tipos de vencimento organizam o que vence — seguro, contrato, licença."
          acao={{
            rotulo: "Novo tipo",
            onClick: () => {
              setEditando(null);
              setDialogoAberto(true);
            },
          }}
        />
      )}

      {!isLoading && tipos && tipos.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Recorrência padrão</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tipos.map((tipo) => (
              <TableRow key={tipo.id}>
                <TableCell>{tipo.nome}</TableCell>
                <TableCell className="text-muted-foreground">
                  {ROTULO_RECORRENCIA[tipo.recorrenciaPadrao]}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditando(tipo);
                      setDialogoAberto(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => excluirTipo(tipo.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <DialogoVencimentoTipo
        open={dialogoAberto}
        onOpenChange={setDialogoAberto}
        tipo={editando}
        onSalvar={salvar}
        pendente={criar.isPending || atualizar.isPending}
      />
    </main>
  );
}
