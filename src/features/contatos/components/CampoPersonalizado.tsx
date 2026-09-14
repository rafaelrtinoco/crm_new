import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form";
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
import type { CampoPersonalizado as CampoPersonalizadoTipo } from "@/features/contatos/api/useCamposPersonalizados";

interface Props<TFormValues extends FieldValues> {
  campo: CampoPersonalizadoTipo;
  control: Control<TFormValues>;
  erro?: string;
}

/**
 * Renderiza um campo dinâmico de `campos_personalizados` conforme o `tipo`.
 * Genérico em `TFormValues` pra servir tanto o formulário de Contatos
 * quanto o de Vencimentos — o único requisito é ter um campo `campos`.
 */
export function CampoPersonalizado<TFormValues extends FieldValues>({
  campo,
  control,
  erro,
}: Props<TFormValues>) {
  const nome = `campos.${campo.chave}` as FieldPath<TFormValues>;
  const rotulo = campo.obrigatorio ? `${campo.rotulo} *` : campo.rotulo;

  return (
    <div className="space-y-1.5">
      {campo.tipo !== "booleano" && <Label htmlFor={nome}>{rotulo}</Label>}
      <Controller
        control={control}
        name={nome}
        render={({ field }) => {
          const valor = (field.value as string | number | boolean | undefined) ?? "";

          if (campo.tipo === "booleano") {
            return (
              <div className="flex items-center gap-2">
                <Checkbox
                  id={nome}
                  checked={Boolean(field.value)}
                  onCheckedChange={(marcado) => field.onChange(marcado === true)}
                />
                <Label htmlFor={nome} className="font-normal">
                  {rotulo}
                </Label>
              </div>
            );
          }

          if (campo.tipo === "selecao") {
            return (
              <Select value={String(valor)} onValueChange={field.onChange}>
                <SelectTrigger id={nome}>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {(campo.opcoes ?? []).map((opcao) => (
                    <SelectItem key={opcao} value={opcao}>
                      {opcao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            );
          }

          if (campo.tipo === "data") {
            return (
              <Input
                id={nome}
                type="date"
                value={String(valor)}
                onChange={(e) => field.onChange(e.target.value)}
              />
            );
          }

          return (
            <Input
              id={nome}
              type={campo.tipo === "numero" ? "number" : "text"}
              value={String(valor)}
              onChange={(e) => field.onChange(e.target.value)}
            />
          );
        }}
      />
      {erro && <p className="text-sm text-destructive">{erro}</p>}
    </div>
  );
}
