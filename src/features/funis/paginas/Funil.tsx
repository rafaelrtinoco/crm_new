import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
import { DialogoProximoPasso } from "@/features/funis/components/DialogoProximoPasso";
import { ListaNegocios } from "@/features/funis/components/ListaNegocios";
import { QuadroFunil } from "@/features/funis/components/QuadroFunil";
import { useEtapas, useFunis } from "@/features/funis/api/useFunis";
import { useMoverNegocio } from "@/features/funis/api/useMutacoesNegocio";
import { useNegocios, type FiltrosNegocios } from "@/features/funis/api/useNegocios";

const SEM_FILTRO = "todos";

export function Funil() {
  const vocabulario = useVocabulario();
  const { atual } = useEmpresaAtual();
  const empresaId = atual?.empresaId ?? null;
  const hoje = useMemo(() => hojeNoFuso(atual?.fuso ?? "America/Sao_Paulo"), [atual?.fuso]);

  const [searchParams, setSearchParams] = useSearchParams();
  const funilIdParam = searchParams.get("funilId");
  const [visao, setVisao] = useState<"quadro" | "lista">(() =>
    typeof window !== "undefined" && window.innerWidth < 768 ? "lista" : "quadro",
  );
  const [responsavelId, setResponsavelId] = useState(SEM_FILTRO);
  const [status, setStatus] = useState("aberto");

  const { data: funis } = useFunis(empresaId);
  const funilId = funilIdParam ?? funis?.[0]?.id ?? null;
  const { data: etapas } = useEtapas(funilId);
  const { data: membros } = useMembrosEmpresa(empresaId);

  const filtros: FiltrosNegocios = {
    responsavelId: responsavelId === SEM_FILTRO ? undefined : responsavelId,
    status: status === SEM_FILTRO ? undefined : status,
  };
  const { data: negocios } = useNegocios(empresaId, funilId, filtros);
  const moverNegocio = useMoverNegocio(empresaId, funilId);

  const [movimento, setMovimento] = useState<{ negocioId: string; etapaId: string } | null>(null);

  useEffect(() => {
    if (!funilIdParam && funis && funis.length > 0 && funis[0]) {
      setSearchParams({ funilId: funis[0].id }, { replace: true });
    }
  }, [funilIdParam, funis, setSearchParams]);

  const negocioEmMovimento = negocios?.find((n) => n.id === movimento?.negocioId) ?? null;
  const etapaDestino = etapas?.find((e) => e.id === movimento?.etapaId) ?? null;

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{vocabulario.negocioPlural}</h1>
        <Button asChild>
          <Link to={`/funis/negocios/novo${funilId ? `?funilId=${funilId}` : ""}`}>
            Novo {vocabulario.negocio.toLowerCase()}
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {funis && funis.length > 1 && (
          <Select
            value={funilId ?? undefined}
            onValueChange={(id) => setSearchParams({ funilId: id })}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Funil" />
            </SelectTrigger>
            <SelectContent>
              {funis.map((funil) => (
                <SelectItem key={funil.id} value={funil.id}>
                  {funil.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="aberto">Abertos</SelectItem>
            <SelectItem value="ganho">Ganhos</SelectItem>
            <SelectItem value="perdido">Perdidos</SelectItem>
            <SelectItem value={SEM_FILTRO}>Todos</SelectItem>
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
        <div className="ml-auto hidden gap-1 rounded-md border border-border p-0.5 md:flex">
          <Button
            size="sm"
            variant={visao === "quadro" ? "secondary" : "ghost"}
            onClick={() => setVisao("quadro")}
          >
            Quadro
          </Button>
          <Button
            size="sm"
            variant={visao === "lista" ? "secondary" : "ghost"}
            onClick={() => setVisao("lista")}
          >
            Lista
          </Button>
        </div>
      </div>

      {etapas && negocios && (
        <>
          {/* Mobile: sempre em lista — arrastar colunas em tela pequena é ruim. */}
          <div className="md:hidden">
            <ListaNegocios negocios={negocios} etapas={etapas} hoje={hoje} />
          </div>

          {/* Desktop: quadro ou lista, conforme o alternador acima. */}
          <div className="hidden md:block">
            {visao === "quadro" ? (
              <QuadroFunil
                etapas={etapas}
                negocios={negocios}
                hoje={hoje}
                onSoltar={(negocioId, etapaId) => setMovimento({ negocioId, etapaId })}
              />
            ) : (
              <ListaNegocios negocios={negocios} etapas={etapas} hoje={hoje} />
            )}
          </div>
        </>
      )}

      <DialogoProximoPasso
        negocio={negocioEmMovimento}
        etapaDestinoNome={etapaDestino?.nome ?? ""}
        open={!!movimento}
        pendente={moverNegocio.isPending}
        onOpenChange={(aberto) => !aberto && setMovimento(null)}
        onConfirmar={(input) => {
          if (!negocioEmMovimento || !movimento || !etapaDestino) return;
          moverNegocio.mutate(
            {
              negocioId: negocioEmMovimento.id,
              contatoId: negocioEmMovimento.contatoId,
              etapaId: movimento.etapaId,
              ...input,
            },
            { onSuccess: () => setMovimento(null) },
          );
        }}
      />
    </main>
  );
}
