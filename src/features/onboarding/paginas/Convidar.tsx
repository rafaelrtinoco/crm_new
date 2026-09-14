import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { conviteSchema, type ConviteInput } from "@/features/onboarding/schemas";
import { useConvites, useCriarConvite } from "@/features/onboarding/api/useOnboarding";
import { useEmpresaAtual } from "@/features/onboarding/api/useEmpresas";

const rotuloStatus: Record<string, string> = {
  pendente: "Pendente",
  aceito: "Aceito",
  expirado: "Expirado",
  cancelado: "Cancelado",
};

/**
 * Convidar equipe (PRD §5.2/§6.1). Entrega manual: gera o link e o gestor
 * envia por fora — sem Edge Function de e-mail neste incremento.
 * O guard de papel aqui é só UX; quem protege de verdade é a RLS de `convites`.
 */
export function Convidar() {
  const { atual } = useEmpresaAtual();
  const { data: convites } = useConvites(atual?.empresaId ?? null);
  const criarConvite = useCriarConvite(atual?.empresaId ?? null);
  const [linkGerado, setLinkGerado] = useState<string | null>(null);
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ConviteInput>({ resolver: zodResolver(conviteSchema) });

  async function aoEnviar(dados: ConviteInput) {
    const convite = await criarConvite.mutateAsync(dados);
    setLinkGerado(`${window.location.origin}/convite/${convite.token}`);
    reset();
  }

  if (atual && atual.papel === "usuario") {
    return (
      <main className="mx-auto max-w-lg p-4">
        <p className="text-sm text-muted-foreground">
          Só o dono ou um gestor da empresa pode convidar novos membros.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg space-y-6 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Convidar equipe</CardTitle>
          <CardDescription>Gera um link pra enviar por WhatsApp ou e-mail.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit(aoEnviar)} noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" {...register("email")} />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="papel">Papel</Label>
              <Controller
                control={control}
                name="papel"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="papel">
                      <SelectValue placeholder="Selecione o papel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gestor">Gestor</SelectItem>
                      <SelectItem value="usuario">Usuário</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.papel && <p className="text-sm text-destructive">{errors.papel.message}</p>}
            </div>
            {criarConvite.isError && (
              <p className="text-sm text-destructive">
                Não foi possível criar o convite. Confira se já não existe um convite pendente pra
                esse e-mail.
              </p>
            )}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Gerando…" : "Gerar convite"}
            </Button>
          </form>
          {linkGerado && (
            <div className="mt-4 rounded-md border border-border bg-muted p-3 text-sm">
              <p className="mb-2 font-medium">Convite criado! Copie e envie o link:</p>
              <div className="flex items-center gap-2">
                <Input readOnly value={linkGerado} className="text-xs" />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => navigator.clipboard.writeText(linkGerado)}
                >
                  Copiar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Convites enviados</CardTitle>
        </CardHeader>
        <CardContent>
          {!convites || convites.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum convite ainda.</p>
          ) : (
            <ul className="space-y-2">
              {convites.map((c) => (
                <li key={c.id} className="flex items-center justify-between text-sm">
                  <span>
                    {c.email} · {c.papel}
                  </span>
                  <span className="text-muted-foreground">
                    {rotuloStatus[c.status] ?? c.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
