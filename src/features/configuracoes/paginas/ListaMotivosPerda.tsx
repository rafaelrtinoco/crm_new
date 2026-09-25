import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Pencil, Plus, Trash2, XCircle } from "lucide-react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useEmpresaAtual } from "@/features/onboarding/api/useEmpresas";
import {
  useAtualizarMotivoPerda,
  useCriarMotivoPerda,
  useExcluirMotivoPerda,
  useMotivosPerdaConfig,
  type MotivoPerdaConfig,
} from "@/features/configuracoes/api/useMotivosPerdaConfig";
import { motivoPerdaSchema, type MotivoPerdaFormInput } from "@/features/configuracoes/schemas";

function DialogoMotivoPerda({
  open,
  onOpenChange,
  motivo,
  onSalvar,
  pendente,
}: {
  open: boolean;
  onOpenChange: (aberto: boolean) => void;
  motivo: MotivoPerdaConfig | null;
  onSalvar: (nome: string) => Promise<void>;
  pendente: boolean;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MotivoPerdaFormInput>({
    resolver: zodResolver(motivoPerdaSchema),
    defaultValues: { nome: "" },
  });

  useEffect(() => {
    reset({ nome: motivo?.nome ?? "" });
  }, [motivo, open, reset]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{motivo ? "Editar motivo de perda" : "Novo motivo de perda"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(async (dados) => onSalvar(dados.nome))} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="motivo-nome">Nome</Label>
            <Input id="motivo-nome" {...register("nome")} />
            {errors.nome && <p className="text-sm text-destructive">{errors.nome.message}</p>}
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

/** Motivos de perda — PRD §6.15/§6.5 (obrigatório ao marcar negócio como perdido). */
export function ListaMotivosPerda() {
  const { atual } = useEmpresaAtual();
  const empresaId = atual?.empresaId ?? null;
  const { data: motivos, isLoading } = useMotivosPerdaConfig(empresaId);
  const criar = useCriarMotivoPerda(empresaId);
  const atualizar = useAtualizarMotivoPerda(empresaId);
  const excluir = useExcluirMotivoPerda(empresaId);

  const [dialogoAberto, setDialogoAberto] = useState(false);
  const [editando, setEditando] = useState<MotivoPerdaConfig | null>(null);
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

  async function salvar(nome: string) {
    if (editando) {
      await atualizar.mutateAsync({ id: editando.id, nome });
    } else {
      await criar.mutateAsync(nome);
    }
    setDialogoAberto(false);
  }

  async function excluirMotivo(id: string) {
    setErroExclusao(null);
    if (!window.confirm("Excluir este motivo de perda?")) return;
    try {
      await excluir.mutateAsync(id);
    } catch (erro) {
      setErroExclusao(erro instanceof Error ? erro.message : "Não foi possível excluir.");
    }
  }

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Motivos de perda</h1>
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

      {!isLoading && motivos && motivos.length === 0 && (
        <EmptyState
          icone={XCircle}
          titulo="Nenhum motivo de perda cadastrado"
          descricao="Motivos de perda são obrigatórios ao marcar um negócio como perdido."
          acao={{
            rotulo: "Novo motivo",
            onClick: () => {
              setEditando(null);
              setDialogoAberto(true);
            },
          }}
        />
      )}

      {!isLoading && motivos && motivos.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {motivos.map((motivo) => (
              <TableRow key={motivo.id}>
                <TableCell>{motivo.nome}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditando(motivo);
                      setDialogoAberto(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => excluirMotivo(motivo.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <DialogoMotivoPerda
        open={dialogoAberto}
        onOpenChange={setDialogoAberto}
        motivo={editando}
        onSalvar={salvar}
        pendente={criar.isPending || atualizar.isPending}
      />
    </main>
  );
}
