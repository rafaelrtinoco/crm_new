import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { Pencil, Plus, Tag as TagIcon, Trash2 } from "lucide-react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useEmpresaAtual } from "@/features/onboarding/api/useEmpresas";
import {
  useAtualizarTag,
  useCriarTagConfig,
  useExcluirTag,
  useTagsConfig,
  type TagConfig,
} from "@/features/configuracoes/api/useTagsConfig";
import { tagSchema, type TagFormInput } from "@/features/configuracoes/schemas";

const COR_PADRAO = "#6366F1";

function DialogoTag({
  open,
  onOpenChange,
  tag,
  onSalvar,
  pendente,
}: {
  open: boolean;
  onOpenChange: (aberto: boolean) => void;
  tag: TagConfig | null;
  onSalvar: (dados: TagFormInput) => Promise<void>;
  pendente: boolean;
}) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TagFormInput>({
    resolver: zodResolver(tagSchema),
    defaultValues: { nome: "", cor: COR_PADRAO },
  });

  useEffect(() => {
    reset({ nome: tag?.nome ?? "", cor: tag?.cor ?? COR_PADRAO });
  }, [tag, open, reset]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tag ? "Editar tag" : "Nova tag"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSalvar)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tag-nome">Nome</Label>
            <Input id="tag-nome" {...register("nome")} />
            {errors.nome && <p className="text-sm text-destructive">{errors.nome.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tag-cor">Cor</Label>
            <Controller
              control={control}
              name="cor"
              render={({ field }) => (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="tag-cor-ativa"
                    checked={field.value !== null}
                    onCheckedChange={(marcado) =>
                      field.onChange(marcado === true ? COR_PADRAO : null)
                    }
                  />
                  <Label htmlFor="tag-cor-ativa" className="font-normal text-muted-foreground">
                    Usar cor
                  </Label>
                  {field.value !== null && (
                    <input
                      id="tag-cor"
                      type="color"
                      className="h-9 w-14 cursor-pointer rounded border border-input"
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                    />
                  )}
                </div>
              )}
            />
            {errors.cor && <p className="text-sm text-destructive">{errors.cor.message}</p>}
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

/** Tags — qualquer membro cria/edita/exclui (docs/decisoes/0001, tags_membro na RLS). */
export function ListaTags() {
  const { atual } = useEmpresaAtual();
  const empresaId = atual?.empresaId ?? null;
  const { data: tags, isLoading } = useTagsConfig(empresaId);
  const criar = useCriarTagConfig(empresaId);
  const atualizar = useAtualizarTag(empresaId);
  const excluir = useExcluirTag(empresaId);

  const [dialogoAberto, setDialogoAberto] = useState(false);
  const [editando, setEditando] = useState<TagConfig | null>(null);
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);

  async function salvar(dados: TagFormInput) {
    if (editando) {
      await atualizar.mutateAsync({ id: editando.id, dados });
    } else {
      await criar.mutateAsync(dados);
    }
    setDialogoAberto(false);
  }

  async function excluirTag(id: string) {
    setErroExclusao(null);
    if (!window.confirm("Excluir esta tag?")) return;
    try {
      await excluir.mutateAsync(id);
    } catch (erro) {
      setErroExclusao(erro instanceof Error ? erro.message : "Não foi possível excluir.");
    }
  }

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Tags</h1>
        <Button
          onClick={() => {
            setEditando(null);
            setDialogoAberto(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Nova
        </Button>
      </div>

      {erroExclusao && <p className="text-sm text-destructive">{erroExclusao}</p>}

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

      {!isLoading && tags && tags.length === 0 && (
        <EmptyState
          icone={TagIcon}
          titulo="Nenhuma tag cadastrada"
          descricao="Tags ajudam a organizar contatos por características em comum."
          acao={{
            rotulo: "Nova tag",
            onClick: () => {
              setEditando(null);
              setDialogoAberto(true);
            },
          }}
        />
      )}

      {!isLoading && tags && tags.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tags.map((tag) => (
              <TableRow key={tag.id}>
                <TableCell>
                  <span className="flex items-center gap-2">
                    {tag.cor && (
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: tag.cor }} />
                    )}
                    {tag.nome}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditando(tag);
                      setDialogoAberto(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => excluirTag(tag.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <DialogoTag
        open={dialogoAberto}
        onOpenChange={setDialogoAberto}
        tag={editando}
        onSalvar={salvar}
        pendente={criar.isPending || atualizar.isPending}
      />
    </main>
  );
}
