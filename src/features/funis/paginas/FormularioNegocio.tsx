import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
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
import { useVocabulario } from "@/lib/vocabulario";
import { useEmpresaAtual, useMembrosEmpresa } from "@/features/onboarding/api/useEmpresas";
import { useContatos } from "@/features/contatos/api/useContatos";
import { useEtapas, useFunis } from "@/features/funis/api/useFunis";
import { useAtualizarNegocio, useCriarNegocio } from "@/features/funis/api/useMutacoesNegocio";
import { useNegocio } from "@/features/funis/api/useNegocios";
import { negocioSchema, type NegocioInput } from "@/features/funis/schemas";

const valoresPadrao: NegocioInput = {
  contatoId: "",
  funilId: "",
  etapaId: "",
  valorEstimado: "",
  responsavelId: "",
  previsaoFechamento: "",
  proximoPassoEm: "",
  proximoPassoAcao: "",
};

export function FormularioNegocio() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const editando = Boolean(id);
  const navigate = useNavigate();
  const vocabulario = useVocabulario();
  const { atual } = useEmpresaAtual();
  const empresaId = atual?.empresaId ?? null;

  const { data: negocioExistente } = useNegocio(editando ? (id as string) : null);
  const { data: funis } = useFunis(empresaId);
  const { data: contatos } = useContatos(empresaId);
  const { data: membros } = useMembrosEmpresa(empresaId);
  const criarNegocio = useCriarNegocio(empresaId);
  const atualizarNegocio = useAtualizarNegocio(empresaId, id as string);

  const [erro, setErro] = useState<string | null>(null);

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<NegocioInput>({
    resolver: zodResolver(negocioSchema),
    defaultValues: {
      ...valoresPadrao,
      contatoId: searchParams.get("contatoId") ?? "",
      funilId: searchParams.get("funilId") ?? "",
    },
  });

  const funilId = watch("funilId");
  const { data: etapas } = useEtapas(funilId || null);

  useEffect(() => {
    if (!editando && !funilId && funis && funis.length > 0 && funis[0]) {
      reset((valores) => ({ ...valores, funilId: funis[0]!.id }));
    }
  }, [editando, funilId, funis, reset]);

  useEffect(() => {
    if (negocioExistente) {
      reset({
        contatoId: negocioExistente.contatoId,
        funilId: negocioExistente.funilId,
        etapaId: negocioExistente.etapaId,
        valorEstimado:
          negocioExistente.valorEstimado != null ? String(negocioExistente.valorEstimado) : "",
        responsavelId: negocioExistente.responsavelId ?? "",
        previsaoFechamento: negocioExistente.previsaoFechamento ?? "",
        proximoPassoEm: negocioExistente.proximoPassoEm,
        proximoPassoAcao: negocioExistente.proximoPassoAcao,
      });
    }
  }, [negocioExistente, reset]);

  const etapaPadraoAplicada = useMemo(() => etapas?.[0]?.id, [etapas]);
  useEffect(() => {
    if (!editando && funilId && etapaPadraoAplicada) {
      reset((valores) =>
        valores.etapaId ? valores : { ...valores, etapaId: etapaPadraoAplicada },
      );
    }
  }, [editando, funilId, etapaPadraoAplicada, reset]);

  async function aoEnviar(dados: NegocioInput) {
    setErro(null);
    try {
      if (editando) {
        await atualizarNegocio.mutateAsync(dados);
        navigate(`/funis/negocios/${id}`);
      } else {
        const criado = await criarNegocio.mutateAsync(dados);
        navigate(`/funis/negocios/${criado.id}`);
      }
    } catch {
      setErro(
        `Não foi possível salvar o ${vocabulario.negocio.toLowerCase()}. Tente de novo em instantes.`,
      );
    }
  }

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4">
      <h1 className="text-2xl font-semibold">
        {editando
          ? `Editar ${vocabulario.negocio.toLowerCase()}`
          : `Novo ${vocabulario.negocio.toLowerCase()}`}
      </h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Dados</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit(aoEnviar)} noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="contatoId">Contato</Label>
              <Controller
                control={control}
                name="contatoId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="contatoId">
                      <SelectValue placeholder="Selecione o contato" />
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
              {errors.contatoId && (
                <p className="text-sm text-destructive">{errors.contatoId.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="funilId">Funil</Label>
                <Controller
                  control={control}
                  name="funilId"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(valor) => {
                        field.onChange(valor);
                        setValue("etapaId", "");
                      }}
                    >
                      <SelectTrigger id="funilId">
                        <SelectValue placeholder="Selecione o funil" />
                      </SelectTrigger>
                      <SelectContent>
                        {funis?.map((funil) => (
                          <SelectItem key={funil.id} value={funil.id}>
                            {funil.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="etapaId">Etapa</Label>
                <Controller
                  control={control}
                  name="etapaId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="etapaId">
                        <SelectValue placeholder="Selecione a etapa" />
                      </SelectTrigger>
                      <SelectContent>
                        {etapas?.map((etapa) => (
                          <SelectItem key={etapa.id} value={etapa.id}>
                            {etapa.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.etapaId && (
                  <p className="text-sm text-destructive">{errors.etapaId.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="valorEstimado">Valor estimado</Label>
                <Input
                  id="valorEstimado"
                  inputMode="decimal"
                  placeholder="0,00"
                  {...register("valorEstimado")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="previsaoFechamento">Previsão de fechamento</Label>
                <Input id="previsaoFechamento" type="date" {...register("previsaoFechamento")} />
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

            <div className="grid grid-cols-2 gap-3 border-t border-border pt-4">
              <div className="space-y-1.5">
                <Label htmlFor="proximoPassoEm">Próximo passo — data</Label>
                <Input id="proximoPassoEm" type="date" {...register("proximoPassoEm")} />
                {errors.proximoPassoEm && (
                  <p className="text-sm text-destructive">{errors.proximoPassoEm.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="proximoPassoAcao">Próximo passo — ação</Label>
                <Input
                  id="proximoPassoAcao"
                  placeholder="Ex.: Ligar pra apresentar cotação"
                  {...register("proximoPassoAcao")}
                />
                {errors.proximoPassoAcao && (
                  <p className="text-sm text-destructive">{errors.proximoPassoAcao.message}</p>
                )}
              </div>
            </div>

            {erro && <p className="text-sm text-destructive">{erro}</p>}

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvando…" : "Salvar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
