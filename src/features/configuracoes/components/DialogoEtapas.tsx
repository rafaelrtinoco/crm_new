import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  useAtualizarEtapa,
  useCriarEtapa,
  useEtapasConfig,
  useExcluirEtapa,
  type EtapaConfig,
} from "@/features/configuracoes/api/useFunisConfig";
import { etapaSchema, type EtapaFormInput } from "@/features/configuracoes/schemas";

const ROTULO_TIPO_ETAPA: Record<EtapaFormInput["tipo"], string> = {
  normal: "Normal",
  ganho: "Ganho (especial)",
  perdido: "Perdido (especial)",
};

function FormularioEtapa({
  etapa,
  proximaOrdem,
  onSalvar,
  onCancelar,
  pendente,
}: {
  etapa: EtapaConfig | null;
  proximaOrdem: number;
  onSalvar: (dados: EtapaFormInput) => Promise<void>;
  onCancelar: () => void;
  pendente: boolean;
}) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EtapaFormInput>({
    resolver: zodResolver(etapaSchema),
    defaultValues: {
      nome: etapa?.nome ?? "",
      tipo: etapa?.tipo ?? "normal",
      ordem: etapa?.ordem ?? proximaOrdem,
    },
  });

  useEffect(() => {
    reset({
      nome: etapa?.nome ?? "",
      tipo: etapa?.tipo ?? "normal",
      ordem: etapa?.ordem ?? proximaOrdem,
    });
  }, [etapa, proximaOrdem, reset]);

  return (
    <form onSubmit={handleSubmit(onSalvar)} className="space-y-3 rounded-md border p-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="etapa-nome">Nome</Label>
          <Input id="etapa-nome" {...register("nome")} />
          {errors.nome && <p className="text-xs text-destructive">{errors.nome.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="etapa-tipo">Tipo</Label>
          <Controller
            control={control}
            name="tipo"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="etapa-tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROTULO_TIPO_ETAPA).map(([valor, rotulo]) => (
                    <SelectItem key={valor} value={valor}>
                      {rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Etapas "ganho"/"perdido" movem o card automaticamente quando o negócio é marcado como ganho
        ou perdido — funcione bem com no máximo uma de cada por funil.
      </p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancelar}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={pendente}>
          {pendente ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </form>
  );
}

/** Etapas de um funil — Dialog próprio (não rota), aberto a partir de `ListaFunis.tsx`. */
export function DialogoEtapas({
  funilId,
  funilNome,
  empresaId,
  open,
  onOpenChange,
}: {
  funilId: string | null;
  funilNome: string;
  empresaId: string | null;
  open: boolean;
  onOpenChange: (aberto: boolean) => void;
}) {
  const { data: etapas, isLoading } = useEtapasConfig(funilId);
  const criar = useCriarEtapa(funilId, empresaId);
  const atualizar = useAtualizarEtapa(funilId);
  const excluir = useExcluirEtapa(funilId);

  const [editando, setEditando] = useState<EtapaConfig | null | "nova">(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!open) setEditando(null);
  }, [open]);

  async function salvar(dados: EtapaFormInput) {
    setErro(null);
    try {
      if (editando && editando !== "nova") {
        await atualizar.mutateAsync({ id: editando.id, dados });
      } else {
        await criar.mutateAsync(dados);
      }
      setEditando(null);
    } catch (erroSalvar) {
      setErro(erroSalvar instanceof Error ? erroSalvar.message : "Não foi possível salvar.");
    }
  }

  async function excluirEtapa(id: string) {
    setErro(null);
    if (!window.confirm("Excluir esta etapa?")) return;
    try {
      await excluir.mutateAsync(id);
    } catch (erroExcluir) {
      setErro(erroExcluir instanceof Error ? erroExcluir.message : "Não foi possível excluir.");
    }
  }

  const proximaOrdem = (etapas?.length ?? 0) + 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Etapas — {funilNome}</DialogTitle>
        </DialogHeader>

        {erro && <p className="text-sm text-destructive">{erro}</p>}
        {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

        <div className="max-h-80 space-y-2 overflow-y-auto">
          {etapas?.map((etapa) =>
            editando !== "nova" && editando?.id === etapa.id ? (
              <FormularioEtapa
                key={etapa.id}
                etapa={etapa}
                proximaOrdem={proximaOrdem}
                onSalvar={salvar}
                onCancelar={() => setEditando(null)}
                pendente={atualizar.isPending}
              />
            ) : (
              <div
                key={etapa.id}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <span className="text-sm">
                  {etapa.nome}
                  {etapa.tipo !== "normal" && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({ROTULO_TIPO_ETAPA[etapa.tipo]})
                    </span>
                  )}
                </span>
                <span>
                  <Button variant="ghost" size="sm" onClick={() => setEditando(etapa)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => excluirEtapa(etapa.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </span>
              </div>
            ),
          )}

          {editando === "nova" && (
            <FormularioEtapa
              etapa={null}
              proximaOrdem={proximaOrdem}
              onSalvar={salvar}
              onCancelar={() => setEditando(null)}
              pendente={criar.isPending}
            />
          )}
        </div>

        <DialogFooter>
          {editando === null && (
            <Button type="button" variant="outline" onClick={() => setEditando("nova")}>
              <Plus className="mr-2 h-4 w-4" />
              Nova etapa
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
