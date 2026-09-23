import { useParams } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { FormularioEmbutivel } from "@/features/captura/components/FormularioEmbutivel";
import { usePaginaCapturaPublica } from "@/features/captura/api/useCapturaPublica";

/** Página de captura pública, com a marca da empresa (PRD §6.10). */
export function PaginaCapturaPublica() {
  const { empresaSlug, paginaSlug } = useParams<{ empresaSlug: string; paginaSlug: string }>();
  const {
    data: pagina,
    isLoading,
    isError,
  } = usePaginaCapturaPublica(empresaSlug ?? null, paginaSlug ?? null);

  if (isLoading) {
    return (
      <main className="mx-auto max-w-xl p-8 text-center text-sm text-muted-foreground">
        Carregando…
      </main>
    );
  }

  if (isError || !pagina) {
    return (
      <main className="mx-auto max-w-xl p-8 text-center text-sm text-muted-foreground">
        Página não encontrada.
      </main>
    );
  }

  const linkWhatsapp = pagina.whatsappNumero
    ? `https://wa.me/55${pagina.whatsappNumero.replace(/\D/g, "")}${
        pagina.whatsappMensagem ? `?text=${encodeURIComponent(pagina.whatsappMensagem)}` : ""
      }`
    : null;

  return (
    <main
      className="mx-auto max-w-xl space-y-6 p-6"
      style={pagina.empresaCorPrimaria ? { accentColor: pagina.empresaCorPrimaria } : undefined}
    >
      <header className="space-y-3 text-center">
        {pagina.empresaLogoUrl && (
          <img src={pagina.empresaLogoUrl} alt={pagina.empresaNome} className="mx-auto h-12" />
        )}
        <h1 className="text-2xl font-semibold">{pagina.titulo}</h1>
        {pagina.texto && <p className="text-muted-foreground">{pagina.texto}</p>}
      </header>

      {pagina.imagemUrl && (
        <img src={pagina.imagemUrl} alt="" className="w-full rounded-lg object-cover" />
      )}

      {pagina.formularioId && (
        <div className="rounded-lg border border-border p-4">
          <FormularioEmbutivel formularioId={pagina.formularioId} />
        </div>
      )}

      {linkWhatsapp && (
        <a
          href={linkWhatsapp}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-2 rounded-lg bg-success px-4 py-3 text-sm font-medium text-success-foreground"
        >
          <MessageCircle className="h-4 w-4" />
          Falar no WhatsApp
        </a>
      )}

      <p className="text-center text-xs text-muted-foreground">{pagina.empresaNome}</p>
    </main>
  );
}
