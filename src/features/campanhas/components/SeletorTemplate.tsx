import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTemplates } from "@/features/campanhas/api/useTemplates";

interface SeletorTemplateProps {
  empresaId: string | null;
  value: string | null;
  onChange: (templateId: string) => void;
}

/** Só templates de WhatsApp — é o único canal que exige template (spec). */
export function SeletorTemplate({ empresaId, value, onChange }: SeletorTemplateProps) {
  const { data: templates, isLoading } = useTemplates(empresaId);
  const templatesWhatsapp = (templates ?? []).filter((t) => t.canal === "whatsapp");

  return (
    <div className="space-y-1.5">
      <Select value={value ?? undefined} onValueChange={onChange} disabled={isLoading}>
        <SelectTrigger>
          <SelectValue placeholder={isLoading ? "Carregando…" : "Escolha um template"} />
        </SelectTrigger>
        <SelectContent>
          {templatesWhatsapp.map((template) => (
            <SelectItem key={template.id} value={template.id}>
              <span className="flex items-center gap-2">
                {template.nome}
                {template.status === "rascunho" && (
                  <Badge variant="outline" className="text-[10px]">
                    Não aprovado
                  </Badge>
                )}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!isLoading && templatesWhatsapp.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhum template de WhatsApp ainda —{" "}
          <Link to="/campanhas/templates/novo" className="underline">
            crie um
          </Link>{" "}
          antes de disparar.
        </p>
      )}
    </div>
  );
}
