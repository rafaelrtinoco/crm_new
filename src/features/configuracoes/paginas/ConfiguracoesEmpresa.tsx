import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useEmpresaAtual } from "@/features/onboarding/api/useEmpresas";
import { useDefinirSlugEmpresa } from "@/features/captura/api/usePaginasCaptura";
import { CampoHorarioComercial } from "@/features/configuracoes/components/CampoHorarioComercial";
import { CampoLogo } from "@/features/configuracoes/components/CampoLogo";
import {
  useAlternarCarteiraCompartilhada,
  useAtualizarConfiguracoesEmpresa,
  useConfiguracoesEmpresa,
} from "@/features/configuracoes/api/useConfiguracoesEmpresa";
import { FUSOS_BRASIL } from "@/features/configuracoes/logica/fusos";
import {
  formularioParaHorarioComercial,
  horarioComercialParaFormulario,
} from "@/features/configuracoes/logica/horarioComercial";
import {
  configuracoesEmpresaSchema,
  type ConfiguracoesEmpresaFormInput,
} from "@/features/configuracoes/schemas";

const VALORES_PADRAO: ConfiguracoesEmpresaFormInput = {
  nome: "",
  fuso: "America/Sao_Paulo",
  horario: {
    segSex: { fechado: false, inicio: "08:00", fim: "18:00" },
    sab: { fechado: true, inicio: "08:00", fim: "18:00" },
    dom: { fechado: true, inicio: "08:00", fim: "18:00" },
  },
  logoUrl: null,
  corPrimaria: null,
};

function ConfiguracaoSlug({
  empresaId,
  slugAtual,
}: {
  empresaId: string | null;
  slugAtual: string | null;
}) {
  const [slug, setSlug] = useState(slugAtual ?? "");
  const definirSlug = useDefinirSlugEmpresa(empresaId);

  useEffect(() => setSlug(slugAtual ?? ""), [slugAtual]);

  return (
    <div className="space-y-2">
      <Label htmlFor="slug">URL pública</Label>
      <p className="text-sm text-muted-foreground">
        Aparece em toda página de captura: <code>/p/{slug || "sua-empresa"}/…</code>
      </p>
      <div className="flex items-center gap-2">
        <Input
          id="slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
          placeholder="sua-empresa"
          className="max-w-xs"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!slug || slug === slugAtual || definirSlug.isPending}
          onClick={() => definirSlug.mutate(slug)}
        >
          Salvar
        </Button>
      </div>
      {definirSlug.isError && (
        <p className="text-sm text-destructive">
          Não foi possível salvar — talvez essa URL já esteja em uso por outra empresa.
        </p>
      )}
    </div>
  );
}

/** Configurações da empresa — fatia 1 (PRD §6.15). Só gestor/dono; guard client-side é UX, quem protege de verdade é a RPC/RLS no banco. */
export function ConfiguracoesEmpresa() {
  const { atual } = useEmpresaAtual();
  const empresaId = atual?.empresaId ?? null;
  const { data: config, isLoading } = useConfiguracoesEmpresa(empresaId);
  const atualizarEmpresa = useAtualizarConfiguracoesEmpresa(empresaId);
  const alternarCarteira = useAlternarCarteiraCompartilhada(empresaId);
  const [salvoRecentemente, setSalvoRecentemente] = useState(false);

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ConfiguracoesEmpresaFormInput>({
    resolver: zodResolver(configuracoesEmpresaSchema),
    defaultValues: VALORES_PADRAO,
  });

  useEffect(() => {
    if (!config) return;
    reset({
      nome: config.nome,
      fuso: config.fuso,
      horario: horarioComercialParaFormulario(config.horarioComercial),
      logoUrl: config.logoUrl,
      corPrimaria: config.corPrimaria,
    });
  }, [config, reset]);

  async function aoEnviar(dados: ConfiguracoesEmpresaFormInput) {
    await atualizarEmpresa.mutateAsync({
      nome: dados.nome,
      fuso: dados.fuso,
      horarioComercial: formularioParaHorarioComercial(dados.horario),
      logoUrl: dados.logoUrl,
      corPrimaria: dados.corPrimaria,
    });
    setSalvoRecentemente(true);
    setTimeout(() => setSalvoRecentemente(false), 3000);
  }

  if (atual && atual.papel === "usuario") {
    return (
      <main className="mx-auto max-w-2xl p-4">
        <p className="text-sm text-muted-foreground">
          Só o dono ou um gestor da empresa pode alterar essas configurações.
        </p>
      </main>
    );
  }

  if (isLoading || !config) {
    return (
      <main className="mx-auto max-w-2xl p-4">
        <p className="text-sm text-muted-foreground">Carregando…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4">
      <h1 className="flex items-center gap-2 text-2xl font-semibold">
        <Building2 className="h-5 w-5" />
        Empresa
      </h1>

      <form onSubmit={handleSubmit(aoEnviar)} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Dados gerais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="nome">Nome da empresa</Label>
              <Input id="nome" {...register("nome")} />
              {errors.nome && <p className="text-sm text-destructive">{errors.nome.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fuso">Fuso horário</Label>
              <Controller
                control={control}
                name="fuso"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="fuso">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FUSOS_BRASIL.map((fuso) => (
                        <SelectItem key={fuso.valor} value={fuso.valor}>
                          {fuso.rotulo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.fuso && <p className="text-sm text-destructive">{errors.fuso.message}</p>}
            </div>

            <ConfiguracaoSlug empresaId={empresaId} slugAtual={atual?.slug ?? null} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Horário comercial</CardTitle>
            <CardDescription>
              Fora dele, a fila de envios reagenda a mensagem pro próximo horário — nunca bloqueia.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Controller
              control={control}
              name="horario"
              render={({ field }) => (
                <CampoHorarioComercial
                  value={field.value}
                  onChange={field.onChange}
                  erros={{
                    segSex: {
                      inicio: errors.horario?.segSex?.inicio?.message,
                      fim: errors.horario?.segSex?.fim?.message,
                    },
                    sab: {
                      inicio: errors.horario?.sab?.inicio?.message,
                      fim: errors.horario?.sab?.fim?.message,
                    },
                    dom: {
                      inicio: errors.horario?.dom?.inicio?.message,
                      fim: errors.horario?.dom?.fim?.message,
                    },
                  }}
                />
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Marca</CardTitle>
            <CardDescription>Usadas na página pública de captura.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Logo</Label>
              <Controller
                control={control}
                name="logoUrl"
                render={({ field }) => (
                  <CampoLogo empresaId={empresaId} value={field.value} onChange={field.onChange} />
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cor-primaria">Cor primária</Label>
              <Controller
                control={control}
                name="corPrimaria"
                render={({ field }) => (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="cor-primaria-ativa"
                      checked={field.value !== null}
                      onCheckedChange={(marcado) =>
                        field.onChange(marcado === true ? "#2563EB" : null)
                      }
                    />
                    <Label
                      htmlFor="cor-primaria-ativa"
                      className="font-normal text-muted-foreground"
                    >
                      Usar cor personalizada
                    </Label>
                    {field.value !== null && (
                      <input
                        id="cor-primaria"
                        type="color"
                        className="h-9 w-14 cursor-pointer rounded border border-input"
                        value={field.value}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    )}
                  </div>
                )}
              />
              {errors.corPrimaria && (
                <p className="text-sm text-destructive">{errors.corPrimaria.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {atual?.papel === "dono" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Carteira compartilhada</CardTitle>
              <CardDescription>
                Quando ativa, qualquer membro vê os contatos de todos, não só os próprios.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="carteira-compartilhada"
                  checked={config.carteiraCompartilhada}
                  onCheckedChange={(marcado) => alternarCarteira.mutate(marcado === true)}
                />
                <Label htmlFor="carteira-compartilhada" className="font-normal">
                  Carteira compartilhada entre a equipe
                </Label>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Salvando…" : "Salvar alterações"}
          </Button>
          {salvoRecentemente && (
            <span className="text-sm text-muted-foreground">Configurações salvas.</span>
          )}
        </div>
      </form>
    </main>
  );
}
