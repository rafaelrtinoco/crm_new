import { formatarDataBR } from "@/lib/datas";
import type { Atividade } from "@/features/contatos/api/useAtividades";

const rotuloTipo: Record<string, string> = {
  mensagem: "Mensagem",
  email: "E-mail",
  nota: "Nota",
  ligacao: "Ligação",
  tarefa: "Tarefa",
  mudanca_etapa: "Mudança de etapa",
  vencimento: "Vencimento",
  resposta_campanha: "Resposta de campanha",
};

function formatarDataHoraBR(isoString: string): string {
  const data = new Date(isoString);
  const dataBR = formatarDataBR(isoString.slice(0, 10));
  const hora = data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${dataBR} às ${hora}`;
}

/** Timeline única do contato (PRD §6.3) — só leitura por enquanto. */
export function TimelineContato({ atividades }: { atividades: Atividade[] }) {
  if (atividades.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma atividade registrada ainda.</p>;
  }

  return (
    <ul className="space-y-4">
      {atividades.map((atividade) => (
        <li key={atividade.id} className="border-l-2 border-border pl-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {rotuloTipo[atividade.tipo] ?? atividade.tipo}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatarDataHoraBR(atividade.criadaEm)}
            </span>
          </div>
          {typeof atividade.conteudo.resultado === "string" && (
            <p className="mt-1 text-sm">{atividade.conteudo.resultado}</p>
          )}
          {typeof atividade.conteudo.nota === "string" && atividade.conteudo.nota && (
            <p className="mt-1 text-sm text-muted-foreground">{atividade.conteudo.nota}</p>
          )}
          {typeof atividade.conteudo.texto === "string" && (
            <p className="mt-1 text-sm text-muted-foreground">{atividade.conteudo.texto}</p>
          )}
          {typeof atividade.conteudo.proximoPasso === "string" &&
            atividade.conteudo.proximoPasso && (
              <p className="mt-1 text-sm">
                <span className="font-medium">Próximo passo:</span>{" "}
                {atividade.conteudo.proximoPasso}
              </p>
            )}
        </li>
      ))}
    </ul>
  );
}
