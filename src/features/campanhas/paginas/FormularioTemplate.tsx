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
import {
  useAtualizarTemplate,
  useCriarTemplate,
  useTemplate,
  type TemplateInput,
} from "@/features/campanhas/api/useTemplates";
import { templateSchema, type TemplateFormInput } from "@/features/campanhas/schemas";

export function FormularioTemplate() {
  const { id } = useParams<{ id: string }>();
  const editando = Boolean(id);
  const navigate = useNavigate();
  const { atual } = useEmpresaAtual();
  const empresaId = atual?.empresaId ?? null;

  const { data: templateExistente } = useTemplate(editando ? (id as string) : null);
  const criarTemplate = useCriarTemplate(empresaId);
  const atualizarTemplate = useAtualizarTemplate(empresaId, id as string);

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<TemplateFormInput>({
    resolver: zodResolver(templateSchema),
    defaultValues: { nome: "", canal: "whatsapp", conteudo: "" },
  });

  useEffect(() => {
    if (templateExistente) reset(templateExistente);
  }, [templateExistente, reset]);

  async function aoEnviar(dados: TemplateFormInput) {
    const entrada: TemplateInput = dados;
    if (editando) {
      await atualizarTemplate.mutateAsync(entrada);
    } else {
      await criarTemplate.mutateAsync(entrada);
    }
    navigate("/campanhas/templates");
  }

  const conteudo = watch("conteudo");

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4">
      <h1 className="text-2xl font-semibold">{editando ? "Editar template" : "Novo template"}</h1>

      <Card>
        <CardHeader>
          <CardTitle>Dados do template</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit(aoEnviar)} noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="nome">Nome</Label>
              <Input id="nome" {...register("nome")} />
              {errors.nome && <p className="text-sm text-destructive">{errors.nome.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="canal">Canal</Label>
              <Controller
                control={control}
                name="canal"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={editando}>
                    <SelectTrigger id="canal">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="email">E-mail</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="conteudo">Conteúdo</Label>
              <Textarea
                id="conteudo"
                rows={5}
                placeholder="Oi {{primeiro_nome}}, tudo bem? …"
                {...register("conteudo")}
              />
              {errors.conteudo && (
                <p className="text-sm text-destructive">{errors.conteudo.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Variáveis disponíveis: <code>{"{{nome}}"}</code>, <code>{"{{primeiro_nome}}"}</code>
                , <code>{"{{email}}"}</code>, <code>{"{{telefone}}"}</code>. Se o contato não tiver
                o dado, o envio pra ele fica bloqueado — nunca sai faltando.
              </p>
            </div>

            {conteudo && (
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
                <p className="mb-1 font-medium">Prévia (texto puro)</p>
                <p className="whitespace-pre-wrap text-muted-foreground">{conteudo}</p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/campanhas/templates")}
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
    </main>
  );
}
