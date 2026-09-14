import { type ReactNode } from "react";
import { NavLink, Navigate, Outlet } from "react-router-dom";
import { CalendarClock, ChevronsUpDown, Home, LogOut, Users, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/features/auth/api/useAuth";
import { useEmpresaAtual, useEmpresas } from "@/features/onboarding/api/useEmpresas";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const itensNav = [
  { rotulo: "Início", rota: "/", Icone: Home },
  { rotulo: "Contatos", rota: "/contatos", Icone: Users },
  { rotulo: "Vencimentos", rota: "/vencimentos", Icone: CalendarClock },
  { rotulo: "Funis", rota: "/funis", Icone: Workflow },
];

function iniciais(texto: string) {
  const partes = texto.trim().split(/\s+/);
  const primeira = partes[0]?.[0] ?? "";
  const ultima = partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? "") : "";
  return (primeira + ultima).toUpperCase() || "?";
}

function ItemNav({ rota, rotulo, Icone }: { rota: string; rotulo: string; Icone: typeof Home }) {
  return (
    <NavLink
      to={rota}
      end={rota === "/"}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-md border-l-2 border-transparent px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-accent hover:text-accent-foreground",
          isActive && "border-l-primary bg-accent text-accent-foreground",
        )
      }
    >
      <Icone className="h-4 w-4 shrink-0" />
      {rotulo}
    </NavLink>
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

function MenuUsuario({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();
  const nome =
    (usuario?.user_metadata as { nome?: string } | undefined)?.nome ?? usuario?.email ?? "";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate">{nome}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => supabase.auth.signOut()}>
          <LogOut className="mr-2 h-4 w-4" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell() {
  const { isLoading } = useEmpresas();
  const { empresas, atual } = useEmpresaAtual();
  const { usuario } = useAuth();

  if (isLoading) return null;
  if (empresas.length === 0) return <Navigate to="/onboarding" replace />;

  const nomeUsuario =
    (usuario?.user_metadata as { nome?: string } | undefined)?.nome ?? usuario?.email ?? "";

  return (
    <div className="min-h-screen bg-background md:flex">
      {/* Sidebar — desktop */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-sidebar md:flex">
        <div className="px-4 pb-4 pt-5">
          <TrocadorEmpresa>
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left hover:bg-accent"
            >
              <div>
                <p className="font-display text-lg font-medium leading-tight text-sidebar-foreground">
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

        <div className="border-t border-border p-3">
          <MenuUsuario>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-accent"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {iniciais(nomeUsuario)}
              </span>
              <span className="truncate text-sm font-medium text-sidebar-foreground">
                {nomeUsuario}
              </span>
            </button>
          </MenuUsuario>
        </div>
      </aside>

      <div className="flex min-h-screen w-full flex-col md:min-h-0">
        {/* Barra superior — mobile */}
        <header className="flex items-center justify-between border-b border-border bg-sidebar px-4 py-3 md:hidden">
          <p className="font-display text-base font-medium text-sidebar-foreground">
            {atual?.nome}
          </p>
          <MenuUsuario>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
            >
              {iniciais(nomeUsuario)}
            </button>
          </MenuUsuario>
        </header>

        <main className="flex-1 pb-16 md:pb-0">
          <Outlet />
        </main>

        {/* Abas inferiores — mobile */}
        <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-border bg-sidebar md:hidden">
          {itensNav.map(({ rota, rotulo, Icone }) => (
            <NavLink
              key={rota}
              to={rota}
              end={rota === "/"}
              className={({ isActive }) =>
                cn(
                  "flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium text-sidebar-foreground/60",
                  isActive && "text-primary",
                )
              }
            >
              <Icone className="h-5 w-5" />
              {rotulo}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
