import { Link } from "react-router-dom";
import { ArrowRight, Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ITENS = [
  {
    titulo: "Empresa",
    descricao: "Nome, fuso, horário comercial, URL pública, logo e cor da marca.",
    href: "/configuracoes/empresa",
    Icone: Building2,
  },
];

/**
 * Página índice de "Configurações" (PRD §6.15) — molde de `Marketing.tsx`.
 * Só a fatia 1 (Empresa) implementada; funis/tipos de vencimento/campos
 * personalizados/motivos de perda (fatia 2) e equipe (fatia 3) ainda não
 * têm tela — sem link morto, mesma regra que o 1D-1 seguiu com Funis/
 * Tarefas antes de essas telas existirem (ver docs/configuracoes/SPEC-configuracoes-empresa.md).
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
