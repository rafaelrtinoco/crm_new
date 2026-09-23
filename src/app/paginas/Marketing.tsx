import { Link } from "react-router-dom";
import { ArrowRight, ClipboardList, LayoutTemplate, Plug, Send, Users2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ITENS = [
  {
    titulo: "Segmentos",
    descricao:
      "Filtros salvos sobre a base de contatos — status, tags, origem, tempo sem contato e mais.",
    href: "/segmentos",
    Icone: Users2,
  },
  {
    titulo: "Campanhas",
    descricao:
      "Disparo de e-mail ou WhatsApp em massa pra um segmento salvo, com prévia e métricas.",
    href: "/campanhas",
    Icone: Send,
  },
  {
    titulo: "Formulários de captura",
    descricao:
      "Formulário embutível no seu site — cada envio já entra como lead, distribuído pra equipe.",
    href: "/captura/formularios",
    Icone: ClipboardList,
  },
  {
    titulo: "Páginas de captura",
    descricao:
      "Página pública com a marca da sua empresa, pra receber leads de anúncios e redes sociais.",
    href: "/captura/paginas",
    Icone: LayoutTemplate,
  },
  {
    titulo: "Integrações",
    descricao: "Webhook genérico pra receber leads de ferramentas de terceiro via token.",
    href: "/captura/integracoes",
    Icone: Plug,
  },
];

/** Página índice de "Marketing" — agrupa segmentos, campanhas e captura de leads (SPEC-campanhas.md, decisão de navegação). */
export function Marketing() {
  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4">
      <h1 className="text-2xl font-semibold">Marketing</h1>

      <div className="grid gap-4 sm:grid-cols-2">
        {ITENS.map(({ titulo, descricao, href, Icone }) => (
          <Link key={href} to={href}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icone className="h-4 w-4" />
                  {titulo}
                </CardTitle>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{descricao}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  );
}
