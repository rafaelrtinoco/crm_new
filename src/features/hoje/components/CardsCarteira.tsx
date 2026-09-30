import { Link } from "react-router-dom";
import { RefreshCw, Tag, Target, UserCheck, UserPlus, UserX } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { ResumoCarteira } from "@/features/hoje/api/useResumoCarteira";

interface Props {
  resumo: ResumoCarteira;
}

/** Cards da carteira de clientes existente, abaixo dos cards do dia — mesmo estilo de `CardsResumo`, mas clicáveis: cada um leva pra `/contatos` já filtrado. */
export function CardsCarteira({ resumo }: Props) {
  const itens = [
    {
      rotulo: "Clientes ativos",
      valor: String(resumo.clientesAtivos),
      Icone: UserCheck,
      href: "/contatos?status=cliente",
    },
    {
      rotulo: "Clientes inativos",
      valor: String(resumo.clientesInativos),
      Icone: UserX,
      href: "/contatos?status=inativo",
    },
    {
      rotulo: "Novos clientes (mês)",
      valor: String(resumo.novosClientesMes),
      Icone: UserPlus,
      href: "/contatos?carteira=novos",
    },
    {
      rotulo: "Clientes p/ reativar",
      valor: String(resumo.clientesParaReativar),
      Icone: RefreshCw,
      href: "/contatos?carteira=reativar",
    },
    {
      rotulo: "Clientes sem tag",
      valor: String(resumo.clientesSemTag),
      Icone: Tag,
      href: "/contatos?carteira=sem-tag",
    },
    {
      rotulo: "Sem negócio aberto",
      valor: String(resumo.clientesSemNegocioAberto),
      Icone: Target,
      href: "/contatos?carteira=sem-negocio",
    },
  ];

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground">Carteira de clientes</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {itens.map((item) => (
          <Link key={item.rotulo} to={item.href}>
            <Card variant="destaque" className="h-full transition-shadow hover:shadow-md">
              <CardContent className="space-y-3 p-5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <item.Icone className="h-4 w-4" />
                </span>
                <p className="font-display text-2xl font-extrabold leading-none tracking-[-0.02em]">
                  {item.valor}
                </p>
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                  {item.rotulo}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
