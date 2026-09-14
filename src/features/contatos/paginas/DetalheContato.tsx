import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { formatarDataBR, hojeNoFuso } from "@/lib/datas";
import { formatarCpfCnpj, formatarTelefone } from "@/lib/formatadores";
import { useAuth } from "@/features/auth/api/useAuth";
import { useEmpresaAtual } from "@/features/onboarding/api/useEmpresas";
import { useAtividades, useRegistrarAtividade } from "@/features/contatos/api/useAtividades";
import { useContato } from "@/features/contatos/api/useContatos";
import { useExcluirContato } from "@/features/contatos/api/useMutacoesContato";
import { useTagsDoContato } from "@/features/contatos/api/useTags";
import { TimelineContato } from "@/features/contatos/components/TimelineContato";
import { useVencimentos } from "@/features/vencimentos/api/useVencimentos";
import { useNegociosDoContato } from "@/features/funis/api/useNegocios";
import { DialogoTarefa } from "@/features/tarefas/components/DialogoTarefa";
import { ItemTarefa } from "@/features/tarefas/components/ItemTarefa";
import { useExcluirTarefa } from "@/features/tarefas/api/useMutacoesTarefa";
import { useTarefas, type Tarefa } from "@/features/tarefas/api/useTarefas";

export function DetalheContato() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const { atual } = useEmpresaAtual();
  const { data: contato, isLoading } = useContato(id ?? null);
  const { data: atividades } = useAtividades(id ?? null);
  const { data: tags } = useTagsDoContato(id ?? null);
  const { data: vencimentos } = useVencimentos(atual?.empresaId ?? null, { contatoId: id });
  const { data: negocios } = useNegociosDoContato(id ?? null);
  const { data: tarefas } = useTarefas(atual?.empresaId ?? null, {
    contatoId: id,
    status: "todas",
  });
  const excluirContato = useExcluirContato(atual?.empresaId ?? null);
  const excluirTarefa = useExcluirTarefa();
  const registrarAtividade = useRegistrarAtividade();
  const hoje = hojeNoFuso(atual?.fuso ?? "America/Sao_Paulo");

  const [dialogAberto, setDialogAberto] = useState(false);
  const [tipo, setTipo] = useState<"ligacao" | "nota">("ligacao");
  const [resultado, setResultado] = useState("");
  const [nota, setNota] = useState("");
  const [proximoPasso, setProximoPasso] = useState("");
  const [dialogoTarefaAberto, setDialogoTarefaAberto] = useState(false);
  const [tarefaEditando, setTarefaEditando] = useState<Tarefa | null>(null);

  if (!isLoading && !contato) return <Navigate to="/contatos" replace />;

  async function registrar() {
    if (!id || !atual?.empresaId || !usuario) return;
    await registrarAtividade.mutateAsync({
      empresaId: atual.empresaId,
      contatoId: id,
      tipo,
      resultado,
      nota,
      proximoPasso,
      responsavelId: usuario.id,
    });
    setResultado("");
    setNota("");
    setProximoPasso("");
    setDialogAberto(false);
  }

  async function excluir() {
    if (!id) return;
    if (!window.confirm("Excluir este contato? Essa ação não pode ser desfeita.")) return;
    await excluirContato.mutateAsync(id);
    navigate("/contatos", { replace: true });
  }

  function abrirNovaTarefa() {
    setTarefaEditando(null);
    setDialogoTarefaAberto(true);
  }

  function abrirEdicaoTarefa(tarefa: Tarefa) {
    setTarefaEditando(tarefa);
    setDialogoTarefaAberto(true);
  }

  async function excluirTarefaDoContato(tarefa: Tarefa) {
    if (!window.confirm("Excluir esta tarefa? Essa ação não pode ser desfeita.")) return;
    await excluirTarefa.mutateAsync(tarefa.id);
  }

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <Link to="/contatos" className="text-sm text-muted-foreground hover:underline">
          ← Contatos
        </Link>
        {contato && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to={`/contatos/${id}/editar`}>Editar</Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={excluir}>
              Excluir
            </Button>
          </div>
        )}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

      {contato && (
        <>
          <div>
            <h1 className="text-2xl font-semibold">{contato.nome}</h1>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <Badge variant="secondary">{contato.status}</Badge>
              {contato.temperatura && <Badge variant="outline">{contato.temperatura}</Badge>}
              {tags?.map((tag) => (
                <Badge key={tag.id} variant="outline">
                  {tag.nome}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            {contato.telefone && (
              <Button asChild size="sm">
                <a
                  href={`https://wa.me/55${contato.telefone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  WhatsApp
                </a>
              </Button>
            )}
            {contato.telefone && (
              <Button asChild size="sm" variant="outline">
                <a href={`tel:${contato.telefone.replace(/\D/g, "")}`}>Ligar</a>
              </Button>
            )}
            <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  Registrar contato
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Como foi?</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="tipo-atividade">Tipo</Label>
                    <Select value={tipo} onValueChange={(v) => setTipo(v as "ligacao" | "nota")}>
                      <SelectTrigger id="tipo-atividade">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ligacao">Ligação</SelectItem>
                        <SelectItem value="nota">Nota</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="resultado">Resultado</Label>
                    <Input
                      id="resultado"
                      placeholder="Ex.: sem resposta, agendou reunião…"
                      value={resultado}
                      onChange={(e) => setResultado(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="nota">Nota</Label>
                    <Textarea id="nota" value={nota} onChange={(e) => setNota(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="proximo-passo">Próximo passo</Label>
                    <Input
                      id="proximo-passo"
                      value={proximoPasso}
                      onChange={(e) => setProximoPasso(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={registrar} disabled={registrarAtividade.isPending || !resultado}>
                    {registrarAtividade.isPending ? "Salvando…" : "Salvar"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Tabs defaultValue="dados">
            <TabsList>
              <TabsTrigger value="dados">Dados</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="vencimentos">Vencimentos</TabsTrigger>
              <TabsTrigger value="negocios">Negócios</TabsTrigger>
              <TabsTrigger value="tarefas">Tarefas</TabsTrigger>
            </TabsList>
            <TabsContent value="dados" className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Telefone:</span>{" "}
                {contato.telefone ? formatarTelefone(contato.telefone) : "—"}
              </p>
              <p>
                <span className="text-muted-foreground">E-mail:</span> {contato.email || "—"}
              </p>
              <p>
                <span className="text-muted-foreground">CPF/CNPJ:</span>{" "}
                {contato.cpfCnpj ? formatarCpfCnpj(contato.cpfCnpj) : "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Nascimento:</span>{" "}
                {contato.nascimento ? formatarDataBR(contato.nascimento) : "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Origem:</span> {contato.origem || "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Último contato:</span>{" "}
                {contato.ultimoContatoEm
                  ? formatarDataBR(contato.ultimoContatoEm.slice(0, 10))
                  : "—"}
              </p>
            </TabsContent>
            <TabsContent value="timeline">
              <TimelineContato atividades={atividades ?? []} />
            </TabsContent>
            <TabsContent value="vencimentos" className="space-y-3">
              <Button size="sm" variant="outline" asChild>
                <Link to={`/vencimentos/novo?contatoId=${id}`}>+ Novo vencimento</Link>
              </Button>
              {(!vencimentos || vencimentos.length === 0) && (
                <p className="text-sm text-muted-foreground">Nenhum vencimento cadastrado.</p>
              )}
              {vencimentos && vencimentos.length > 0 && (
                <ul className="space-y-2">
                  {vencimentos.map((vencimento) => (
                    <li key={vencimento.id} className="flex items-center justify-between text-sm">
                      <Link to={`/vencimentos/${vencimento.id}`} className="hover:underline">
                        {vencimento.descricao || "Vencimento"} —{" "}
                        {formatarDataBR(vencimento.dataVencimento)}
                      </Link>
                      <Badge variant="secondary">{vencimento.status}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
            <TabsContent value="negocios" className="space-y-3">
              <Button size="sm" variant="outline" asChild>
                <Link to={`/funis/negocios/novo?contatoId=${id}`}>+ Novo negócio</Link>
              </Button>
              {(!negocios || negocios.length === 0) && (
                <p className="text-sm text-muted-foreground">Nenhum negócio cadastrado.</p>
              )}
              {negocios && negocios.length > 0 && (
                <ul className="space-y-2">
                  {negocios.map((negocio) => (
                    <li key={negocio.id} className="flex items-center justify-between text-sm">
                      <Link to={`/funis/negocios/${negocio.id}`} className="hover:underline">
                        {negocio.proximoPassoAcao} — {formatarDataBR(negocio.proximoPassoEm)}
                      </Link>
                      <Badge variant="secondary">{negocio.status}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
            <TabsContent value="tarefas" className="space-y-3">
              <Button size="sm" variant="outline" onClick={abrirNovaTarefa}>
                + Nova tarefa
              </Button>
              {(!tarefas || tarefas.length === 0) && (
                <p className="text-sm text-muted-foreground">Nenhuma tarefa cadastrada.</p>
              )}
              {tarefas && tarefas.length > 0 && (
                <div className="space-y-2">
                  {tarefas.map((tarefa) => (
                    <ItemTarefa
                      key={tarefa.id}
                      tarefa={tarefa}
                      hoje={hoje}
                      onEditar={() => abrirEdicaoTarefa(tarefa)}
                      onExcluir={() => excluirTarefaDoContato(tarefa)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogoTarefa
            open={dialogoTarefaAberto}
            onOpenChange={setDialogoTarefaAberto}
            tarefa={tarefaEditando}
            contatoIdPadrao={id}
          />
        </>
      )}
    </main>
  );
}
