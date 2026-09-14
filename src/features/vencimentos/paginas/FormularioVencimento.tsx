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
import { useCamposPersonalizados } from "@/features/contatos/api/useCamposPersonalizados";
import { useContatos } from "@/features/contatos/api/useContatos";
import { CampoPersonalizado } from "@/features/contatos/components/CampoPersonalizado";
import { useVencimentoTipos } from "@/features/vencimentos/api/useVencimentoTipos";
import { useVencimento } from "@/features/vencimentos/api/useVencimentos";
import {
  useAtualizarVencimento,
  useCriarVencimento,
} from "@/features/vencimentos/api/useMutacoesVencimento";
import { construirVencimentoSchema, type VencimentoInput } from "@/features/vencimentos/schemas";

const valoresPadrao: VencimentoInput = {
  contatoId: "",
  vencimentoTipoId: "",
  descricao: "",
  dataVencimento: "",
  valor: "",
  recorrencia: "anual",
  responsavelId: "",
  campos: {},
};

export function FormularioVencimento() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const contatoIdPreenchido = searchParams.get("contatoId");
  const editando = Boolean(id);
  const navigate = useNavigate();
  const vocabulario = useVocabulario();
  const { atual } = useEmpresaAtual();
  const empresaId = atual?.empresaId ?? null;

  const { data: vencimentoExistente } = useVencimento(editando ? (id as string) : null);
  const { data: camposPersonalizados } = useCamposPersonalizados(empresaId, "vencimento");
  const { data: tipos } = useVencimentoTipos(empresaId);
  const { data: contatos } = useContatos(empresaId);
  const { data: membros } = useMembrosEmpresa(empresaId);
  const criarVencimento = useCriarVencimento(empresaId);
  const atualizarVencimento = useAtualizarVencimento(empresaId, id as string);

  const [erro, setErro] = useState<string | null>(null);
  const schema = useMemo(
    () => construirVencimentoSchema(camposPersonalizados ?? []),
    [camposPersonalizados],
  );

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<VencimentoInput>({
    resolver: zodResolver(schema),
    defaultValues: contatoIdPreenchido
      ? { ...valoresPadrao, contatoId: contatoIdPreenchido }
      : valoresPadrao,
  });

  useEffect(() => {
    if (vencimentoExistente) {
      reset({
        contatoId: vencimentoExistente.contatoId,
        vencimentoTipoId: vencimentoExistente.vencimentoTipoId ?? "",
        descricao: vencimentoExistente.descricao ?? "",
        dataVencimento: vencimentoExistente.dataVencimento,
        valor: vencimentoExistente.valor != null ? String(vencimentoExistente.valor) : "",
        recorrencia: vencimentoExistente.recorrencia as VencimentoInput["recorrencia"],
        responsavelId: vencimentoExistente.responsavelId ?? "",
        campos: vencimentoExistente.campos ?? {},
      });
    }
  }, [vencimentoExistente, reset]);

  async function aoEnviar(dados: VencimentoInput) {
    setErro(null);
    try {
      if (editando) {
        await atualizarVencimento.mutateAsync(dados);
        navigate(`/vencimentos/${id}`);
      } else {
        const criado = await criarVencimento.mutateAsync(dados);
        navigate(`/vencimentos/${criado.id}`);
      }
    } catch {
      setErro(
        `Não foi possível salvar o ${vocabulario.vencimento.toLowerCase()}. Tente de novo em instantes.`,
      );
    }
  }

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4">
      <h1 className="text-2xl font-semibold">
        {editando
          ? `Editar ${vocabulario.vencimento.toLowerCase()}`
          : `Novo ${vocabulario.vencimento.toLowerCase()}`}
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
                <Label htmlFor="vencimentoTipoId">Tipo</Label>
                <Controller
                  control={control}
                  name="vencimentoTipoId"
                  render={({ field }) => (
                    <Select value={field.value || undefined} onValueChange={field.onChange}>
                      <SelectTrigger id="vencimentoTipoId">
                        <SelectValue placeholder="Sem tipo definido" />
                      </SelectTrigger>
                      <SelectContent>
                        {tipos?.map((tipo) => (
                          <SelectItem key={tipo.id} value={tipo.id}>
                            {tipo.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="recorrencia">Recorrência</Label>
                <Controller
                  control={control}
                  name="recorrencia"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="recorrencia">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unica">Única</SelectItem>
                        <SelectItem value="mensal">Mensal</SelectItem>
                        <SelectItem value="anual">Anual</SelectItem>
                        <SelectItem value="personalizada">Personalizada</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="descricao">Descrição</Label>
              <Input
                id="descricao"
                placeholder="Ex.: Seguro auto — Onix"
                {...register("descricao")}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="dataVencimento">Data de vencimento</Label>
                <Input id="dataVencimento" type="date" {...register("dataVencimento")} />
                {errors.dataVencimento && (
                  <p className="text-sm text-destructive">{errors.dataVencimento.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="valor">Valor</Label>
                <Input id="valor" inputMode="decimal" placeholder="0,00" {...register("valor")} />
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

            {camposPersonalizados && camposPersonalizados.length > 0 && (
              <div className="space-y-4 border-t border-border pt-4">
                <p className="text-sm font-medium text-muted-foreground">Campos do nicho</p>
                {camposPersonalizados.map((campo) => (
                  <CampoPersonalizado
                    key={campo.id}
                    campo={campo}
                    control={control}
                    erro={
                      (errors.campos as Record<string, { message?: string }> | undefined)?.[
                        campo.chave
                      ]?.message
                    }
                  />
                ))}
              </div>
            )}

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
