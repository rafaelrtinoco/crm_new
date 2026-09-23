import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { Plug } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useEmpresaAtual, useMembrosEmpresa } from "@/features/onboarding/api/useEmpresas";
import {
  useCriarIntegracao,
  useIntegracoes,
  useRevogarIntegracao,
} from "@/features/captura/api/useIntegracoes";
import { integracaoSchema, type IntegracaoFormInput } from "@/features/captura/schemas";

export function ListaIntegracoes() {
  const { atual } = useEmpresaAtual();
  const empresaId = atual?.empresaId ?? null;
  const { data: integracoes, isLoading } = useIntegracoes(empresaId);
  const { data: membros } = useMembrosEmpresa(empresaId);
  const criarIntegracao = useCriarIntegracao(empresaId);
  const revogarIntegracao = useRevogarIntegracao(empresaId);
  const [tokenCriado, setTokenCriado] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<IntegracaoFormInput>({
    resolver: zodResolver(integracaoSchema),
    defaultValues: { nome: "", distribuicaoTipo: "rodizio", responsavelFixoId: null },
  });

  const distribuicaoTipo = watch("distribuicaoTipo");

  async function aoEnviar(dados: IntegracaoFormInput) {
    const criada = await criarIntegracao.mutateAsync(dados);
    setTokenCriado(criada.token);
    reset();
  }

  async function revogar(id: string, nome: string) {
    if (
      !window.confirm(
        `Revogar a integração "${nome}"? O token dela para de funcionar imediatamente.`,
      )
    )
      return;
    await revogarIntegracao.mutateAsync(id);
  }

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4">
      <h1 className="text-2xl font-semibold">Integrações</h1>

      <Card>
        <CardHeader>
          <CardTitle>Nova integração (webhook genérico)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="space-y-4" onSubmit={handleSubmit(aoEnviar)} noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="nome">Nome</Label>
              <Input id="nome" {...register("nome")} placeholder="Ex.: Landing page do anúncio" />
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

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Gerando…" : "Gerar integração"}
            </Button>
          </form>

          {tokenCriado && (
            <div className="rounded-md border border-warning bg-warning/10 p-3 text-sm">
              <p className="mb-2 font-medium">
                Token gerado! Copie agora — por segurança, ele não aparece de novo depois desta
                tela.
              </p>
              <div className="flex items-center gap-2">
                <Input readOnly value={tokenCriado} className="font-mono text-xs" />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => navigator.clipboard.writeText(tokenCriado)}
                >
                  Copiar
                </Button>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Exemplo de chamada:</p>
              <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 text-xs">
                {`curl -X POST '${window.location.origin.replace("5173", "54321")}/rest/v1/rpc/receber_lead_webhook' \\
  -H 'apikey: <sua anon key>' -H 'Content-Type: application/json' \\
  -d '{"p_token":"${tokenCriado}","p_nome":"Fulano","p_telefone":"11999990000"}'`}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

      {!isLoading && integracoes && integracoes.length === 0 && (
        <EmptyState
          icone={Plug}
          titulo="Nenhuma integração criada"
          descricao="Gere um token pra receber leads de ferramentas de terceiro (landing pages, formulários externos) via webhook."
        />
      )}

      {!isLoading && integracoes && integracoes.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Último uso</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {integracoes.map((integracao) => (
              <TableRow key={integracao.id}>
                <TableCell>{integracao.nome}</TableCell>
                <TableCell>
                  <Badge
                    variant={integracao.ativo && !integracao.revogadoEm ? "success" : "outline"}
                  >
                    {integracao.ativo && !integracao.revogadoEm ? "Ativa" : "Revogada"}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {integracao.ultimoUsoEm
                    ? new Date(integracao.ultimoUsoEm).toLocaleString("pt-BR")
                    : "Nunca"}
                </TableCell>
                <TableCell className="text-right">
                  {integracao.ativo && !integracao.revogadoEm && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => revogar(integracao.id, integracao.nome)}
                    >
                      Revogar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
