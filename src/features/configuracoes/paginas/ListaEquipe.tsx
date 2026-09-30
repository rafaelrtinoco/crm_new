import { useState } from "react";
import { Link } from "react-router-dom";
import { UserPlus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/features/auth/api/useAuth";
import { useEmpresaAtual, useMembrosEmpresa } from "@/features/onboarding/api/useEmpresas";
import {
  useAtualizarPapelMembro,
  useRemoverMembro,
} from "@/features/configuracoes/api/useEquipeConfig";

const ROTULO_PAPEL: Record<"dono" | "gestor" | "usuario", string> = {
  dono: "Dono",
  gestor: "Gestor",
  usuario: "Usuário",
};

/**
 * Equipe — trocar papel / remover membro (PRD §6.15/§5.2). A guarda real
 * é o trigger `impedir_escalada_privilegio_membro` no banco; o que a UI
 * faz aqui é só não OFERECER uma ação que o banco ia rejeitar (mesmo
 * espírito de `Convidar.tsx`: guard de papel é UX, quem protege de
 * verdade é o banco).
 */
export function ListaEquipe() {
  const { usuario } = useAuth();
  const { atual } = useEmpresaAtual();
  const empresaId = atual?.empresaId ?? null;
  const { data: membros, isLoading } = useMembrosEmpresa(empresaId);
  const atualizarPapel = useAtualizarPapelMembro(empresaId);
  const removerMembro = useRemoverMembro(empresaId);
  const [erro, setErro] = useState<string | null>(null);

  if (atual && atual.papel === "usuario") {
    return (
      <main className="mx-auto max-w-2xl p-4">
        <p className="text-sm text-muted-foreground">
          Só o dono ou um gestor da empresa pode gerenciar a equipe.
        </p>
      </main>
    );
  }

  const souDono = atual?.papel === "dono";

  async function mudarPapel(usuarioId: string, papel: "dono" | "gestor" | "usuario") {
    setErro(null);
    try {
      await atualizarPapel.mutateAsync({ usuarioId, papel });
    } catch (erroMudar) {
      setErro(erroMudar instanceof Error ? erroMudar.message : "Não foi possível salvar.");
    }
  }

  async function remover(usuarioId: string, nome: string) {
    setErro(null);
    if (!window.confirm(`Remover ${nome} da equipe?`)) return;
    try {
      await removerMembro.mutateAsync(usuarioId);
    } catch (erroRemover) {
      setErro(erroRemover instanceof Error ? erroRemover.message : "Não foi possível remover.");
    }
  }

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Equipe</h1>
        <Button asChild>
          <Link to="/convidar">
            <UserPlus className="mr-2 h-4 w-4" />
            Convidar
          </Link>
        </Button>
      </div>

      {erro && <p className="text-sm text-destructive">{erro}</p>}

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

      {!isLoading && membros && membros.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {membros.map((membro) => {
              const ehVocê = membro.usuarioId === usuario?.id;
              const alvoEhDono = membro.papel === "dono";
              // Gestor não mexe em linha de dono (banco rejeitaria); dono não mexe na própria linha (guard de UX).
              const podeGerenciar = !ehVocê && (souDono || !alvoEhDono);

              return (
                <TableRow key={membro.usuarioId}>
                  <TableCell>
                    {membro.nome}
                    {ehVocê && (
                      <Badge variant="outline" className="ml-2 text-[10px]">
                        Você
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {podeGerenciar ? (
                      <Select
                        value={membro.papel}
                        onValueChange={(papel) =>
                          mudarPapel(membro.usuarioId, papel as "dono" | "gestor" | "usuario")
                        }
                      >
                        <SelectTrigger className="w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="usuario">Usuário</SelectItem>
                          <SelectItem value="gestor">Gestor</SelectItem>
                          {souDono && <SelectItem value="dono">Dono</SelectItem>}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-muted-foreground">{ROTULO_PAPEL[membro.papel]}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {podeGerenciar ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => remover(membro.usuarioId, membro.nome)}
                      >
                        Remover
                      </Button>
                    ) : (
                      !ehVocê && (
                        <span className="text-xs text-muted-foreground">
                          Só o dono altera outro dono
                        </span>
                      )
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {!isLoading && (!membros || membros.length === 0) && (
        <EmptyState icone={Users} titulo="Nenhum membro encontrado" />
      )}
    </main>
  );
}
