import { useQuery } from "@tanstack/react-query";
import { formatarBRL, formatarCPF } from "@/lib/formatadores";
import { formatarDataBR, hojeNoFuso } from "@/lib/datas";
import { useVocabulario } from "@/lib/vocabulario";
import { useTema } from "@/app/useTema";

/**
 * Rota de smoke test do incremento 1A: prova que Vite, React, Router,
 * TanStack Query, Tailwind/shadcn, modo escuro e os utilitários de
 * `src/lib` estão de pé — sem depender do Supabase ainda.
 */
export function Smoke() {
  const vocabulario = useVocabulario();
  const { tema, alternar } = useTema();

  const { data: hoje } = useQuery({
    queryKey: ["hoje", "America/Sao_Paulo"],
    queryFn: () => hojeNoFuso("America/Sao_Paulo"),
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Facility</h1>
        <button
          type="button"
          onClick={alternar}
          className="rounded-md border border-border px-3 py-1.5 text-sm"
        >
          Tema: {tema}
        </button>
      </header>

      <section className="rounded-lg border border-border bg-card p-4 text-card-foreground">
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">Fundação (1A)</h2>
        <ul className="space-y-1 text-sm">
          <li>
            Vocabulário: {vocabulario.contatoPlural} · {vocabulario.vencimentoPlural} ·{" "}
            {vocabulario.negocioPlural}
          </li>
          <li>
            Hoje ({"America/Sao_Paulo"}): {hoje ? formatarDataBR(hoje) : "carregando…"}
          </li>
          <li>Formatação BRL: {formatarBRL(1234.5)}</li>
          <li>Formatação CPF: {formatarCPF("52998224725")}</li>
        </ul>
      </section>
    </main>
  );
}
