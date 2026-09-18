import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useVocabulario } from "@/lib/vocabulario";
import { useEmpresaAtual } from "@/features/onboarding/api/useEmpresas";
import { ConstrutorRegras } from "@/features/segmentos/components/ConstrutorRegras";
import {
  useAtualizarSegmento,
  useContagemSegmento,
  useCriarSegmento,
  useSegmento,
  type RegraSegmento,
} from "@/features/segmentos/api/useSegmentos";
import { segmentoSchema } from "@/features/segmentos/schemas";

const nomeSchema = z.object({ nome: z.string().min(2, "Informe o nome do segmento") });
type NomeInput = z.infer<typeof nomeSchema>;

export function FormularioSegmento() {
  const { id } = useParams<{ id: string }>();
  const editando = Boolean(id);
  const navigate = useNavigate();
  const vocabulario = useVocabulario();
  const { atual } = useEmpresaAtual();
  const empresaId = atual?.empresaId ?? null;

  const { data: segmentoExistente } = useSegmento(editando ? (id as string) : null);
  const criarSegmento = useCriarSegmento(empresaId);
  const atualizarSegmento = useAtualizarSegmento(empresaId, id as string);

  const [regras, setRegras] = useState<RegraSegmento[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const { data: contagem, isFetching: contando } = useContagemSegmento(empresaId, regras);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<NomeInput>({
    resolver: zodResolver(nomeSchema),
    defaultValues: { nome: "" },
  });

  useEffect(() => {
    if (segmentoExistente) {
      reset({ nome: segmentoExistente.nome });
      setRegras(segmentoExistente.regras);
    }
  }, [segmentoExistente, reset]);

  async function aoEnviar(dados: NomeInput) {
    setErro(null);
    const validado = segmentoSchema.safeParse({ nome: dados.nome, regras });
    if (!validado.success) {
      setErro(validado.error.issues[0]?.message ?? "Revise as regras do segmento.");
      return;
    }

    if (editando) {
      await atualizarSegmento.mutateAsync({ nome: dados.nome, regras });
    } else {
      await criarSegmento.mutateAsync({ nome: dados.nome, regras });
    }
    navigate("/segmentos");
  }

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4">
      <h1 className="text-2xl font-semibold">{editando ? "Editar segmento" : "Novo segmento"}</h1>

      <Card>
        <CardHeader>
          <CardTitle>Dados do segmento</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit(aoEnviar)} noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="nome">Nome</Label>
              <Input id="nome" {...register("nome")} />
              {errors.nome && <p className="text-sm text-destructive">{errors.nome.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Regras</Label>
              {empresaId && (
                <ConstrutorRegras empresaId={empresaId} regras={regras} onChange={setRegras} />
              )}
            </div>

            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
              {regras.length === 0 ? (
                <span className="text-muted-foreground">
                  Sem regras — o segmento não vai bater com nenhum{" "}
                  {vocabulario.contato.toLowerCase()}.
                </span>
              ) : (
                <span>
                  {contando
                    ? "Calculando…"
                    : `${contagem ?? 0} ${vocabulario.contatoPlural.toLowerCase()}`}{" "}
                  batem com essas regras agora.
                </span>
              )}
            </div>

            {erro && <p className="text-sm text-destructive">{erro}</p>}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => navigate("/segmentos")}>
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
