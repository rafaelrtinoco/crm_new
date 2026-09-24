import { useMemo, useState, type ReactNode } from "react";
import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import {
  CalendarClock,
  CalendarDays,
  ChevronsUpDown,
  ChevronUp,
  Home,
  ListChecks,
  LogOut,
  Megaphone,
  Moon,
  Plus,
  Search,
  Sun,
  Users,
  Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useTema } from "@/app/useTema";
import { useRelogio } from "@/app/useRelogio";
import { useVocabulario } from "@/lib/vocabulario";
import { formatarDataHoraFuso, gradeCalendario, hojeNoFuso } from "@/lib/datas";
import { capitalizarPrimeiraLetra } from "@/lib/formatadores";
import { useAuth } from "@/features/auth/api/useAuth";
import { useEmpresaAtual, useEmpresas } from "@/features/onboarding/api/useEmpresas";
import { SinoNotificacoes } from "@/features/notificacoes/components/SinoNotificacoes";
import { DialogoTarefa } from "@/features/tarefas/components/DialogoTarefa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface ItemNavConfig {
  rotulo: string;
  rota: string;
  Icone: typeof Home;
  /** Item cujo destino agrupa várias rotas (ex.: "Marketing" cobre segmentos/campanhas) — fica ativo em qualquer uma delas, não só em `rota`. */
  prefixosAtivos?: string[];
}

const itensNav: ItemNavConfig[] = [
  { rotulo: "Início", rota: "/", Icone: Home },
  { rotulo: "Contatos", rota: "/contatos", Icone: Users },
  { rotulo: "Vencimentos", rota: "/vencimentos", Icone: CalendarClock },
  { rotulo: "Funis", rota: "/funis", Icone: Workflow },
  { rotulo: "Tarefas", rota: "/tarefas", Icone: ListChecks },
  {
    rotulo: "Marketing",
    rota: "/marketing",
    Icone: Megaphone,
    prefixosAtivos: ["/marketing", "/segmentos", "/campanhas", "/captura", "/relatorios"],
  },
];

/** Segmentos/campanhas/captura são rotas próprias (fora de /marketing), mas o item "Marketing" precisa acender pra elas — ver `prefixosAtivos`. */
function itemNavEstaAtivo(pathname: string, item: ItemNavConfig): boolean {
  if (item.prefixosAtivos)
    return item.prefixosAtivos.some((prefixo) => pathname.startsWith(prefixo));
  return item.rota === "/" ? pathname === "/" : pathname.startsWith(item.rota);
}

function iniciais(texto: string) {
  const partes = texto.trim().split(/\s+/);
  const primeira = partes[0]?.[0] ?? "";
  const ultima = partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? "") : "";
  return (primeira + ultima).toUpperCase() || "?";
}

function ItemNav({ rota, rotulo, Icone, prefixosAtivos }: ItemNavConfig) {
  const { pathname } = useLocation();
  const ativo = itemNavEstaAtivo(pathname, { rota, rotulo, Icone, prefixosAtivos });
  return (
    <Link
      to={rota}
      className={cn(
        // Sidebar é sempre escura (claro ou escuro) — hover em
        // opacidade sobre sidebar-foreground, não `accent` (que
        // pressupõe fundo claro). Item ativo vira pílula com o glow
        // do design system, não mais borda esquerda.
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-all duration-150 ease-in-out hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground",
        ativo &&
          "bg-primary text-primary-foreground shadow-sidebar-active hover:bg-primary hover:text-primary-foreground",
      )}
    >
      <Icone className="h-4 w-4 shrink-0" />
      {rotulo}
    </Link>
  );
}

function ItemNavMobile({ rota, rotulo, Icone, prefixosAtivos }: ItemNavConfig) {
  const { pathname } = useLocation();
  const ativo = itemNavEstaAtivo(pathname, { rota, rotulo, Icone, prefixosAtivos });
  return (
    <Link
      to={rota}
      className={cn(
        "flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium text-sidebar-foreground/60",
        ativo && "text-primary",
      )}
    >
      <Icone className="h-5 w-5" />
      {rotulo}
    </Link>
  );
}

function TrocadorEmpresa({ children }: { children: ReactNode }) {
  const { empresas, atual, selecionar } = useEmpresaAtual();

  if (empresas.length <= 1) return <>{children}</>;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Trocar de empresa</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {empresas.map((empresa) => (
          <DropdownMenuItem
            key={empresa.empresaId}
            onClick={() => selecionar(empresa.empresaId)}
            className={cn(empresa.empresaId === atual?.empresaId && "font-semibold")}
          >
            {empresa.nome}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface MenuUsuarioProps {
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
}

/**
 * "Meu Perfil"/"Configurações"/"Assinatura" ficam desabilitados de
 * propósito — sinalizam que vão existir sem fingir que já funcionam.
 * Nenhuma das três telas existe ainda (Configurações é módulo inteiro
 * do PRD §6.15; Assinatura é Fase 4 explícita).
 */
function MenuUsuario({ children, side = "bottom", align = "end" }: MenuUsuarioProps) {
  const { usuario } = useAuth();
  const { tema, alternar } = useTema();
  const nome =
    (usuario?.user_metadata as { nome?: string } | undefined)?.nome ?? usuario?.email ?? "";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent side={side} align={align} className="w-56">
        <DropdownMenuLabel className="truncate">{nome}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>Meu Perfil</DropdownMenuItem>
        <DropdownMenuItem disabled>Configurações</DropdownMenuItem>
        <DropdownMenuItem disabled>Assinatura</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={alternar}>
          {tema === "escuro" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
          {tema === "escuro" ? "Modo claro" : "Modo escuro"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => supabase.auth.signOut()}>
          <LogOut className="mr-2 h-4 w-4" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

interface RelogioCalendarioProps {
  fuso: string;
}

/**
 * Relógio da topbar — data/hora sempre no fuso da EMPRESA
 * (`empresas.fuso`), nunca no do navegador, mesma regra que já vale pra
 * "hoje" em toda a tela Hoje/réguas (`hojeNoFuso`). O calendário que
 * abre é só consulta visual (mês atual, hoje destacado) — clicar num
 * dia não faz nada, decisão tomada com o usuário: não existe (ainda)
 * nenhuma visão de calendário no produto pra linkar.
 */
function RelogioCalendario({ fuso }: RelogioCalendarioProps) {
  const agora = useRelogio();
  const hoje = hojeNoFuso(fuso);
  const [ano, mes] = hoje.split("-").map(Number) as [number, number];

  const grade = useMemo(() => gradeCalendario(ano, mes - 1), [ano, mes]);
  const nomeMes = useMemo(
    () =>
      new Intl.DateTimeFormat("pt-BR", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(Date.UTC(ano, mes - 1, 1))),
    [ano, mes],
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-all duration-150 ease-in-out hover:bg-accent hover:text-accent-foreground"
        >
          <CalendarDays className="h-4 w-4" />
          <span>{capitalizarPrimeiraLetra(formatarDataHoraFuso(agora, fuso))}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <p className="mb-2 text-center text-sm font-semibold">
          {capitalizarPrimeiraLetra(nomeMes)}
        </p>
        <div className="grid grid-cols-7 gap-y-1 text-center text-xs text-muted-foreground">
          {DIAS_SEMANA.map((dia, indice) => (
            <span key={`${dia}-${indice}`}>{dia}</span>
          ))}
          {grade.map((dia) => (
            <span
              key={dia.data}
              className={cn(
                "mx-auto flex h-7 w-7 items-center justify-center rounded-full text-xs text-foreground",
                !dia.noMes && "text-muted-foreground/40",
                dia.data === hoje && "bg-primary font-semibold text-primary-foreground",
              )}
            >
              {Number(dia.data.slice(-2))}
            </span>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface TopoDesktopProps {
  fuso: string;
  onNovaTarefa: () => void;
}

/**
 * Busca é só o campo visual por enquanto (lupa + placeholder) — sem
 * buscar nada ainda. A busca global de verdade (PRD §4: por nome,
 * telefone, e-mail, CPF/CNPJ) é um próximo passo à parte, não desta
 * rodada.
 */
function TopoDesktop({ fuso, onNovaTarefa }: TopoDesktopProps) {
  const vocabulario = useVocabulario();

  return (
    <header className="hidden shrink-0 items-center gap-3 border-b border-border bg-background px-6 py-3 md:flex">
      <div className="relative max-w-sm flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar" className="pl-9" />
      </div>
      {/* ml-auto: empurra o grupo pro canto direito, longe da busca —
          o relógio fica por último, no canto de verdade. */}
      <div className="ml-auto flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Criar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link to="/contatos/novo">Novo {vocabulario.contato.toLowerCase()}</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/vencimentos/novo">Novo {vocabulario.vencimento.toLowerCase()}</Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onNovaTarefa}>
              Nova {vocabulario.tarefa.toLowerCase()}
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/funis/negocios/novo">Novo {vocabulario.negocio.toLowerCase()}</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <RelogioCalendario fuso={fuso} />
      </div>
    </header>
  );
}

export function AppShell() {
  const { isLoading } = useEmpresas();
  const { empresas, atual } = useEmpresaAtual();
  const { usuario } = useAuth();
  const [dialogoTarefaAberto, setDialogoTarefaAberto] = useState(false);

  if (isLoading) return null;
  if (empresas.length === 0) return <Navigate to="/onboarding" replace />;

  const nomeUsuario =
    (usuario?.user_metadata as { nome?: string } | undefined)?.nome ?? usuario?.email ?? "";

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar — desktop */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-foreground/10 bg-sidebar md:flex">
        <div className="px-4 pb-4 pt-5">
          <TrocadorEmpresa>
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left transition-all duration-150 ease-in-out hover:bg-sidebar-foreground/10"
            >
              <div>
                <p className="font-display text-lg font-extrabold tracking-[-0.02em] leading-tight text-sidebar-foreground">
                  Facility
                </p>
                <p className="truncate text-xs text-muted-foreground">{atual?.nome}</p>
              </div>
              {empresas.length > 1 && (
                <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
            </button>
          </TrocadorEmpresa>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {itensNav.map((item) => (
            <ItemNav key={item.rota} {...item} />
          ))}
        </nav>

        <div className="flex items-center gap-1 border-t border-sidebar-foreground/10 p-3">
          <MenuUsuario side="top" align="start">
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2 text-left transition-all duration-150 ease-in-out hover:bg-sidebar-foreground/10"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {iniciais(nomeUsuario)}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-sidebar-foreground">
                {nomeUsuario}
              </span>
              <ChevronUp className="h-4 w-4 shrink-0 text-sidebar-foreground/50" />
            </button>
          </MenuUsuario>
          <SinoNotificacoes empresaId={atual?.empresaId ?? null} />
        </div>
      </aside>

      <div className="flex h-full min-h-0 w-full min-w-0 flex-col">
        {/* Barra superior — mobile */}
        <header className="flex shrink-0 items-center justify-between border-b border-sidebar-foreground/10 bg-sidebar px-4 py-3 md:hidden">
          <p className="font-display text-base font-extrabold tracking-[-0.02em] text-sidebar-foreground">
            {atual?.nome}
          </p>
          <div className="flex items-center gap-1">
            <SinoNotificacoes empresaId={atual?.empresaId ?? null} />
            <MenuUsuario>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
              >
                {iniciais(nomeUsuario)}
              </button>
            </MenuUsuario>
          </div>
        </header>

        {/* Topbar — desktop, busca + relógio + criar, presente em toda tela. */}
        <TopoDesktop
          fuso={atual?.fuso ?? "America/Sao_Paulo"}
          onNovaTarefa={() => setDialogoTarefaAberto(true)}
        />

        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto pb-16 md:pb-0">
          <Outlet />
        </main>

        {/* Abas inferiores — mobile */}
        <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-sidebar-foreground/10 bg-sidebar md:hidden">
          {itensNav.map((item) => (
            <ItemNavMobile key={item.rota} {...item} />
          ))}
        </nav>
      </div>

      <DialogoTarefa open={dialogoTarefaAberto} onOpenChange={setDialogoTarefaAberto} />
    </div>
  );
}
