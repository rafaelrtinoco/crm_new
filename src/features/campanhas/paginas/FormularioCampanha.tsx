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
import { useEmpresaAtual } from "@/features/onboarding/api/useEmpresas";
import { useSegmentos } from "@/features/segmentos/api/useSegmentos";
import { EditorBlocos } from "@/features/campanhas/components/EditorBlocos";
import { SeletorTemplate } from "@/features/campanhas/components/SeletorTemplate";
import {
  useAtualizarCampanha,
  useCampanha,
  useCriarCampanha,
  type CampanhaInput,
} from "@/features/campanhas/api/useCampanhas";
import { campanhaSchema, type CampanhaFormInput } from "@/features/campanhas/schemas";

/** "YYYY-MM-DDTHH:mm" (formato de <input type="datetime-local">) <-> ISO. */
function paraDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const data = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}T${pad(data.getHours())}:${pad(data.getMinutes())}`;
}

export function FormularioCampanha() {
  const { id } = useParams<{ id: string }>();
  const editando = Boolean(id);
  const navigate = useNavigate();
  const { atual } = useEmpresaAtual();
  const empresaId = atual?.empresaId ?? null;

  const { data: campanhaExistente } = useCampanha(editando ? (id as string) : null);
  const { data: segmentos } = useSegmentos(empresaId);
  const criarCampanha = useCriarCampanha(empresaId);
  const atualizarCampanha = useAtualizarCampanha(empresaId, id as string);

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CampanhaFormInput>({
    resolver: zodResolver(campanhaSchema),
    defaultValues: {
      nome: "",
      canal: "email",
      segmentoId: "",
      templateId: null,
      assunto: null,
      blocos: [],
      agendarPara: null,
    },
  });

  useEffect(() => {
    if (campanhaExistente) {
      reset({
        nome: campanhaExistente.nome,
        canal: campanhaExistente.canal,
        segmentoId: campanhaExistente.segmentoId,
        templateId: campanhaExistente.templateId,
        assunto: campanhaExistente.assunto,
        blocos: campanhaExistente.blocos,
        agendarPara: paraDatetimeLocal(campanhaExistente.agendadoPara) || null,
      });
    }
  }, [campanhaExistente, reset]);

  const canal = watch("canal");
  const bloqueadoParaEdicao =
    editando && campanhaExistente && !["rascunho", "agendada"].includes(campanhaExistente.status);

  async function aoEnviar(dados: CampanhaFormInput) {
    const entrada: CampanhaInput = {
      nome: dados.nome,
      canal: dados.canal,
      segmentoId: dados.segmentoId,
      templateId: dados.templateId,
      assunto: dados.assunto,
      blocos: dados.blocos,
      agendadoPara: dados.agendarPara ? new Date(dados.agendarPara).toISOString() : null,
    };

    let campanhaId = id as string;
    if (editando) {
      await atualizarCampanha.mutateAsync(entrada);
    } else {
      const criada = await criarCampanha.mutateAsync(entrada);
      campanhaId = criada.id;
    }
    navigate(`/campanhas/${campanhaId}`);
  }

  if (bloqueadoParaEdicao) {
    return (
      <main className="mx-auto max-w-2xl space-y-4 p-4">
        <p className="text-sm text-muted-foreground">
          Essa campanha já saiu do rascunho e não pode mais ser editada.
        </p>
        <Button variant="outline" onClick={() => navigate(`/campanhas/${id}`)}>
          Voltar pra campanha
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4">
      <h1 className="text-2xl font-semibold">{editando ? "Editar campanha" : "Nova campanha"}</h1>

      <Card>
        <CardHeader>
          <CardTitle>Dados da campanha</CardTitle>
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
                      <SelectItem value="email">E-mail</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="segmentoId">Segmento (público-alvo)</Label>
              <Controller
                control={control}
                name="segmentoId"
                render={({ field }) => (
                  <Select value={field.value || undefined} onValueChange={field.onChange}>
                    <SelectTrigger id="segmentoId">
                      <SelectValue placeholder="Escolha um segmento" />
                    </SelectTrigger>
                    <SelectContent>
                      {(segmentos ?? []).map((segmento) => (
                        <SelectItem key={segmento.id} value={segmento.id}>
                          {segmento.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.segmentoId && (
                <p className="text-sm text-destructive">{errors.segmentoId.message}</p>
              )}
            </div>

            {canal === "whatsapp" && (
              <div className="space-y-1.5">
                <Label>Template</Label>
                <Controller
                  control={control}
                  name="templateId"
                  render={({ field }) => (
                    <SeletorTemplate
                      empresaId={empresaId}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
                {errors.templateId && (
                  <p className="text-sm text-destructive">{errors.templateId.message}</p>
                )}
              </div>
            )}

            {canal === "email" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="assunto">Assunto</Label>
                  <Input
                    id="assunto"
                    {...register("assunto")}
                    placeholder="Oi {{primeiro_nome}}, …"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Conteúdo</Label>
                  <Controller
                    control={control}
                    name="blocos"
                    render={({ field }) => (
                      <EditorBlocos blocos={field.value} onChange={field.onChange} />
                    )}
                  />
                  {errors.blocos && (
                    <p className="text-sm text-destructive">{errors.blocos.message as string}</p>
                  )}
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="agendarPara">Agendar para (opcional)</Label>
              <Controller
                control={control}
                name="agendarPara"
                render={({ field }) => (
                  <Input
                    id="agendarPara"
                    type="datetime-local"
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value || null)}
                  />
                )}
              />
              <p className="text-xs text-muted-foreground">
                Sem data: a campanha fica como rascunho até você confirmar o disparo na tela
                seguinte.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => navigate("/campanhas")}>
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
