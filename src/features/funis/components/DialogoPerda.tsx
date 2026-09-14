import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MotivoPerda } from "@/features/funis/api/useFunis";
import type { PerdaInput } from "@/features/funis/schemas";

interface Props {
  motivos: MotivoPerda[];
  open: boolean;
  pendente: boolean;
  onOpenChange: (aberto: boolean) => void;
  onConfirmar: (input: PerdaInput) => void;
}

/** PRD §6.5: "Perdido: motivo obrigatório e campo 'reativar em', que cria uma tarefa futura." */
export function DialogoPerda({ motivos, open, pendente, onOpenChange, onConfirmar }: Props) {
  const [motivoPerdaId, setMotivoPerdaId] = useState("");
  const [reativarEm, setReativarEm] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  function confirmar() {
    if (!motivoPerdaId) {
      setErro("Selecione o motivo da perda.");
      return;
    }
    onConfirmar({ motivoPerdaId, reativarEm: reativarEm || undefined });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(aberto) => {
        if (!aberto) {
          setMotivoPerdaId("");
          setReativarEm("");
          setErro(null);
        }
        onOpenChange(aberto);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Marcar como perdido</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="motivo-perda">Motivo</Label>
            <Select value={motivoPerdaId} onValueChange={setMotivoPerdaId}>
              <SelectTrigger id="motivo-perda">
                <SelectValue placeholder="Selecione o motivo" />
              </SelectTrigger>
              <SelectContent>
                {motivos.map((motivo) => (
                  <SelectItem key={motivo.id} value={motivo.id}>
                    {motivo.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reativar-em">Reativar em (opcional)</Label>
            <Input
              id="reativar-em"
              type="date"
              value={reativarEm}
              onChange={(e) => setReativarEm(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Se preenchido, cria uma tarefa futura pra retomar o contato.
            </p>
          </div>
          {erro && <p className="text-sm text-destructive">{erro}</p>}
        </div>
        <DialogFooter>
          <Button variant="destructive" onClick={confirmar} disabled={pendente}>
            {pendente ? "Salvando…" : "Marcar como perdido"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
