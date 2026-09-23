import { useEffect, useState } from "react";
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
import { useEmpresaAtual, useMembrosEmpresa } from "@/features/onboarding/api/useEmpresas";
import {
  useAtualizarFormulario,
  useCriarFormulario,
  useFormulario,
  type FormularioInput,
} from "@/features/captura/api/useFormularios";
import { formularioSchema, type FormularioFormInput } from "@/features/captura/schemas";

export function FormularioFormulario() {
  const { id } = useParams<{ id: string }>();
  const editando = Boolean(id);
  const navigate = useNavigate();
  const { atual } = useEmpresaAtual();
  const empresaId = atual?.empresaId ?? null;

  const { data: formularioExistente } = useFormulario(editando ? (id as string) : null);
  const { data: membros } = useMembrosEmpresa(empresaId);
  const criarFormulario = useCriarFormulario(empresaId);
  const atualizarFormulario = useAtualizarFormulario(empresaId, id as string);

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormularioFormInput>({
    resolver: zodResolver(formularioSchema),
    defaultValues: { nome: "", distribuicaoTipo: "rodizio", responsavelFixoId: null },
  });

  useEffect(() => {
    if (formularioExistente) {
      reset({
        nome: formularioExistente.nome,
        distribuicaoTipo: formularioExistente.distribuicaoTipo,
        responsavelFixoId: formularioExistente.responsavelFixoId,
      });
    }
  }, [formularioExistente, reset]);

  const distribuicaoTipo = watch("distribuicaoTipo");

  async function aoEnviar(dados: FormularioFormInput) {
    const entrada: FormularioInput = dados;
    if (editando) {
      await atualizarFormulario.mutateAsync(entrada);
    } else {
      await criarFormulario.mutateAsync(entrada);
    }
    navigate("/captura/formularios");
  }

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4">
      <h1 className="text-2xl font-semibold">
        {editando ? "Editar formulário" : "Novo formulário"}
      </h1>

      <Card>
        <CardHeader>
          <CardTitle>Dados do formulário</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit(aoEnviar)} noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="nome">Nome</Label>
              <Input id="nome" {...register("nome")} />
              {errors.nome && <p className="text-sm text-destructive">{errors.nome.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="distribuicaoTipo">Distribuição do lead</Label>
              <Controller
                control={control}
                name="distribuicaoTipo"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="distribuicaoTipo">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rodizio">Rodízio entre a equipe</SelectItem>
                      <SelectItem value="fixo">Sempre pra uma pessoa</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {distribuicaoTipo === "fixo" && (
              <div className="space-y-1.5">
                <Label htmlFor="responsavelFixoId">Responsável</Label>
                <Controller
                  control={control}
                  name="responsavelFixoId"
                  render={({ field }) => (
                    <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                      <SelectTrigger id="responsavelFixoId">
                        <SelectValue placeholder="Escolha quem recebe os leads" />
                      </SelectTrigger>
                      <SelectContent>
                        {(membros ?? []).map((membro) => (
                          <SelectItem key={membro.usuarioId} value={membro.usuarioId}>
                            {membro.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.responsavelFixoId && (
                  <p className="text-sm text-destructive">{errors.responsavelFixoId.message}</p>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/captura/formularios")}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {editando && <SnippetEmbed empresaSlug={atual?.slug ?? null} formularioId={id as string} />}
    </main>
  );
}

function SnippetEmbed({
  empresaSlug,
  formularioId,
}: {
  empresaSlug: string | null;
  formularioId: string;
}) {
  const [copiado, setCopiado] = useState(false);

  if (!empresaSlug) {
    return (
      <p className="text-sm text-muted-foreground">
        Configure a URL pública da empresa (em Páginas de captura) pra gerar o link de incorporação
        deste formulário.
      </p>
    );
  }

  const url = `${window.location.origin}/f/${empresaSlug}/${formularioId}`;
  const snippet = `<iframe src="${url}" style="border:0;width:100%;height:480px" title="Formulário"></iframe>`;

  function copiar() {
    void navigator.clipboard.writeText(snippet);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Incorporar no site</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Cole este trecho na página do seu site — cada envio já entra como lead.
        </p>
        <div className="flex items-center gap-2">
          <Input readOnly value={snippet} className="text-xs" />
          <Button type="button" variant="outline" size="sm" onClick={copiar}>
            {copiado ? "Copiado!" : "Copiar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
