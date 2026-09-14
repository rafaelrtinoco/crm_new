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
import type { Negocio } from "@/features/funis/api/useNegocios";
import type { ProximoPassoInput } from "@/features/funis/schemas";

interface Props {
  negocio: Negocio | null;
  etapaDestinoNome: string;
  open: boolean;
  pendente: boolean;
  onOpenChange: (aberto: boolean) => void;
  onConfirmar: (input: ProximoPassoInput) => void;
}

/**
 * PRD §6.5: "Mover um card exige definir ou confirmar o próximo passo."
 * As duas colunas são `not null` no banco — este diálogo é a UX
 * honrando a constraint, não contornando-a.
 */
export function DialogoProximoPasso({
  negocio,
  etapaDestinoNome,
  open,
  pendente,
  onOpenChange,
  onConfirmar,
}: Props) {
  const [proximoPassoEm, setProximoPassoEm] = useState("");
  const [proximoPassoAcao, setProximoPassoAcao] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !negocio) return;
    setProximoPassoEm(negocio.proximoPassoEm);
    setProximoPassoAcao(negocio.proximoPassoAcao);
    setErro(null);
  }, [open, negocio]);

  function confirmar() {
    if (!proximoPassoEm || !proximoPassoAcao) {
      setErro("Informe a data e a ação do próximo passo.");
      return;
    }
    onConfirmar({ proximoPassoEm, proximoPassoAcao });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mover pra &quot;{etapaDestinoNome}&quot;</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Confirme ou ajuste o próximo passo antes de mover o card.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="proximo-passo-data">Data do próximo passo</Label>
            <Input
              id="proximo-passo-data"
              type="date"
              value={proximoPassoEm}
              onChange={(e) => setProximoPassoEm(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="proximo-passo-acao">Ação</Label>
            <Input
              id="proximo-passo-acao"
              placeholder="Ex.: Ligar pra confirmar a proposta"
              value={proximoPassoAcao}
              onChange={(e) => setProximoPassoAcao(e.target.value)}
            />
          </div>
          {erro && <p className="text-sm text-destructive">{erro}</p>}
        </div>
        <DialogFooter>
          <Button onClick={confirmar} disabled={pendente}>
            {pendente ? "Movendo…" : "Confirmar e mover"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
