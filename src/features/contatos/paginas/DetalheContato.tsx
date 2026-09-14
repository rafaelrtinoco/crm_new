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
import { formatarDataBR } from "@/lib/datas";
import { formatarCpfCnpj, formatarTelefone } from "@/lib/formatadores";
import { useAuth } from "@/features/auth/api/useAuth";
import { useEmpresaAtual } from "@/features/onboarding/api/useEmpresas";
import { useAtividades, useRegistrarAtividade } from "@/features/contatos/api/useAtividades";
import { useContato } from "@/features/contatos/api/useContatos";
import { useExcluirContato } from "@/features/contatos/api/useMutacoesContato";
import { useTagsDoContato } from "@/features/contatos/api/useTags";
import { TimelineContato } from "@/features/contatos/components/TimelineContato";

export function DetalheContato() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const { atual } = useEmpresaAtual();
  const { data: contato, isLoading } = useContato(id ?? null);
  const { data: atividades } = useAtividades(id ?? null);
  const { data: tags } = useTagsDoContato(id ?? null);
  const excluirContato = useExcluirContato(atual?.empresaId ?? null);
  const registrarAtividade = useRegistrarAtividade();

  const [dialogAberto, setDialogAberto] = useState(false);
  const [tipo, setTipo] = useState<"ligacao" | "nota">("ligacao");
  const [resultado, setResultado] = useState("");
  const [nota, setNota] = useState("");
  const [proximoPasso, setProximoPasso] = useState("");

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

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4">
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
          </Tabs>
        </>
      )}
    </main>
  );
}
