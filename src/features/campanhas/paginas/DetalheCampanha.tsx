import { Link, useNavigate, useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatarDataHoraFuso } from "@/lib/datas";
import { useEmpresaAtual } from "@/features/onboarding/api/useEmpresas";
import { CardMetricasCampanha } from "@/features/campanhas/components/CardMetricasCampanha";
import {
  useCampanha,
  useCampanhaEnvios,
  useCancelarCampanha,
  useDispararCampanha,
  usePreviewCampanha,
} from "@/features/campanhas/api/useCampanhas";

const ROTULO_STATUS_ENVIO: Record<string, string> = {
  pendente: "Pendente",
  enviada: "Enviada",
  bloqueada: "Bloqueada",
  falhou: "Falhou",
};

const ROTULO_MOTIVO: Record<string, string> = {
  variavel_sem_valor: "Variável sem valor pro contato",
  sem_consentimento_marketing: "Sem consentimento de marketing",
  optout: "Optou por não receber (opt-out)",
  sem_endereco_email: "Contato sem e-mail cadastrado",
  sem_endereco_whatsapp: "Contato sem telefone cadastrado",
  sem_horario_comercial: "Fora do horário comercial",
  contato_excluido: "Contato excluído",
};

export function DetalheCampanha() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { atual } = useEmpresaAtual();
  const empresaId = atual?.empresaId ?? null;

  const { data: campanha, isLoading } = useCampanha(id ?? null);
  const { data: preview } = usePreviewCampanha(
    campanha?.status === "rascunho" ? (id as string) : null,
  );
  const { data: envios } = useCampanhaEnvios(id ?? null);
  const dispararCampanha = useDispararCampanha(empresaId, id as string);
  const cancelarCampanha = useCancelarCampanha(empresaId);

  async function disparar() {
    if (
      !window.confirm(
        "Disparar esta campanha agora? A mensagem vai pra todo mundo que bate com o segmento — essa ação não pode ser desfeita.",
      )
    ) {
      return;
    }
    await dispararCampanha.mutateAsync();
  }

  async function cancelar() {
    if (!window.confirm("Cancelar esta campanha? Ela não poderá mais ser disparada.")) return;
    await cancelarCampanha.mutateAsync(id as string);
    navigate("/campanhas");
  }

  if (isLoading || !campanha) {
    return (
      <main className="mx-auto max-w-4xl p-4">
        <p className="text-sm text-muted-foreground">Carregando…</p>
      </main>
    );
  }

  const podeEditar = campanha.status === "rascunho";
  const podeDisparar = campanha.status === "rascunho";
  const podeCancelar = campanha.status === "rascunho" || campanha.status === "agendada";

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{campanha.nome}</h1>
          <p className="text-sm text-muted-foreground">
            {campanha.canal === "email" ? "E-mail" : "WhatsApp"}
            {campanha.agendadoPara &&
              ` • agendada para ${formatarDataHoraFuso(new Date(campanha.agendadoPara), atual?.fuso ?? "America/Sao_Paulo")}`}
            {campanha.disparadaEm &&
              ` • disparada em ${formatarDataHoraFuso(new Date(campanha.disparadaEm), atual?.fuso ?? "America/Sao_Paulo")}`}
          </p>
        </div>
        <div className="flex gap-2">
          {podeEditar && (
            <Button variant="outline" asChild>
              <Link to={`/campanhas/${id}/editar`}>Editar</Link>
            </Button>
          )}
          {podeCancelar && (
            <Button variant="outline" onClick={cancelar} disabled={cancelarCampanha.isPending}>
              Cancelar campanha
            </Button>
          )}
          {podeDisparar && (
            <Button onClick={disparar} disabled={dispararCampanha.isPending}>
              {dispararCampanha.isPending ? "Disparando…" : "Disparar agora"}
            </Button>
          )}
        </div>
      </div>

      {podeDisparar && preview && preview.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Prévia (dado real de um contato do segmento)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap rounded-lg border border-border bg-muted/40 p-3 text-sm">
              {preview[0]?.conteudoResolvido ?? "—"}
            </p>
          </CardContent>
        </Card>
      )}

      {podeDisparar && preview && preview.length === 0 && (
        <p className="text-sm text-muted-foreground">
          O segmento escolhido não bate com nenhum contato agora — não há prévia pra mostrar.
        </p>
      )}

      {campanha.status !== "rascunho" && campanha.status !== "agendada" && (
        <CardMetricasCampanha campanhaId={campanha.id} />
      )}

      {envios && envios.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Envios</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contato</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {envios.map((envio) => (
                  <TableRow key={envio.contatoId}>
                    <TableCell>{envio.contatoNome}</TableCell>
                    <TableCell>
                      <Badge variant={envio.status === "enviada" ? "success" : "outline"}>
                        {envio.status
                          ? ROTULO_STATUS_ENVIO[envio.status]
                          : "Bloqueado antes de enfileirar"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {envio.motivoBloqueio
                        ? (ROTULO_MOTIVO[envio.motivoBloqueio] ?? envio.motivoBloqueio)
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
