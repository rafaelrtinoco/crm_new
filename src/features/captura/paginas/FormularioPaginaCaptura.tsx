import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useEmpresaAtual } from "@/features/onboarding/api/useEmpresas";
import { useFormularios } from "@/features/captura/api/useFormularios";
import {
  useAtualizarPaginaCaptura,
  useCriarPaginaCaptura,
  usePaginaCaptura,
  type PaginaCapturaInput,
} from "@/features/captura/api/usePaginasCaptura";
import { paginaCapturaSchema, type PaginaCapturaFormInput } from "@/features/captura/schemas";

export function FormularioPaginaCaptura() {
  const { id } = useParams<{ id: string }>();
  const editando = Boolean(id);
  const navigate = useNavigate();
  const { atual } = useEmpresaAtual();
  const empresaId = atual?.empresaId ?? null;

  const { data: paginaExistente } = usePaginaCaptura(editando ? (id as string) : null);
  const { data: formularios } = useFormularios(empresaId);
  const criarPagina = useCriarPaginaCaptura(empresaId);
  const atualizarPagina = useAtualizarPaginaCaptura(empresaId, id as string);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PaginaCapturaFormInput>({
    resolver: zodResolver(paginaCapturaSchema),
    defaultValues: {
      slug: "",
      titulo: "",
      texto: null,
      imagemUrl: null,
      formularioId: null,
      whatsappNumero: null,
      whatsappMensagem: null,
    },
  });

  useEffect(() => {
    if (paginaExistente) reset(paginaExistente);
  }, [paginaExistente, reset]);

  async function aoEnviar(dados: PaginaCapturaFormInput) {
    const entrada: PaginaCapturaInput = dados;
    if (editando) {
      await atualizarPagina.mutateAsync(entrada);
    } else {
      await criarPagina.mutateAsync(entrada);
    }
    navigate("/captura/paginas");
  }

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4">
      <h1 className="text-2xl font-semibold">
        {editando ? "Editar página" : "Nova página de captura"}
      </h1>

      <Card>
        <CardHeader>
          <CardTitle>Dados da página</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit(aoEnviar)} noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="titulo">Título</Label>
              <Input id="titulo" {...register("titulo")} />
              {errors.titulo && <p className="text-sm text-destructive">{errors.titulo.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="slug">
                URL da página ({atual?.slug ? `/p/${atual.slug}/` : "/p/…/"}
                <span className="italic">slug</span>)
              </Label>
              <Input id="slug" {...register("slug")} placeholder="fale-conosco" />
              {errors.slug && <p className="text-sm text-destructive">{errors.slug.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="texto">Texto</Label>
              <Textarea id="texto" rows={4} {...register("texto")} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="imagemUrl">Imagem (URL)</Label>
              <Input id="imagemUrl" {...register("imagemUrl")} placeholder="https://…" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="formularioId">Formulário</Label>
              <Controller
                control={control}
                name="formularioId"
                render={({ field }) => (
                  <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                    <SelectTrigger id="formularioId">
                      <SelectValue placeholder="Escolha um formulário" />
                    </SelectTrigger>
                    <SelectContent>
                      {(formularios ?? []).map((formulario) => (
                        <SelectItem key={formulario.id} value={formulario.id}>
                          {formulario.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="whatsappNumero">WhatsApp (opcional)</Label>
                <Input
                  id="whatsappNumero"
                  {...register("whatsappNumero")}
                  placeholder="11999990000"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="whatsappMensagem">Mensagem pronta</Label>
                <Input
                  id="whatsappMensagem"
                  {...register("whatsappMensagem")}
                  placeholder="Olá, quero…"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => navigate("/captura/paginas")}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
