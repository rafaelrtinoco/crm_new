import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
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
import { useVocabulario } from "@/lib/vocabulario";
import { useEmpresaAtual, useMembrosEmpresa } from "@/features/onboarding/api/useEmpresas";
import { useContatos } from "@/features/contatos/api/useContatos";
import { useCriarTarefa, useAtualizarTarefa } from "@/features/tarefas/api/useMutacoesTarefa";
import type { Tarefa } from "@/features/tarefas/api/useTarefas";
import { tarefaSchema, type TarefaInput } from "@/features/tarefas/schemas";

const rotuloTipo: Record<TarefaInput["tipo"], string> = {
  ligar: "Ligar",
  whatsapp: "WhatsApp",
  email: "E-mail",
  reuniao: "Reunião",
  outro: "Outro",
};

const valoresPadrao: TarefaInput = {
  tipo: "ligar",
  titulo: "",
  dataVencimento: "",
  responsavelId: "",
  contatoId: "",
  negocioId: "",
};

interface Props {
  open: boolean;
  onOpenChange: (aberto: boolean) => void;
  tarefa?: Tarefa | null;
  contatoIdPadrao?: string;
  negocioIdPadrao?: string;
  negocioAcaoPadrao?: string;
}

/** Criar/editar tarefa (PRD §6.6) — diálogo, não página própria: entidade leve demais pra merecer uma. */
export function DialogoTarefa({
  open,
  onOpenChange,
  tarefa,
  contatoIdPadrao,
  negocioIdPadrao,
  negocioAcaoPadrao,
}: Props) {
  const vocabulario = useVocabulario();
  const { atual } = useEmpresaAtual();
  const empresaId = atual?.empresaId ?? null;
  const editando = Boolean(tarefa);

  const { data: contatos } = useContatos(empresaId);
  const { data: membros } = useMembrosEmpresa(empresaId);
  const criarTarefa = useCriarTarefa(empresaId);
  const atualizarTarefa = useAtualizarTarefa(empresaId, tarefa?.id ?? "");

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TarefaInput>({ resolver: zodResolver(tarefaSchema), defaultValues: valoresPadrao });

  useEffect(() => {
    if (!open) return;
    if (tarefa) {
      reset({
        tipo: tarefa.tipo as TarefaInput["tipo"],
        titulo: tarefa.titulo,
        dataVencimento: tarefa.dataVencimento,
        responsavelId: tarefa.responsavelId ?? "",
        contatoId: tarefa.contatoId ?? "",
        negocioId: tarefa.negocioId ?? "",
      });
    } else {
      reset({
        ...valoresPadrao,
        contatoId: contatoIdPadrao ?? "",
        negocioId: negocioIdPadrao ?? "",
      });
    }
  }, [open, tarefa, contatoIdPadrao, negocioIdPadrao, reset]);

  async function aoEnviar(dados: TarefaInput) {
    if (editando) {
      await atualizarTarefa.mutateAsync(dados);
    } else {
      await criarTarefa.mutateAsync(dados);
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editando
              ? `Editar ${vocabulario.tarefa.toLowerCase()}`
              : `Nova ${vocabulario.tarefa.toLowerCase()}`}
          </DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit(aoEnviar)} noValidate>
          {negocioIdPadrao && (
            <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
              Vinculada ao negócio: {negocioAcaoPadrao}
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="titulo">Título</Label>
            <Input
              id="titulo"
              placeholder="Ex.: Ligar pra confirmar proposta"
              {...register("titulo")}
            />
            {errors.titulo && <p className="text-sm text-destructive">{errors.titulo.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tipo">Tipo</Label>
              <Controller
                control={control}
                name="tipo"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="tipo">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(rotuloTipo).map(([valor, rotulo]) => (
                        <SelectItem key={valor} value={valor}>
                          {rotulo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dataVencimento">Data</Label>
              <Input id="dataVencimento" type="date" {...register("dataVencimento")} />
              {errors.dataVencimento && (
                <p className="text-sm text-destructive">{errors.dataVencimento.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="responsavelId">Responsável</Label>
            <Controller
              control={control}
              name="responsavelId"
              render={({ field }) => (
                <Select value={field.value || undefined} onValueChange={field.onChange}>
                  <SelectTrigger id="responsavelId">
                    <SelectValue placeholder="Sem responsável definido" />
                  </SelectTrigger>
                  <SelectContent>
                    {membros?.map((membro) => (
                      <SelectItem key={membro.usuarioId} value={membro.usuarioId}>
                        {membro.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {!negocioIdPadrao && (
            <div className="space-y-1.5">
              <Label htmlFor="contatoId">Contato (opcional)</Label>
              <Controller
                control={control}
                name="contatoId"
                render={({ field }) => (
                  <Select value={field.value || undefined} onValueChange={field.onChange}>
                    <SelectTrigger id="contatoId">
                      <SelectValue placeholder="Sem contato vinculado" />
                    </SelectTrigger>
                    <SelectContent>
                      {contatos?.map((contato) => (
                        <SelectItem key={contato.id} value={contato.id}>
                          {contato.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          )}

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
