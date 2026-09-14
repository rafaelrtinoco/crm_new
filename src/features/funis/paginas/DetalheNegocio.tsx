import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatarDataBR } from "@/lib/datas";
import { formatarBRL } from "@/lib/formatadores";
import { useVocabulario } from "@/lib/vocabulario";
import { useEmpresaAtual } from "@/features/onboarding/api/useEmpresas";
import { DialogoPerda } from "@/features/funis/components/DialogoPerda";
import { useEtapas, useMotivosPerda } from "@/features/funis/api/useFunis";
import {
  useExcluirNegocio,
  useMarcarGanho,
  useMarcarPerdido,
} from "@/features/funis/api/useMutacoesNegocio";
import { useNegocio } from "@/features/funis/api/useNegocios";
import { hojeNoFuso } from "@/lib/datas";
import { DialogoTarefa } from "@/features/tarefas/components/DialogoTarefa";
import { ItemTarefa } from "@/features/tarefas/components/ItemTarefa";
import { useExcluirTarefa } from "@/features/tarefas/api/useMutacoesTarefa";
import { useTarefas, type Tarefa } from "@/features/tarefas/api/useTarefas";

const rotuloStatus: Record<string, string> = {
  aberto: "Aberto",
  ganho: "Ganho",
  perdido: "Perdido",
};

export function DetalheNegocio() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const vocabulario = useVocabulario();
  const { atual } = useEmpresaAtual();
  const empresaId = atual?.empresaId ?? null;

  const { data: negocio, isLoading } = useNegocio(id ?? null);
  const { data: etapas } = useEtapas(negocio?.funilId ?? null);
  const { data: motivos } = useMotivosPerda(empresaId);
  const marcarGanho = useMarcarGanho(empresaId, negocio?.funilId ?? null);
  const marcarPerdido = useMarcarPerdido(empresaId, negocio?.funilId ?? null);
  const excluirNegocio = useExcluirNegocio(empresaId);
  const { data: tarefas } = useTarefas(empresaId, { negocioId: id, status: "todas" });
  const excluirTarefa = useExcluirTarefa();
  const hoje = hojeNoFuso(atual?.fuso ?? "America/Sao_Paulo");
  const [dialogoPerdaAberto, setDialogoPerdaAberto] = useState(false);
  const [dialogoTarefaAberto, setDialogoTarefaAberto] = useState(false);
  const [tarefaEditando, setTarefaEditando] = useState<Tarefa | null>(null);

  if (!isLoading && !negocio) return <Navigate to="/funis" replace />;

  const etapaNome = etapas?.find((e) => e.id === negocio?.etapaId)?.nome;
  const motivoNome = motivos?.find((m) => m.id === negocio?.motivoPerdaId)?.nome;

  async function ganhar() {
    if (!id) return;
    await marcarGanho.mutateAsync(id);
  }

  async function excluir() {
    if (!id) return;
    if (
      !window.confirm(
        `Excluir este ${vocabulario.negocio.toLowerCase()}? Essa ação não pode ser desfeita.`,
      )
    )
      return;
    await excluirNegocio.mutateAsync(id);
    navigate("/funis", { replace: true });
  }

  function abrirNovaTarefa() {
    setTarefaEditando(null);
    setDialogoTarefaAberto(true);
  }

  function abrirEdicaoTarefa(tarefa: Tarefa) {
    setTarefaEditando(tarefa);
    setDialogoTarefaAberto(true);
  }

  async function excluirTarefaDoNegocio(tarefa: Tarefa) {
    if (!window.confirm("Excluir esta tarefa? Essa ação não pode ser desfeita.")) return;
    await excluirTarefa.mutateAsync(tarefa.id);
  }

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <Link to="/funis" className="text-sm text-muted-foreground hover:underline">
          ← {vocabulario.negocioPlural}
        </Link>
        {negocio && negocio.status === "aberto" && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to={`/funis/negocios/${id}/editar`}>Editar</Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={excluir}>
              Excluir
            </Button>
          </div>
        )}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

      {negocio && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-xl">
              <Link to={`/contatos/${negocio.contatoId}`} className="hover:underline">
                {negocio.contatoNome}
              </Link>
              <Badge variant="secondary">{rotuloStatus[negocio.status] ?? negocio.status}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Etapa:</span> {etapaNome ?? "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Valor estimado:</span>{" "}
                {negocio.valorEstimado != null ? formatarBRL(negocio.valorEstimado) : "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Previsão de fechamento:</span>{" "}
                {negocio.previsaoFechamento ? formatarDataBR(negocio.previsaoFechamento) : "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Próximo passo:</span>{" "}
                {negocio.proximoPassoAcao} ({formatarDataBR(negocio.proximoPassoEm)})
              </p>
              {negocio.status === "perdido" && (
                <p>
                  <span className="text-muted-foreground">Motivo da perda:</span>{" "}
                  {motivoNome ?? "—"}
                  {negocio.reativarEm && <> — reativar em {formatarDataBR(negocio.reativarEm)}</>}
                </p>
              )}
            </div>

            {negocio.status === "aberto" && (
              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
                <Button size="sm" onClick={ganhar} disabled={marcarGanho.isPending}>
                  {marcarGanho.isPending ? "Marcando…" : "Marcar como ganho"}
                </Button>
                <Button size="sm" variant="destructive" onClick={() => setDialogoPerdaAberto(true)}>
                  Marcar como perdido
                </Button>
              </div>
            )}

            {marcarGanho.isSuccess && (
              <p className="rounded-md bg-accent px-3 py-2 text-sm text-accent-foreground">
                {vocabulario.negocio} ganho! Que tal{" "}
                <Link to={`/vencimentos/novo?contatoId=${negocio.contatoId}`} className="underline">
                  cadastrar o vencimento correspondente
                </Link>
                ?
              </p>
            )}

            <DialogoPerda
              motivos={motivos ?? []}
              open={dialogoPerdaAberto}
              pendente={marcarPerdido.isPending}
              onOpenChange={setDialogoPerdaAberto}
              onConfirmar={(input) => {
                if (!id) return;
                marcarPerdido.mutate(
                  { negocioId: id, ...input },
                  { onSuccess: () => setDialogoPerdaAberto(false) },
                );
              }}
            />
          </CardContent>
        </Card>
      )}

      {negocio && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Tarefas</CardTitle>
            <Button size="sm" variant="outline" onClick={abrirNovaTarefa}>
              + Nova tarefa
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {(!tarefas || tarefas.length === 0) && (
              <p className="text-sm text-muted-foreground">Nenhuma tarefa cadastrada.</p>
            )}
            {tarefas?.map((tarefa) => (
              <ItemTarefa
                key={tarefa.id}
                tarefa={tarefa}
                hoje={hoje}
                onEditar={() => abrirEdicaoTarefa(tarefa)}
                onExcluir={() => excluirTarefaDoNegocio(tarefa)}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {negocio && (
        <DialogoTarefa
          open={dialogoTarefaAberto}
          onOpenChange={setDialogoTarefaAberto}
          tarefa={tarefaEditando}
          negocioIdPadrao={id}
          negocioAcaoPadrao={negocio.proximoPassoAcao}
        />
      )}
    </main>
  );
}
