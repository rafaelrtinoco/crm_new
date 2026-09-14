import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
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
import { empresaSchema, type EmpresaInput } from "@/features/onboarding/schemas";
import { useCriarEmpresa, useNichoTemplates } from "@/features/onboarding/api/useOnboarding";
import { useEmpresas } from "@/features/onboarding/api/useEmpresas";

/** Cadastro: nome + nicho → aplica o template → inicia o trial (PRD §6.1). */
export function CriarEmpresa() {
  const navigate = useNavigate();
  const { data: empresas } = useEmpresas();
  const { data: nichos, isLoading: carregandoNichos } = useNichoTemplates();
  const criarEmpresa = useCriarEmpresa();
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EmpresaInput>({ resolver: zodResolver(empresaSchema) });

  // Quem já tem empresa não precisa passar pelo onboarding de novo.
  useEffect(() => {
    if (empresas && empresas.length > 0) navigate("/", { replace: true });
  }, [empresas, navigate]);

  async function aoEnviar(dados: EmpresaInput) {
    await criarEmpresa.mutateAsync({ nome: dados.nome, nicho: dados.nicho, aceiteTermos: true });
    navigate("/", { replace: true });
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Criar sua empresa</CardTitle>
          <CardDescription>
            Escolha o nicho pra já vir com funis e vencimentos prontos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit(aoEnviar)} noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="nome">Nome da empresa</Label>
              <Input id="nome" {...register("nome")} />
              {errors.nome && <p className="text-sm text-destructive">{errors.nome.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nicho">Nicho</Label>
              <Controller
                control={control}
                name="nicho"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={carregandoNichos}
                  >
                    <SelectTrigger id="nicho">
                      <SelectValue placeholder="Selecione o nicho" />
                    </SelectTrigger>
                    <SelectContent>
                      {nichos?.map((n) => (
                        <SelectItem key={n.nicho} value={n.nicho}>
                          {n.nomeExibicao}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.nicho && <p className="text-sm text-destructive">{errors.nicho.message}</p>}
            </div>
            {criarEmpresa.isError && (
              <p className="text-sm text-destructive">
                Não foi possível criar a empresa. Tente de novo em instantes.
              </p>
            )}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Criando…" : "Criar empresa"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
