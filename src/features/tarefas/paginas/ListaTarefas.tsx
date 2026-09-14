import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { hojeNoFuso } from "@/lib/datas";
import { useVocabulario } from "@/lib/vocabulario";
import { useEmpresaAtual, useMembrosEmpresa } from "@/features/onboarding/api/useEmpresas";
import { DialogoTarefa } from "@/features/tarefas/components/DialogoTarefa";
import { ItemTarefa } from "@/features/tarefas/components/ItemTarefa";
import { useExcluirTarefa } from "@/features/tarefas/api/useMutacoesTarefa";
import { useTarefas, type FiltrosTarefas, type Tarefa } from "@/features/tarefas/api/useTarefas";

const rotuloTipo: Record<string, string> = {
  ligar: "Ligar",
  whatsapp: "WhatsApp",
  email: "E-mail",
  reuniao: "Reunião",
  outro: "Outro",
};

const SEM_FILTRO = "todos";

export function ListaTarefas() {
  const vocabulario = useVocabulario();
  const { atual } = useEmpresaAtual();
  const empresaId = atual?.empresaId ?? null;
  const hoje = useMemo(() => hojeNoFuso(atual?.fuso ?? "America/Sao_Paulo"), [atual?.fuso]);

  const [status, setStatus] = useState<FiltrosTarefas["status"]>("pendente");
  const [tipo, setTipo] = useState(SEM_FILTRO);
  const [responsavelId, setResponsavelId] = useState(SEM_FILTRO);
  const [dialogoAberto, setDialogoAberto] = useState(false);
  const [tarefaEditando, setTarefaEditando] = useState<Tarefa | null>(null);

  const { data: membros } = useMembrosEmpresa(empresaId);
  const filtros: FiltrosTarefas = {
    status,
    tipo: tipo === SEM_FILTRO ? undefined : tipo,
    responsavelId: responsavelId === SEM_FILTRO ? undefined : responsavelId,
  };
  const { data: tarefas, isLoading } = useTarefas(empresaId, filtros);
  const excluirTarefa = useExcluirTarefa();

  const grupos = useMemo(() => {
    if (!tarefas || status !== "pendente") return null;
    return {
      atrasadas: tarefas.filter((t) => t.dataVencimento < hoje),
      hoje: tarefas.filter((t) => t.dataVencimento === hoje),
      proximas: tarefas.filter((t) => t.dataVencimento > hoje),
    };
  }, [tarefas, status, hoje]);

  function abrirNova() {
    setTarefaEditando(null);
    setDialogoAberto(true);
  }

  function abrirEdicao(tarefa: Tarefa) {
    setTarefaEditando(tarefa);
    setDialogoAberto(true);
  }

  async function excluir(tarefa: Tarefa) {
    if (
      !window.confirm(
        `Excluir esta ${vocabulario.tarefa.toLowerCase()}? Essa ação não pode ser desfeita.`,
      )
    )
      return;
    await excluirTarefa.mutateAsync(tarefa.id);
  }

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{vocabulario.tarefaPlural}</h1>
        <Button onClick={abrirNova}>Nova {vocabulario.tarefa.toLowerCase()}</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={status} onValueChange={(v) => setStatus(v as FiltrosTarefas["status"])}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pendente">Pendentes</SelectItem>
            <SelectItem value="concluida">Concluídas</SelectItem>
            <SelectItem value="todas">Todas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SEM_FILTRO}>Qualquer tipo</SelectItem>
            {Object.entries(rotuloTipo).map(([valor, rotulo]) => (
              <SelectItem key={valor} value={valor}>
                {rotulo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {membros && membros.length > 0 && (
          <Select value={responsavelId} onValueChange={setResponsavelId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SEM_FILTRO}>Qualquer responsável</SelectItem>
              {membros.map((membro) => (
                <SelectItem key={membro.usuarioId} value={membro.usuarioId}>
                  {membro.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

      {!isLoading && tarefas && tarefas.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhuma {vocabulario.tarefa.toLowerCase()} por aqui. Que tal criar a primeira?
        </p>
      )}

      {!isLoading && grupos && (
        <div className="space-y-5">
          {(
            [
              ["Atrasadas", grupos.atrasadas],
              ["Hoje", grupos.hoje],
              ["Próximas", grupos.proximas],
            ] as const
          ).map(([rotulo, lista]) =>
            lista.length > 0 ? (
              <div key={rotulo} className="space-y-2">
                <h2
                  className={
                    rotulo === "Atrasadas"
                      ? "text-sm font-semibold text-urgencia"
                      : "text-sm font-semibold text-muted-foreground"
                  }
                >
                  {rotulo}
                </h2>
                <div className="space-y-2">
                  {lista.map((tarefa) => (
                    <ItemTarefa
                      key={tarefa.id}
                      tarefa={tarefa}
                      hoje={hoje}
                      onEditar={() => abrirEdicao(tarefa)}
                      onExcluir={() => excluir(tarefa)}
                    />
                  ))}
                </div>
              </div>
            ) : null,
          )}
        </div>
      )}

      {!isLoading && tarefas && !grupos && tarefas.length > 0 && (
        <div className="space-y-2">
          {tarefas.map((tarefa) => (
            <ItemTarefa
              key={tarefa.id}
              tarefa={tarefa}
              hoje={hoje}
              onEditar={() => abrirEdicao(tarefa)}
              onExcluir={() => excluir(tarefa)}
            />
          ))}
        </div>
      )}

      <DialogoTarefa open={dialogoAberto} onOpenChange={setDialogoAberto} tarefa={tarefaEditando} />
    </main>
  );
}
