import { ArrowDown, ArrowUp, ImageIcon, Plus, Trash2, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { BlocoFormInput } from "@/features/campanhas/schemas";

interface EditorBlocosProps {
  blocos: BlocoFormInput[];
  onChange: (blocos: BlocoFormInput[]) => void;
}

/**
 * Editor "simples com blocos" do e-mail (SPEC-campanhas.md, Assunção 2):
 * lista ordenada de blocos texto/imagem, sem drag-and-drop nem HTML
 * livre — reordena com as setas, não com arrastar.
 */
export function EditorBlocos({ blocos, onChange }: EditorBlocosProps) {
  function adicionar(tipo: BlocoFormInput["tipo"]) {
    onChange([...blocos, { tipo, conteudo: "" }]);
  }

  function atualizar(indice: number, conteudo: string) {
    onChange(blocos.map((bloco, i) => (i === indice ? { ...bloco, conteudo } : bloco)));
  }

  function remover(indice: number) {
    onChange(blocos.filter((_, i) => i !== indice));
  }

  function mover(indice: number, direcao: -1 | 1) {
    const destino = indice + direcao;
    if (destino < 0 || destino >= blocos.length) return;
    const copia = [...blocos];
    const [removido] = copia.splice(indice, 1);
    if (!removido) return;
    copia.splice(destino, 0, removido);
    onChange(copia);
  }

  return (
    <div className="space-y-3">
      {blocos.length === 0 && (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          Sem blocos ainda — adicione texto ou imagem.
        </p>
      )}

      {blocos.map((bloco, indice) => (
        <div key={indice} className="space-y-2 rounded-lg border border-border p-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {bloco.tipo === "texto" ? (
                <Type className="h-3.5 w-3.5" />
              ) : (
                <ImageIcon className="h-3.5 w-3.5" />
              )}
              {bloco.tipo === "texto" ? "Texto" : "Imagem (URL)"}
            </span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={indice === 0}
                onClick={() => mover(indice, -1)}
                aria-label="Mover pra cima"
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={indice === blocos.length - 1}
                onClick={() => mover(indice, 1)}
                aria-label="Mover pra baixo"
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => remover(indice)}
                aria-label="Remover bloco"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <Textarea
            value={bloco.conteudo}
            onChange={(e) => atualizar(indice, e.target.value)}
            placeholder={
              bloco.tipo === "texto"
                ? "Olá {{primeiro_nome}}, temos uma novidade pra você…"
                : "https://…"
            }
            rows={bloco.tipo === "texto" ? 3 : 1}
          />
        </div>
      ))}

      <div className="flex items-center gap-2">
        <Select onValueChange={(tipo) => adicionar(tipo as BlocoFormInput["tipo"])} value="">
          <SelectTrigger className="w-auto gap-2">
            <Plus className="h-4 w-4" />
            <SelectValue placeholder="Adicionar bloco" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="texto">Texto</SelectItem>
            <SelectItem value="imagem">Imagem</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
