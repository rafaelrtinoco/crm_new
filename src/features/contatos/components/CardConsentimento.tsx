import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatarDataBR } from "@/lib/datas";
import {
  useConsentimentos,
  useRegistrarConsentimento,
  type FinalidadeConsentimento,
} from "@/features/contatos/api/useConsentimentos";

const rotuloFinalidade: Record<FinalidadeConsentimento, string> = {
  marketing: "Marketing",
  atendimento: "Atendimento",
};

const finalidades: FinalidadeConsentimento[] = ["marketing", "atendimento"];

interface CardConsentimentoProps {
  empresaId: string;
  contatoId: string;
}

/**
 * Consentimento LGPD por finalidade (PRD §5.4/§6.9). Sem isso, nenhuma
 * campanha de marketing consegue enviar mensagem pra ninguém — é o
 * `fila-envios` (processar_fila_envios) que consulta esse histórico.
 */
export function CardConsentimento({ empresaId, contatoId }: CardConsentimentoProps) {
  const { data: consentimentos, isLoading } = useConsentimentos(contatoId);
  const registrar = useRegistrarConsentimento();

  function alterar(finalidade: FinalidadeConsentimento, concedido: boolean) {
    registrar.mutate({ empresaId, contatoId, finalidade, concedido });
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <h3 className="text-sm font-medium">Consentimento</h3>
      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {!isLoading &&
        finalidades.map((finalidade) => {
          const decisao = consentimentos?.[finalidade];
          return (
            <div key={finalidade} className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">{rotuloFinalidade[finalidade]}</span>
                {decisao ? (
                  <Badge variant={decisao.concedido ? "success" : "destructive"}>
                    {decisao.concedido ? "Concedido" : "Revogado"}
                  </Badge>
                ) : (
                  <Badge variant="outline">Não registrado</Badge>
                )}
                {decisao && (
                  <span className="text-xs text-muted-foreground">
                    desde {formatarDataBR(decisao.registradoEm.slice(0, 10))}
                  </span>
                )}
              </div>
              <div className="flex gap-1.5">
                {(!decisao || !decisao.concedido) && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={registrar.isPending}
                    onClick={() => alterar(finalidade, true)}
                  >
                    Conceder
                  </Button>
                )}
                {(!decisao || decisao.concedido) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={registrar.isPending}
                    onClick={() => alterar(finalidade, false)}
                  >
                    Revogar
                  </Button>
                )}
              </div>
            </div>
          );
        })}
    </div>
  );
}
