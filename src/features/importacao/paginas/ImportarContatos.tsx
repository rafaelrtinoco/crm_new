import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { paraDataISO } from "@/lib/datas";
import { useVocabulario } from "@/lib/vocabulario";
import { useEmpresaAtual } from "@/features/onboarding/api/useEmpresas";
import { useCriarContato } from "@/features/contatos/api/useMutacoesContato";
import { useCriarVencimento } from "@/features/vencimentos/api/useMutacoesVencimento";
import { useVencimentoTipos } from "@/features/vencimentos/api/useVencimentoTipos";
import type { VencimentoInput } from "@/features/vencimentos/schemas";
import {
  useContatosExistentes,
  useCriarImportacao,
  useFinalizarImportacao,
  useRegistrarErroImportacao,
} from "@/features/importacao/api/useImportacao";
import { construirChavesExistentes } from "@/features/importacao/logica/deduplicacao";
import {
  rotuloCampoDestino,
  sugerirMapeamento,
  type CampoDestino,
} from "@/features/importacao/logica/mapeamentoColunas";
import {
  processarLinhas,
  type LinhaProcessada,
} from "@/features/importacao/logica/processarLinhas";
import { parseArquivo } from "@/features/importacao/logica/parseArquivo";
import { baixarModelo } from "@/features/importacao/logica/modeloPlanilha";

type Passo = "upload" | "mapear" | "preview" | "resultado";

const rotuloStatusLinha: Record<LinhaProcessada["status"], string> = {
  valida: "Válida",
  erro: "Erro",
  duplicada: "Duplicada",
};

/** PRD §6.1 — importação guiada de planilha, processada no navegador (ver ADR do 1C-3). */
export function ImportarContatos() {
  const navigate = useNavigate();
  const vocabulario = useVocabulario();
  const { atual } = useEmpresaAtual();
  const empresaId = atual?.empresaId ?? null;

  const { data: contatosExistentes } = useContatosExistentes(empresaId);
  const { data: tiposVencimento } = useVencimentoTipos(empresaId);
  const criarImportacao = useCriarImportacao(empresaId);
  const finalizarImportacao = useFinalizarImportacao(empresaId);
  const registrarErro = useRegistrarErroImportacao();
  const criarContato = useCriarContato(empresaId);
  const criarVencimento = useCriarVencimento(empresaId);

  const [passo, setPasso] = useState<Passo>("upload");
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [cabecalhos, setCabecalhos] = useState<string[]>([]);
  const [linhasBrutas, setLinhasBrutas] = useState<Record<string, string>[]>([]);
  const [mapeamento, setMapeamento] = useState<Record<string, CampoDestino | null>>({});
  const [linhasProcessadas, setLinhasProcessadas] = useState<LinhaProcessada[]>([]);
  const [erroArquivo, setErroArquivo] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [resultadoFinal, setResultadoFinal] = useState<{
    importadas: number;
    erros: number;
  } | null>(null);

  async function aoEscolherArquivo(arquivo: File) {
    setErroArquivo(null);
    try {
      const { cabecalhos: novoCabecalhos, linhas } = await parseArquivo(arquivo);
      if (linhas.length === 0) {
        setErroArquivo("A planilha não tem nenhuma linha de dados.");
        return;
      }
      setNomeArquivo(arquivo.name);
      setCabecalhos(novoCabecalhos);
      setLinhasBrutas(linhas);
      setMapeamento(sugerirMapeamento(novoCabecalhos));
      setPasso("mapear");
    } catch {
      setErroArquivo("Não foi possível ler este arquivo. Confira se é um .csv ou .xlsx válido.");
    }
  }

  function irParaPreview() {
    const chaves = construirChavesExistentes(contatosExistentes ?? []);
    setLinhasProcessadas(processarLinhas(linhasBrutas, mapeamento, chaves));
    setPasso("preview");
  }

  async function confirmarImportacao() {
    if (!empresaId) return;
    setProcessando(true);
    setProgresso(0);

    const validas = linhasProcessadas.filter((l) => l.status === "valida");
    const job = await criarImportacao.mutateAsync({
      arquivoNome: nomeArquivo,
      mapeamentoColunas: mapeamento,
      totalLinhas: linhasProcessadas.length,
    });

    let importadas = 0;
    let erros = 0;

    for (const [indice, linha] of validas.entries()) {
      try {
        const tipoEncontrado = linha.dados.vencimentoTipoNome
          ? tiposVencimento?.find(
              (t) => t.nome.toLowerCase() === linha.dados.vencimentoTipoNome?.toLowerCase(),
            )
          : undefined;

        const novoContato = await criarContato.mutateAsync({
          nome: linha.dados.nome ?? "",
          // Importação de planilha normalmente é a carteira existente do
          // cliente (não leads novos) — ver docs/PROGRESSO.md.
          status: "cliente",
          temperatura: "",
          origem: linha.dados.origem ?? "",
          telefone: linha.dados.telefone ?? "",
          email: linha.dados.email ?? "",
          cpfCnpj: linha.dados.cpfCnpj ?? "",
          nascimento: paraDataOuVazio(linha.dados.nascimento),
          responsavelId: "",
          endereco: {},
          campos: {},
        });

        if (linha.dados.dataVencimento) {
          await criarVencimento.mutateAsync({
            contatoId: novoContato.id,
            vencimentoTipoId: tipoEncontrado?.id ?? "",
            descricao: linha.dados.vencimentoTipoNome ?? "",
            dataVencimento:
              paraDataOuVazio(linha.dados.dataVencimento) || linha.dados.dataVencimento,
            valor: linha.dados.valor ?? "",
            recorrencia:
              (tipoEncontrado?.recorrenciaPadrao as VencimentoInput["recorrencia"]) ?? "anual",
            responsavelId: "",
            campos: {},
          });
        }

        importadas += 1;
      } catch {
        erros += 1;
        await registrarErro.mutateAsync({
          empresaId,
          importacaoId: job.id,
          linha: linha.linha,
          erro: "Não foi possível criar o contato — confira os dados da linha.",
          dadosOriginais: linha.dados as unknown as Record<string, unknown>,
        });
      }
      setProgresso(Math.round(((indice + 1) / validas.length) * 100));
    }

    const totalErros = erros + linhasProcessadas.filter((l) => l.status === "erro").length;
    await finalizarImportacao.mutateAsync({
      importacaoId: job.id,
      totalImportadas: importadas,
      totalErros,
      totalLinhas: linhasProcessadas.length,
    });

    setResultadoFinal({ importadas, erros: totalErros });
    setProcessando(false);
    setPasso("resultado");
  }

  function paraDataOuVazio(valor: string | undefined): string {
    if (!valor) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor;
    try {
      return paraDataISO(valor);
    } catch {
      return "";
    }
  }

  const contagem = {
    validas: linhasProcessadas.filter((l) => l.status === "valida").length,
    erros: linhasProcessadas.filter((l) => l.status === "erro").length,
    duplicadas: linhasProcessadas.filter((l) => l.status === "duplicada").length,
  };

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4">
      <Link to="/contatos" className="text-sm text-muted-foreground hover:underline">
        ← {vocabulario.contatoPlural}
      </Link>
      <h1 className="text-2xl font-semibold">Importar planilha</h1>

      {passo === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">1. Enviar arquivo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Aceita arquivos .csv ou .xlsx. Uma mesma linha pode gerar contato e vencimento juntos.
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => baixarModelo()}>
              Baixar modelo de planilha
            </Button>
            <input
              type="file"
              accept=".csv,.xlsx"
              onChange={(e) => {
                const arquivo = e.target.files?.[0];
                if (arquivo) void aoEscolherArquivo(arquivo);
              }}
              className="block text-sm"
            />
            {erroArquivo && <p className="text-sm text-destructive">{erroArquivo}</p>}
          </CardContent>
        </Card>
      )}

      {passo === "mapear" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">2. Mapear colunas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {linhasBrutas.length} linha(s) encontrada(s) em {nomeArquivo}. Confira a sugestão de
              cada coluna.
            </p>
            {cabecalhos.map((cabecalho) => (
              <div key={cabecalho} className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{cabecalho}</span>
                <Select
                  value={mapeamento[cabecalho] ?? "nenhum"}
                  onValueChange={(valor) =>
                    setMapeamento((atual) => ({
                      ...atual,
                      [cabecalho]: valor === "nenhum" ? null : (valor as CampoDestino),
                    }))
                  }
                >
                  <SelectTrigger className="w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">Não importar</SelectItem>
                    {(Object.keys(rotuloCampoDestino) as CampoDestino[]).map((campo) => (
                      <SelectItem key={campo} value={campo}>
                        {rotuloCampoDestino[campo]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
            <Button onClick={irParaPreview}>Ver prévia</Button>
          </CardContent>
        </Card>
      )}

      {passo === "preview" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">3. Prévia e validação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">
              <strong>{contagem.validas}</strong> válida(s) · <strong>{contagem.duplicadas}</strong>{" "}
              duplicada(s) · <strong>{contagem.erros}</strong> com erro
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Linha</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Detalhe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhasProcessadas.slice(0, 50).map((linha) => (
                  <TableRow key={linha.linha}>
                    <TableCell>{linha.linha}</TableCell>
                    <TableCell>{linha.dados.nome || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={linha.status === "valida" ? "secondary" : "outline"}>
                        {rotuloStatusLinha[linha.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{linha.mensagem || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {linhasProcessadas.length > 50 && (
              <p className="text-xs text-muted-foreground">
                Mostrando as primeiras 50 de {linhasProcessadas.length} linhas.
              </p>
            )}
            <Button onClick={confirmarImportacao} disabled={processando || contagem.validas === 0}>
              {processando ? `Importando… ${progresso}%` : `Importar ${contagem.validas} linha(s)`}
            </Button>
          </CardContent>
        </Card>
      )}

      {passo === "resultado" && resultadoFinal && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">4. Resultado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm">
              <strong>{resultadoFinal.importadas}</strong> {vocabulario.contato.toLowerCase()}(s)
              importado(s) com sucesso.{" "}
              {resultadoFinal.erros > 0 && (
                <span className="text-destructive">{resultadoFinal.erros} linha(s) com erro.</span>
              )}
            </p>
            <Button onClick={() => navigate("/contatos")}>
              Ver {vocabulario.contatoPlural.toLowerCase()}
            </Button>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
