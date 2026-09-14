import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatarCpfCnpj, formatarTelefone } from "@/lib/formatadores";
import { useVocabulario } from "@/lib/vocabulario";
import { useEmpresaAtual, useMembrosEmpresa } from "@/features/onboarding/api/useEmpresas";
import { useCamposPersonalizados } from "@/features/contatos/api/useCamposPersonalizados";
import { useContato } from "@/features/contatos/api/useContatos";
import { useCriarContato, useAtualizarContato } from "@/features/contatos/api/useMutacoesContato";
import {
  definirTagsDoContato,
  useDefinirTagsDoContato,
  useTags,
  useTagsDoContato,
} from "@/features/contatos/api/useTags";
import { CampoPersonalizado } from "@/features/contatos/components/CampoPersonalizado";
import { construirContatoSchema, type ContatoInput } from "@/features/contatos/schemas";

const valoresPadrao: ContatoInput = {
  nome: "",
  status: "lead",
  temperatura: "",
  origem: "",
  telefone: "",
  email: "",
  cpfCnpj: "",
  nascimento: "",
  responsavelId: "",
  endereco: {},
  campos: {},
};

export function FormularioContato() {
  const { id } = useParams<{ id: string }>();
  const editando = Boolean(id);
  const navigate = useNavigate();
  const vocabulario = useVocabulario();
  const { atual } = useEmpresaAtual();
  const empresaId = atual?.empresaId ?? null;

  const { data: contatoExistente } = useContato(editando ? (id as string) : null);
  const { data: camposPersonalizados } = useCamposPersonalizados(empresaId);
  const { data: membros } = useMembrosEmpresa(empresaId);
  const { data: tags } = useTags(empresaId);
  const { data: tagsDoContato } = useTagsDoContato(editando ? (id as string) : null);
  const criarContato = useCriarContato(empresaId);
  const atualizarContato = useAtualizarContato(empresaId, id as string);
  const definirTags = useDefinirTagsDoContato(empresaId, editando ? (id as string) : null);

  const [tagsSelecionadas, setTagsSelecionadas] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  const schema = useMemo(
    () => construirContatoSchema(camposPersonalizados ?? []),
    [camposPersonalizados],
  );

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContatoInput>({ resolver: zodResolver(schema), defaultValues: valoresPadrao });

  useEffect(() => {
    if (contatoExistente) {
      reset({
        nome: contatoExistente.nome,
        status: contatoExistente.status as ContatoInput["status"],
        temperatura: (contatoExistente.temperatura ?? "") as ContatoInput["temperatura"],
        origem: contatoExistente.origem ?? "",
        telefone: contatoExistente.telefone ?? "",
        email: contatoExistente.email ?? "",
        cpfCnpj: contatoExistente.cpfCnpj ?? "",
        nascimento: contatoExistente.nascimento ?? "",
        responsavelId: contatoExistente.responsavelId ?? "",
        endereco: contatoExistente.endereco ?? {},
        campos: contatoExistente.campos ?? {},
      });
    }
  }, [contatoExistente, reset]);

  useEffect(() => {
    if (tagsDoContato) setTagsSelecionadas(tagsDoContato.map((t) => t.id));
  }, [tagsDoContato]);

  async function aoEnviar(dados: ContatoInput) {
    setErro(null);
    try {
      if (editando) {
        await atualizarContato.mutateAsync(dados);
        await definirTags.mutateAsync(tagsSelecionadas);
        navigate(`/contatos/${id}`);
      } else {
        const criado = await criarContato.mutateAsync(dados);
        if (tagsSelecionadas.length > 0 && empresaId) {
          await definirTagsDoContato(empresaId, criado.id, tagsSelecionadas);
        }
        navigate(`/contatos/${criado.id}`);
      }
    } catch {
      setErro(
        `Não foi possível salvar o ${vocabulario.contato.toLowerCase()}. Tente de novo em instantes.`,
      );
    }
  }

  function alternarTag(tagId: string, marcado: boolean) {
    setTagsSelecionadas((atual) =>
      marcado ? [...atual, tagId] : atual.filter((t) => t !== tagId),
    );
  }

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4">
      <h1 className="text-2xl font-semibold">
        {editando
          ? `Editar ${vocabulario.contato.toLowerCase()}`
          : `Novo ${vocabulario.contato.toLowerCase()}`}
      </h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Dados</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit(aoEnviar)} noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="nome">Nome</Label>
              <Input id="nome" {...register("nome")} />
              {errors.nome && <p className="text-sm text-destructive">{errors.nome.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="status">Status</Label>
                <Controller
                  control={control}
                  name="status"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="lead">Lead</SelectItem>
                        <SelectItem value="cliente">Cliente</SelectItem>
                        <SelectItem value="inativo">Inativo</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="temperatura">Temperatura</Label>
                <Controller
                  control={control}
                  name="temperatura"
                  render={({ field }) => (
                    <Select value={field.value || undefined} onValueChange={field.onChange}>
                      <SelectTrigger id="temperatura">
                        <SelectValue placeholder="Sem definir" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="quente">Quente</SelectItem>
                        <SelectItem value="morno">Morno</SelectItem>
                        <SelectItem value="frio">Frio</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="telefone">Telefone / WhatsApp</Label>
                <Controller
                  control={control}
                  name="telefone"
                  render={({ field }) => (
                    <Input
                      id="telefone"
                      inputMode="tel"
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(formatarTelefone(e.target.value))}
                    />
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" {...register("email")} />
                {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cpfCnpj">CPF ou CNPJ</Label>
                <Controller
                  control={control}
                  name="cpfCnpj"
                  render={({ field }) => (
                    <Input
                      id="cpfCnpj"
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(formatarCpfCnpj(e.target.value))}
                    />
                  )}
                />
                {errors.cpfCnpj && (
                  <p className="text-sm text-destructive">{errors.cpfCnpj.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nascimento">Data de nascimento</Label>
                <Input id="nascimento" type="date" {...register("nascimento")} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="origem">Origem</Label>
              <Input id="origem" placeholder="Indicação, site, anúncio…" {...register("origem")} />
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

            {tags && tags.length > 0 && (
              <div className="space-y-1.5">
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-3">
                  {tags.map((tag) => (
                    <label key={tag.id} className="flex items-center gap-1.5 text-sm">
                      <Checkbox
                        checked={tagsSelecionadas.includes(tag.id)}
                        onCheckedChange={(marcado) => alternarTag(tag.id, marcado === true)}
                      />
                      {tag.nome}
                    </label>
                  ))}
                </div>
              </div>
            )}

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
