import { useRef, useState } from "react";
import { Building2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUploadLogo } from "@/features/configuracoes/api/useConfiguracoesEmpresa";

interface CampoLogoProps {
  empresaId: string | null;
  value: string | null;
  onChange: (url: string | null) => void;
}

/** Prévia + upload do logo pro bucket público `logos` — usado na página de captura pública. */
export function CampoLogo({ empresaId, value, onChange }: CampoLogoProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  const upload = useUploadLogo(empresaId);

  async function aoEscolherArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;

    setErro(null);
    try {
      const url = await upload.mutateAsync(arquivo);
      onChange(url);
    } catch (erroUpload) {
      setErro(erroUpload instanceof Error ? erroUpload.message : "Não foi possível enviar o logo.");
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
        {value ? (
          <img src={value} alt="Logo da empresa" className="h-full w-full object-contain" />
        ) : (
          <Building2 className="h-6 w-6 text-muted-foreground" />
        )}
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={aoEscolherArquivo}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={upload.isPending}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="mr-2 h-4 w-4" />
            {upload.isPending ? "Enviando…" : value ? "Trocar logo" : "Enviar logo"}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
              <X className="mr-2 h-4 w-4" />
              Remover
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">PNG, JPEG ou WebP, até 2 MB.</p>
        {erro && <p className="text-xs text-destructive">{erro}</p>}
      </div>
    </div>
  );
}
