import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { somarPeriodo } from "@/lib/datas";
import { useRenovarVencimento } from "@/features/vencimentos/api/useMutacoesVencimento";
import type { VencimentoCompleto } from "@/features/vencimentos/api/useVencimentos";

interface Props {
  vencimento: VencimentoCompleto;
  empresaId: string | null;
  open: boolean;
  onOpenChange: (aberto: boolean) => void;
  onRenovado: (novoId: string) => void;
}

/**
 * PRD §6.4: "Ao marcar renovado, criar automaticamente o próximo
 * vencimento conforme a recorrência, perguntando se os dados mudaram."
 * Pra `mensal`/`anual` sugere a próxima data; `unica`/`personalizada`
 * não tem intervalo definido no schema, então o usuário escolhe.
 */
export function DialogoRenovacao({ vencimento, empresaId, open, onOpenChange, onRenovado }: Props) {
  const renovar = useRenovarVencimento(empresaId);
  const [novaData, setNovaData] = useState("");
  const [novoValor, setNovoValor] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const sugestao =
      vencimento.recorrencia === "mensal"
        ? somarPeriodo(vencimento.dataVencimento, "mes", 1)
        : vencimento.recorrencia === "anual"
          ? somarPeriodo(vencimento.dataVencimento, "ano", 1)
          : "";
    setNovaData(sugestao);
    setNovoValor(vencimento.valor != null ? String(vencimento.valor) : "");
    setErro(null);
  }, [open, vencimento]);

  async function confirmar() {
    if (!novaData) {
      setErro("Informe a data do próximo vencimento.");
      return;
    }
    try {
      const novoId = await renovar.mutateAsync({
        vencimentoId: vencimento.id,
        novaData,
        novoValor: novoValor ? Number(novoValor.replace(",", ".")) : undefined,
      });
      onRenovado(novoId as string);
      onOpenChange(false);
    } catch {
      setErro("Não foi possível renovar. Tente de novo em instantes.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renovar vencimento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            O vencimento atual vira &quot;renovado&quot; e este próximo é criado como pendente.
            Confirme ou ajuste os dados.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="nova-data">Próxima data de vencimento</Label>
            <Input
              id="nova-data"
              type="date"
              value={novaData}
              onChange={(e) => setNovaData(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="novo-valor">Valor</Label>
            <Input
              id="novo-valor"
              inputMode="decimal"
              value={novoValor}
              onChange={(e) => setNovoValor(e.target.value)}
            />
          </div>
          {erro && <p className="text-sm text-destructive">{erro}</p>}
        </div>
        <DialogFooter>
          <Button onClick={confirmar} disabled={renovar.isPending}>
            {renovar.isPending ? "Renovando…" : "Confirmar renovação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
