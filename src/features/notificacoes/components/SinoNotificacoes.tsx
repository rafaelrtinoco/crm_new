import { Bell, BellOff } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatarDataBR } from "@/lib/datas";
import { usePush } from "@/features/notificacoes/api/usePush";
import {
  useMarcarNotificacaoLida,
  useMarcarTodasLidas,
  useNotificacoes,
  type Notificacao,
} from "@/features/notificacoes/api/useNotificacoes";

interface Props {
  empresaId: string | null;
}

/** Sino de notificações (PRD §6.14) — central no app + botão de ativar push. */
export function SinoNotificacoes({ empresaId }: Props) {
  const { data: notificacoes } = useNotificacoes(empresaId);
  const marcarLida = useMarcarNotificacaoLida(empresaId);
  const marcarTodasLidas = useMarcarTodasLidas(empresaId);
  const push = usePush();

  const naoLidas = notificacoes?.filter((n) => !n.lidaEm).length ?? 0;

  function abrir(notificacao: Notificacao) {
    if (!notificacao.lidaEm) marcarLida.mutate(notificacao.id);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8"
          aria-label={naoLidas > 0 ? `Notificações — ${naoLidas} não lidas` : "Notificações"}
        >
          <Bell className="h-4 w-4" />
          {naoLidas > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-urgencia px-1 text-[10px] font-semibold text-urgencia-foreground">
              {naoLidas > 9 ? "9+" : naoLidas}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="p-0">Notificações</DropdownMenuLabel>
          {naoLidas > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 text-xs font-normal text-muted-foreground hover:text-foreground"
              onClick={() => marcarTodasLidas.mutate()}
            >
              Marcar todas como lidas
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />

        <div className="max-h-80 space-y-1 overflow-y-auto">
          {(!notificacoes || notificacoes.length === 0) && (
            <p className="px-2 py-4 text-center text-sm text-muted-foreground">
              Nenhuma notificação por aqui.
            </p>
          )}
          {notificacoes?.map((notificacao) => (
            <Link
              key={notificacao.id}
              to={notificacao.url ?? "/"}
              onClick={() => abrir(notificacao)}
              className={cn(
                "block rounded-md px-2 py-2 text-sm hover:bg-accent",
                !notificacao.lidaEm && "bg-accent/50",
              )}
            >
              <p className="font-medium">{notificacao.titulo}</p>
              <p className="text-xs text-muted-foreground">{notificacao.corpo}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {formatarDataBR(notificacao.createdAt.slice(0, 10))}
              </p>
            </Link>
          ))}
        </div>

        <DropdownMenuSeparator />
        <div className="px-2 py-1.5">
          {push.estado === "ativa" ? (
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 px-0 text-xs text-muted-foreground"
              onClick={() => push.desativar()}
              disabled={push.carregando}
            >
              <BellOff className="h-3.5 w-3.5" />
              Desativar notificações push
            </Button>
          ) : push.estado === "indisponivel" ? (
            <p className="text-xs text-muted-foreground">
              Este navegador não suporta notificações push.
            </p>
          ) : push.estado === "negada" ? (
            <p className="text-xs text-muted-foreground">
              Notificações bloqueadas — libere nas configurações do navegador.
            </p>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 px-0 text-xs text-primary"
              onClick={() => push.ativar()}
              disabled={push.carregando}
            >
              <Bell className="h-3.5 w-3.5" />
              {push.carregando ? "Ativando…" : "Ativar notificações push"}
            </Button>
          )}
          {push.erro && <p className="mt-1 text-xs text-destructive">{push.erro}</p>}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
