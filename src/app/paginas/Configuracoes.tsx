import { Link } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  CalendarClock,
  ListChecks,
  Tag,
  Workflow,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ITENS = [
  {
    titulo: "Empresa",
    descricao: "Nome, fuso, horário comercial, URL pública, logo e cor da marca.",
    href: "/configuracoes/empresa",
    Icone: Building2,
  },
  {
    titulo: "Funis",
    descricao: "Funis de venda e suas etapas.",
    href: "/configuracoes/funis",
    Icone: Workflow,
  },
  {
    titulo: "Tipos de vencimento",
    descricao: "Categorias de vencimento e a recorrência padrão de cada uma.",
    href: "/configuracoes/tipos-vencimento",
    Icone: CalendarClock,
  },
  {
    titulo: "Campos personalizados",
    descricao: "Campos extras no formulário de contato ou de vencimento.",
    href: "/configuracoes/campos-personalizados",
    Icone: ListChecks,
  },
  {
    titulo: "Tags",
    descricao: "Etiquetas pra organizar contatos — qualquer membro edita.",
    href: "/configuracoes/tags",
    Icone: Tag,
  },
  {
    titulo: "Motivos de perda",
    descricao: "Motivos obrigatórios ao marcar um negócio como perdido.",
    href: "/configuracoes/motivos-perda",
    Icone: XCircle,
  },
];

/**
 * Página índice de "Configurações" (PRD §6.15) — molde de `Marketing.tsx`.
 * Fatias 1 (Empresa) e 2 (Núcleo) implementadas; equipe (fatia 3) ainda não
 * tem tela — bloqueada por um furo de RLS, ver docs/configuracoes/SPEC-configuracoes-empresa.md.
 */
export function Configuracoes() {
  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4">
      <h1 className="text-2xl font-semibold">Configurações</h1>

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
