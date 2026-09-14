import { Mail, MessageCircle, MoreVertical, Phone, Users2, Circle } from "lucide-react";
import { Link } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatarDataBR } from "@/lib/datas";
import { useAlternarConclusaoTarefa } from "@/features/tarefas/api/useMutacoesTarefa";
import type { Tarefa } from "@/features/tarefas/api/useTarefas";

const iconePorTipo: Record<string, typeof Phone> = {
  ligar: Phone,
  whatsapp: MessageCircle,
  email: Mail,
  reuniao: Users2,
  outro: Circle,
};

interface Props {
  tarefa: Tarefa;
  hoje: string;
  onEditar: () => void;
  onExcluir: () => void;
}

export function ItemTarefa({ tarefa, hoje, onEditar, onExcluir }: Props) {
  const alternarConclusao = useAlternarConclusaoTarefa();
  const concluida = !!tarefa.concluidaEm;
  const vencida = !concluida && tarefa.dataVencimento < hoje;
  const Icone = iconePorTipo[tarefa.tipo] ?? Circle;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-md border px-3 py-2.5",
        vencida ? "border-urgencia bg-urgencia/5" : "border-border",
      )}
    >
      <Checkbox
        checked={concluida}
        onCheckedChange={(marcado) =>
          alternarConclusao.mutate({ tarefaId: tarefa.id, concluir: marcado === true })
        }
        aria-label={concluida ? "Reabrir tarefa" : "Concluir tarefa"}
      />
      <Icone className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-sm font-medium",
            concluida && "text-muted-foreground line-through",
          )}
        >
          {tarefa.titulo}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {formatarDataBR(tarefa.dataVencimento)}
          {tarefa.contatoNome && (
            <>
              {" — "}
              <Link to={`/contatos/${tarefa.contatoId}`} className="hover:underline">
                {tarefa.contatoNome}
              </Link>
            </>
          )}
          {tarefa.negocioAcao && !tarefa.contatoNome && <> — {tarefa.negocioAcao}</>}
        </p>
      </div>
      {vencida && <span className="shrink-0 text-xs font-medium text-urgencia">Atrasada</span>}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onEditar}>Editar</DropdownMenuItem>
          <DropdownMenuItem onClick={onExcluir}>Excluir</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
