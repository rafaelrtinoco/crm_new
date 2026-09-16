import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatarDataBR, hojeNoFuso } from "@/lib/datas";
import { useVocabulario } from "@/lib/vocabulario";
import { useAuth } from "@/features/auth/api/useAuth";
import { useEmpresaAtual } from "@/features/onboarding/api/useEmpresas";
import { DialogoTarefa } from "@/features/tarefas/components/DialogoTarefa";
import { ItemTarefa } from "@/features/tarefas/components/ItemTarefa";
import { useExcluirTarefa } from "@/features/tarefas/api/useMutacoesTarefa";
import { useTarefas, type Tarefa } from "@/features/tarefas/api/useTarefas";
import { BarraPrimeirosPassos } from "@/features/hoje/components/BarraPrimeirosPassos";
import { CardsResumo } from "@/features/hoje/components/CardsResumo";
import { GraficoResumo } from "@/features/hoje/components/GraficoResumo";
import { ItemAcao, SecaoAcoesHoje } from "@/features/hoje/components/SecaoAcoesHoje";
import {
  useAniversariantesHoje,
  useLeadsSemContato,
  useNegociosVencidos,
  usePrimeirosPassos,
  useResumoNumeros,
  useVencimentosPendentesHoje,
  useVencimentosPorSemana,
} from "@/features/hoje/api/useResumoHoje";

function linkWhatsApp(telefone: string) {
  return `https://wa.me/55${telefone.replace(/\D/g, "")}`;
}

/** Tela "Hoje" (PRD §6.2) — tela inicial, lista de ações do dia ordenada por prioridade. */
export function Inicio() {
  const { usuario } = useAuth();
  const { atual } = useEmpresaAtual();
  const vocabulario = useVocabulario();
  const empresaId = atual?.empresaId ?? null;
  const hoje = useMemo(() => hojeNoFuso(atual?.fuso ?? "America/Sao_Paulo"), [atual?.fuso]);

  const nome = (usuario?.user_metadata as { nome?: string } | undefined)?.nome ?? usuario?.email;

  const { data: leads } = useLeadsSemContato(empresaId, hoje);
  const { data: tarefas } = useTarefas(empresaId, { status: "pendente" });
  const followUps = useMemo(
    () => (tarefas ?? []).filter((t) => t.dataVencimento <= hoje),
    [tarefas, hoje],
  );
  const { data: negociosVencidos } = useNegociosVencidos(empresaId, hoje);
  const { data: vencimentos } = useVencimentosPendentesHoje(empresaId, hoje);
  const { data: aniversariantes } = useAniversariantesHoje(empresaId, hoje);
  const { data: resumo } = useResumoNumeros(empresaId, hoje);
  const { data: vencimentosPorSemana } = useVencimentosPorSemana(empresaId, hoje);
  const { data: primeirosPassos } = usePrimeirosPassos(empresaId);

  const excluirTarefa = useExcluirTarefa();
  const [dialogoTarefaAberto, setDialogoTarefaAberto] = useState(false);
  const [tarefaEditando, setTarefaEditando] = useState<Tarefa | null>(null);

  function abrirEdicaoTarefa(tarefa: Tarefa) {
    setTarefaEditando(tarefa);
    setDialogoTarefaAberto(true);
  }

  async function excluir(tarefa: Tarefa) {
    if (!window.confirm("Excluir esta tarefa? Essa ação não pode ser desfeita.")) return;
    await excluirTarefa.mutateAsync(tarefa.id);
  }

  const totalAcoes =
    (leads?.length ?? 0) +
    followUps.length +
    (negociosVencidos?.length ?? 0) +
    (vencimentos?.length ?? 0) +
    (aniversariantes?.length ?? 0);

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-[-0.02em]">
          Bem-vindo(a), {nome}
        </h1>
        <p className="text-sm text-muted-foreground">
          Você está em <strong>{atual?.nome}</strong>.
        </p>
      </div>

      {resumo && <CardsResumo resumo={resumo} />}
      {resumo && (
        <GraficoResumo resumo={resumo} vencimentosPorSemana={vencimentosPorSemana ?? []} />
      )}

      {primeirosPassos && <BarraPrimeirosPassos passos={primeirosPassos} />}

      {totalAcoes === 0 && (
        <p className="flex items-center gap-2 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          <Sun className="h-4 w-4 text-success" />
          Nada pendente por hoje.
        </p>
      )}

      <SecaoAcoesHoje titulo="Leads sem primeiro contato" quantidade={leads?.length ?? 0}>
        {leads?.map((lead) => (
          <ItemAcao
            key={lead.id}
            titulo={lead.nome}
            subtitulo={
              lead.diasEspera === 0
                ? "Aguardando há menos de 1 dia"
                : `Aguardando há ${lead.diasEspera}d`
            }
            urgente={lead.diasEspera >= 1}
            acoes={
              <>
                {lead.telefone && (
                  <Button asChild size="sm">
                    <a href={linkWhatsApp(lead.telefone)} target="_blank" rel="noreferrer">
                      WhatsApp
                    </a>
                  </Button>
                )}
                <Button asChild size="sm" variant="outline">
                  <Link to={`/contatos/${lead.id}`}>Ver</Link>
                </Button>
              </>
            }
          />
        ))}
      </SecaoAcoesHoje>

      <SecaoAcoesHoje titulo="Follow-ups de hoje e atrasados" quantidade={followUps.length}>
        {followUps.map((tarefa) => (
          <ItemTarefa
            key={tarefa.id}
            tarefa={tarefa}
            hoje={hoje}
            onEditar={() => abrirEdicaoTarefa(tarefa)}
            onExcluir={() => excluir(tarefa)}
          />
        ))}
      </SecaoAcoesHoje>

      <SecaoAcoesHoje
        titulo="Negócios com próximo passo vencido"
        quantidade={negociosVencidos?.length ?? 0}
      >
        {negociosVencidos?.map((negocio) => (
          <ItemAcao
            key={negocio.id}
            titulo={`${negocio.contatoNome} — ${negocio.funilNome}`}
            subtitulo={`${negocio.proximoPassoAcao} (${formatarDataBR(negocio.proximoPassoEm)})`}
            urgente
            acoes={
              <Button asChild size="sm" variant="outline">
                <Link to={`/funis/negocios/${negocio.id}`}>Ver</Link>
              </Button>
            }
          />
        ))}
      </SecaoAcoesHoje>

      <SecaoAcoesHoje
        titulo={`${vocabulario.vencimentoPlural} vencendo`}
        quantidade={vencimentos?.length ?? 0}
      >
        {vencimentos?.map((vencimento) => (
          <ItemAcao
            key={vencimento.id}
            titulo={vencimento.contatoNome}
            subtitulo={`${vencimento.descricao ?? vocabulario.vencimento} — ${formatarDataBR(vencimento.dataVencimento)}`}
            urgente={vencimento.dataVencimento < hoje}
            acoes={
              <Button asChild size="sm" variant="outline">
                <Link to={`/vencimentos/${vencimento.id}`}>Ver</Link>
              </Button>
            }
          />
        ))}
      </SecaoAcoesHoje>

      <SecaoAcoesHoje titulo="Aniversariantes de hoje" quantidade={aniversariantes?.length ?? 0}>
        {aniversariantes?.map((aniversariante) => (
          <ItemAcao
            key={aniversariante.id}
            titulo={aniversariante.nome}
            subtitulo="Aniversário hoje"
            acoes={
              <>
                {aniversariante.telefone && (
                  <Button asChild size="sm">
                    <a
                      href={linkWhatsApp(aniversariante.telefone)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      WhatsApp
                    </a>
                  </Button>
                )}
                <Button asChild size="sm" variant="outline">
                  <Link to={`/contatos/${aniversariante.id}`}>Ver</Link>
                </Button>
              </>
            }
          />
        ))}
      </SecaoAcoesHoje>

      <DialogoTarefa
        open={dialogoTarefaAberto}
        onOpenChange={setDialogoTarefaAberto}
        tarefa={tarefaEditando}
      />
    </main>
  );
}
