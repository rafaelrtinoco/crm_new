import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { formatarTelefone } from "@/lib/formatadores";
import { cadastroSchema, type CadastroInput } from "@/features/auth/schemas";

export function Cadastro() {
  const navigate = useNavigate();
  const location = useLocation();
  const [erro, setErro] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CadastroInput>({ resolver: zodResolver(cadastroSchema) });

  async function aoEnviar(dados: CadastroInput) {
    setErro(null);
    const { error } = await supabase.auth.signUp({
      email: dados.email,
      password: dados.senha,
      options: { data: { nome: dados.nome, telefone: dados.telefone } },
    });
    if (error) {
      setErro(
        error.message.includes("already registered")
          ? "Já existe uma conta com este e-mail."
          : "Não foi possível criar a conta. Tente de novo em instantes.",
      );
      return;
    }
    // Se veio de um link de convite (/convite/:token), volta pra lá em
    // vez de cair direto em "criar empresa" — senão a pessoa convidada
    // acaba criando a própria empresa por engano.
    const destino = (location.state as { de?: string } | null)?.de ?? "/onboarding";
    navigate(destino, { replace: true });
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Criar conta</CardTitle>
          <CardDescription>Comece a organizar sua carteira de clientes.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit(aoEnviar)} noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="nome">Nome</Label>
              <Input id="nome" autoComplete="name" {...register("nome")} />
              {errors.nome && <p className="text-sm text-destructive">{errors.nome.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="telefone">WhatsApp</Label>
              <Controller
                control={control}
                name="telefone"
                render={({ field }) => (
                  <Input
                    id="telefone"
                    inputMode="tel"
                    placeholder="(11) 98888-0000"
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(formatarTelefone(e.target.value))}
                  />
                )}
              />
              {errors.telefone && (
                <p className="text-sm text-destructive">{errors.telefone.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" autoComplete="email" {...register("email")} />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="senha">Senha</Label>
              <Input
                id="senha"
                type="password"
                autoComplete="new-password"
                {...register("senha")}
              />
              {errors.senha && <p className="text-sm text-destructive">{errors.senha.message}</p>}
            </div>
            <Controller
              control={control}
              name="aceiteTermos"
              render={({ field }) => (
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="aceiteTermos"
                    checked={field.value ?? false}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                  />
                  <Label htmlFor="aceiteTermos" className="text-sm font-normal leading-tight">
                    Li e aceito os{" "}
                    <Link to="/termos" target="_blank" className="underline underline-offset-2">
                      Termos de Uso
                    </Link>{" "}
                    e a{" "}
                    <Link
                      to="/privacidade"
                      target="_blank"
                      className="underline underline-offset-2"
                    >
                      Política de Privacidade
                    </Link>
                    .
                  </Label>
                </div>
              )}
            />
            {errors.aceiteTermos && (
              <p className="text-sm text-destructive">{errors.aceiteTermos.message}</p>
            )}
            {erro && <p className="text-sm text-destructive">{erro}</p>}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Criando conta…" : "Criar conta"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Já tem conta?{" "}
            <Link to="/entrar" className="text-primary underline-offset-4 hover:underline">
              Entrar
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
