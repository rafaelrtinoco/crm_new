import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { ListChecks, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  useAtualizarCampoPersonalizado,
  useCamposPersonalizadosConfig,
  useCriarCampoPersonalizado,
  useExcluirCampoPersonalizado,
  type CampoPersonalizadoConfig,
  type EntidadeCampo,
} from "@/features/configuracoes/api/useCamposPersonalizadosConfig";
import {
  campoPersonalizadoSchema,
  type CampoPersonalizadoFormInput,
} from "@/features/configuracoes/schemas";

const ROTULO_TIPO: Record<CampoPersonalizadoFormInput["tipo"], string> = {
  texto: "Texto",
  numero: "Número",
  data: "Data",
  selecao: "Seleção",
  booleano: "Sim/Não",
};

function DialogoCampo({
  open,
  onOpenChange,
  campo,
  proximaOrdem,
  onSalvar,
  pendente,
}: {
  open: boolean;
  onOpenChange: (aberto: boolean) => void;
  campo: CampoPersonalizadoConfig | null;
  proximaOrdem: number;
  onSalvar: (dados: CampoPersonalizadoFormInput) => Promise<void>;
  pendente: boolean;
}) {
  const {
    control,
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<CampoPersonalizadoFormInput>({
    resolver: zodResolver(campoPersonalizadoSchema),
    defaultValues: {
      chave: "",
      rotulo: "",
      tipo: "texto",
      opcoes: null,
      obrigatorio: false,
      ordem: proximaOrdem,
    },
  });

  useEffect(() => {
    reset({
      chave: campo?.chave ?? "",
      rotulo: campo?.rotulo ?? "",
      tipo: campo?.tipo ?? "texto",
      opcoes: campo?.opcoes ?? null,
      obrigatorio: campo?.obrigatorio ?? false,
      ordem: campo?.ordem ?? proximaOrdem,
    });
  }, [campo, open, proximaOrdem, reset]);

  const tipoAtual = watch("tipo");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{campo ? "Editar campo" : "Novo campo personalizado"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSalvar)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="campo-chave">Chave (identificador interno)</Label>
            <Input id="campo-chave" {...register("chave")} disabled={!!campo} />
            {errors.chave && <p className="text-sm text-destructive">{errors.chave.message}</p>}
            {campo && (
              <p className="text-xs text-muted-foreground">
                A chave não pode ser alterada depois de criada.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="campo-rotulo">Rótulo (o que aparece na tela)</Label>
            <Input id="campo-rotulo" {...register("rotulo")} />
            {errors.rotulo && <p className="text-sm text-destructive">{errors.rotulo.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="campo-tipo">Tipo</Label>
            <Controller
              control={control}
              name="tipo"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="campo-tipo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROTULO_TIPO).map(([valor, rotulo]) => (
                      <SelectItem key={valor} value={valor}>
                        {rotulo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          {tipoAtual === "selecao" && (
            <div className="space-y-1.5">
              <Label htmlFor="campo-opcoes">Opções (separadas por vírgula)</Label>
              <Controller
                control={control}
                name="opcoes"
                render={({ field }) => (
                  <Input
                    id="campo-opcoes"
                    value={(field.value ?? []).join(", ")}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value
                          .split(",")
                          .map((v) => v.trim())
                          .filter((v) => v.length > 0),
                      )
                    }
                  />
                )}
              />
              {errors.opcoes && (
                <p className="text-sm text-destructive">{errors.opcoes.message as string}</p>
              )}
            </div>
          )}
          <div className="flex items-center gap-2">
            <Controller
              control={control}
              name="obrigatorio"
              render={({ field }) => (
                <Checkbox
                  id="campo-obrigatorio"
                  checked={field.value}
                  onCheckedChange={(marcado) => field.onChange(marcado === true)}
                />
              )}
            />
            <Label htmlFor="campo-obrigatorio" className="font-normal">
              Obrigatório
            </Label>
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

/** Campos personalizados — PRD §3.2, por contato ou vencimento (aba `entidade`). */
export function ListaCamposPersonalizados() {
  const { atual } = useEmpresaAtual();
  const empresaId = atual?.empresaId ?? null;
  const [entidade, setEntidade] = useState<EntidadeCampo>("contato");
  const { data: campos, isLoading } = useCamposPersonalizadosConfig(empresaId, entidade);
  const criar = useCriarCampoPersonalizado(empresaId, entidade);
  const atualizar = useAtualizarCampoPersonalizado(empresaId, entidade);
  const excluir = useExcluirCampoPersonalizado(empresaId, entidade);

  const [dialogoAberto, setDialogoAberto] = useState(false);
  const [editando, setEditando] = useState<CampoPersonalizadoConfig | null>(null);
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

  async function salvar(dados: CampoPersonalizadoFormInput) {
    if (editando) {
      await atualizar.mutateAsync({ id: editando.id, dados });
    } else {
      await criar.mutateAsync(dados);
    }
    setDialogoAberto(false);
  }

  async function excluirCampo(id: string) {
    setErroExclusao(null);
    if (!window.confirm("Excluir este campo personalizado?")) return;
    try {
      await excluir.mutateAsync(id);
    } catch (erro) {
      setErroExclusao(erro instanceof Error ? erro.message : "Não foi possível excluir.");
    }
  }

  const proximaOrdem = (campos?.length ?? 0) + 1;

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Campos personalizados</h1>
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

      <Tabs value={entidade} onValueChange={(v) => setEntidade(v as EntidadeCampo)}>
        <TabsList>
          <TabsTrigger value="contato">Contato</TabsTrigger>
          <TabsTrigger value="vencimento">Vencimento</TabsTrigger>
        </TabsList>
      </Tabs>

      {erroExclusao && <p className="text-sm text-destructive">{erroExclusao}</p>}

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

      {!isLoading && campos && campos.length === 0 && (
        <EmptyState
          icone={ListChecks}
          titulo="Nenhum campo personalizado cadastrado"
          descricao="Campos personalizados aparecem no formulário e podem ser usados em segmentos."
          acao={{
            rotulo: "Novo campo",
            onClick: () => {
              setEditando(null);
              setDialogoAberto(true);
            },
          }}
        />
      )}

      {!isLoading && campos && campos.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rótulo</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Obrigatório</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campos.map((campo) => (
              <TableRow key={campo.id}>
                <TableCell>{campo.rotulo}</TableCell>
                <TableCell className="text-muted-foreground">{ROTULO_TIPO[campo.tipo]}</TableCell>
                <TableCell className="text-muted-foreground">
                  {campo.obrigatorio ? "Sim" : "Não"}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditando(campo);
                      setDialogoAberto(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => excluirCampo(campo.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <DialogoCampo
        open={dialogoAberto}
        onOpenChange={setDialogoAberto}
        campo={editando}
        proximaOrdem={proximaOrdem}
        onSalvar={salvar}
        pendente={criar.isPending || atualizar.isPending}
      />
    </main>
  );
}
