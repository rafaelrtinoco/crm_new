import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTags } from "@/features/contatos/api/useTags";
import { useCamposPersonalizados } from "@/features/contatos/api/useCamposPersonalizados";
import { useMembrosEmpresa } from "@/features/onboarding/api/useEmpresas";
import { useVencimentoTipos } from "@/features/vencimentos/api/useVencimentoTipos";
import { CAMPOS_SEGMENTO, type CampoSegmento } from "@/features/segmentos/schemas";
import type { RegraSegmento } from "@/features/segmentos/api/useSegmentos";

const rotuloCampo: Record<CampoSegmento, string> = {
  status: "Status",
  temperatura: "Temperatura",
  tags: "Tags",
  origem: "Origem",
  cidade: "Cidade",
  idade: "Faixa de idade",
  responsavel_id: "Responsável",
  sem_contato_dias: "Sem contato há X dias",
  vencimento_tipo_mes: "Tipo e mês de vencimento",
  personalizado: "Campo personalizado",
};

const rotuloStatus: Record<string, string> = {
  lead: "Lead",
  cliente: "Cliente",
  inativo: "Inativo",
};
const rotuloTemperatura: Record<string, string> = {
  quente: "Quente",
  morno: "Morno",
  frio: "Frio",
};
const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

/** Regra "em branco" pro campo escolhido — operador já fixo, valor vazio conforme o formato. */
function regraPadrao(campo: CampoSegmento): RegraSegmento {
  switch (campo) {
    case "status":
      return { campo, operador: "em", valor: [] };
    case "temperatura":
      return { campo, operador: "em", valor: [] };
    case "tags":
      return { campo, operador: "contem_algum", valor: [] };
    case "origem":
      return { campo, operador: "em", valor: [] };
    case "cidade":
      return { campo, operador: "igual", valor: "" };
    case "idade":
      return { campo, operador: "entre", valor: [0, 100] };
    case "responsavel_id":
      return { campo, operador: "em", valor: [] };
    case "sem_contato_dias":
      return { campo, operador: "maior_ou_igual", valor: 30 };
    case "vencimento_tipo_mes":
      return { campo, operador: "igual", valor: { vencimento_tipo_id: "", mes: 1 } };
    case "personalizado":
      return { campo, operador: "igual", chave: "", valor: "" };
  }
}

function alternarNaLista(lista: string[], valor: string, marcado: boolean): string[] {
  return marcado ? [...lista, valor] : lista.filter((v) => v !== valor);
}

interface ConstrutorRegrasProps {
  empresaId: string;
  regras: RegraSegmento[];
  onChange: (regras: RegraSegmento[]) => void;
}

/** Construtor de regras do segmento — lista de campo → operador (fixo por campo) → valor. */
export function ConstrutorRegras({ empresaId, regras, onChange }: ConstrutorRegrasProps) {
  const { data: tags } = useTags(empresaId);
  const { data: membros } = useMembrosEmpresa(empresaId);
  const { data: tiposVencimento } = useVencimentoTipos(empresaId);
  const { data: camposPersonalizados } = useCamposPersonalizados(empresaId, "contato");

  function atualizarRegra(indice: number, regra: RegraSegmento) {
    onChange(regras.map((r, i) => (i === indice ? regra : r)));
  }

  function removerRegra(indice: number) {
    onChange(regras.filter((_, i) => i !== indice));
  }

  function adicionarRegra() {
    onChange([...regras, regraPadrao("status")]);
  }

  return (
    <div className="space-y-3">
      {regras.map((regra, indice) => (
        <div key={indice} className="space-y-2 rounded-lg border border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <Select
              value={regra.campo}
              onValueChange={(campo) => atualizarRegra(indice, regraPadrao(campo as CampoSegmento))}
            >
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CAMPOS_SEGMENTO.map((campo) => (
                  <SelectItem key={campo} value={campo}>
                    {rotuloCampo[campo]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" variant="ghost" size="sm" onClick={() => removerRegra(indice)}>
              Remover
            </Button>
          </div>

          {regra.campo === "status" && (
            <div className="flex flex-wrap gap-3">
              {Object.entries(rotuloStatus).map(([valor, rotulo]) => (
                <label key={valor} className="flex items-center gap-1.5 text-sm">
                  <Checkbox
                    checked={regra.valor.includes(valor)}
                    onCheckedChange={(marcado) =>
                      atualizarRegra(indice, {
                        ...regra,
                        valor: alternarNaLista(regra.valor, valor, marcado === true),
                      })
                    }
                  />
                  {rotulo}
                </label>
              ))}
            </div>
          )}

          {regra.campo === "temperatura" && (
            <div className="flex flex-wrap gap-3">
              {Object.entries(rotuloTemperatura).map(([valor, rotulo]) => (
                <label key={valor} className="flex items-center gap-1.5 text-sm">
                  <Checkbox
                    checked={regra.valor.includes(valor)}
                    onCheckedChange={(marcado) =>
                      atualizarRegra(indice, {
                        ...regra,
                        valor: alternarNaLista(regra.valor, valor, marcado === true),
                      })
                    }
                  />
                  {rotulo}
                </label>
              ))}
            </div>
          )}

          {regra.campo === "tags" && (
            <div className="flex flex-wrap gap-3">
              {(tags ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma tag cadastrada.</p>
              )}
              {(tags ?? []).map((tag) => (
                <label key={tag.id} className="flex items-center gap-1.5 text-sm">
                  <Checkbox
                    checked={regra.valor.includes(tag.id)}
                    onCheckedChange={(marcado) =>
                      atualizarRegra(indice, {
                        ...regra,
                        valor: alternarNaLista(regra.valor, tag.id, marcado === true),
                      })
                    }
                  />
                  {tag.nome}
                </label>
              ))}
            </div>
          )}

          {regra.campo === "origem" && (
            <div className="space-y-1">
              <Input
                placeholder="site, indicacao, facebook_ads…"
                value={regra.valor.join(", ")}
                onChange={(e) =>
                  atualizarRegra(indice, {
                    ...regra,
                    valor: e.target.value
                      .split(",")
                      .map((v) => v.trim())
                      .filter(Boolean),
                  })
                }
              />
              <p className="text-xs text-muted-foreground">Separe múltiplas origens por vírgula.</p>
            </div>
          )}

          {regra.campo === "responsavel_id" && (
            <div className="flex flex-wrap gap-3">
              {(membros ?? []).map((membro) => (
                <label key={membro.usuarioId} className="flex items-center gap-1.5 text-sm">
                  <Checkbox
                    checked={regra.valor.includes(membro.usuarioId)}
                    onCheckedChange={(marcado) =>
                      atualizarRegra(indice, {
                        ...regra,
                        valor: alternarNaLista(regra.valor, membro.usuarioId, marcado === true),
                      })
                    }
                  />
                  {membro.nome}
                </label>
              ))}
            </div>
          )}

          {regra.campo === "cidade" && (
            <Input
              placeholder="Nome da cidade"
              value={regra.valor}
              onChange={(e) => atualizarRegra(indice, { ...regra, valor: e.target.value })}
            />
          )}

          {regra.campo === "idade" && (
            <div className="flex items-center gap-2">
              <div className="space-y-1">
                <Label className="text-xs">De</Label>
                <Input
                  type="number"
                  min={0}
                  value={regra.valor[0]}
                  onChange={(e) =>
                    atualizarRegra(indice, {
                      ...regra,
                      valor: [Number(e.target.value), regra.valor[1]],
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Até</Label>
                <Input
                  type="number"
                  min={0}
                  value={regra.valor[1]}
                  onChange={(e) =>
                    atualizarRegra(indice, {
                      ...regra,
                      valor: [regra.valor[0], Number(e.target.value)],
                    })
                  }
                />
              </div>
            </div>
          )}

          {regra.campo === "sem_contato_dias" && (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                className="w-32"
                value={regra.valor}
                onChange={(e) =>
                  atualizarRegra(indice, { ...regra, valor: Number(e.target.value) })
                }
              />
              <span className="text-sm text-muted-foreground">
                dias ou mais (nunca contatado também conta)
              </span>
            </div>
          )}

          {regra.campo === "vencimento_tipo_mes" && (
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={regra.valor.vencimento_tipo_id}
                onValueChange={(tipoId) =>
                  atualizarRegra(indice, {
                    ...regra,
                    valor: { ...regra.valor, vencimento_tipo_id: tipoId },
                  })
                }
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Tipo de vencimento" />
                </SelectTrigger>
                <SelectContent>
                  {(tiposVencimento ?? []).map((tipo) => (
                    <SelectItem key={tipo.id} value={tipo.id}>
                      {tipo.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={String(regra.valor.mes)}
                onValueChange={(mes) =>
                  atualizarRegra(indice, { ...regra, valor: { ...regra.valor, mes: Number(mes) } })
                }
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Mês" />
                </SelectTrigger>
                <SelectContent>
                  {MESES.map((nome, i) => (
                    <SelectItem key={nome} value={String(i + 1)}>
                      {nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {regra.campo === "personalizado" && (
            <CampoPersonalizadoRegra
              regra={regra}
              camposPersonalizados={camposPersonalizados ?? []}
              onChange={(r) => atualizarRegra(indice, r)}
            />
          )}
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" onClick={adicionarRegra}>
        + Adicionar regra
      </Button>
    </div>
  );
}

interface CampoPersonalizadoRegraProps {
  regra: Extract<RegraSegmento, { campo: "personalizado" }>;
  camposPersonalizados: { id: string; chave: string; rotulo: string; tipo: string }[];
  onChange: (regra: Extract<RegraSegmento, { campo: "personalizado" }>) => void;
}

/** Operadores disponíveis dependem do `tipo` do campo escolhido (mesma regra do banco). */
function CampoPersonalizadoRegra({
  regra,
  camposPersonalizados,
  onChange,
}: CampoPersonalizadoRegraProps) {
  const campoAtual = camposPersonalizados.find((c) => c.chave === regra.chave);
  const tipo = campoAtual?.tipo;
  const operadoresPorTipo: Record<string, string[]> = {
    numero: ["maior_ou_igual", "menor_ou_igual", "entre"],
    data: ["maior_ou_igual", "menor_ou_igual", "entre"],
    booleano: ["igual"],
    texto: ["igual", "em"],
    selecao: ["igual", "em"],
  };
  const operadores = (tipo ? operadoresPorTipo[tipo] : []) ?? [];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={regra.chave}
        onValueChange={(chave) => {
          const novoTipo = camposPersonalizados.find((c) => c.chave === chave)?.tipo;
          const operadorPadrao = novoTipo ? (operadoresPorTipo[novoTipo]?.[0] ?? "igual") : "igual";
          onChange({ campo: "personalizado", chave, operador: operadorPadrao as never, valor: "" });
        }}
      >
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Campo" />
        </SelectTrigger>
        <SelectContent>
          {camposPersonalizados.map((campo) => (
            <SelectItem key={campo.chave} value={campo.chave}>
              {campo.rotulo}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {operadores.length > 1 && (
        <Select
          value={regra.operador}
          onValueChange={(op) => onChange({ ...regra, operador: op as never })}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {operadores.map((op) => (
              <SelectItem key={op} value={op}>
                {op === "igual"
                  ? "Igual a"
                  : op === "em"
                    ? "Um destes"
                    : op === "entre"
                      ? "Entre"
                      : op === "maior_ou_igual"
                        ? "Maior ou igual a"
                        : "Menor ou igual a"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {tipo === "booleano" ? (
        <Checkbox
          checked={regra.valor === true}
          onCheckedChange={(marcado) => onChange({ ...regra, valor: marcado === true })}
        />
      ) : regra.operador === "entre" ? (
        <div className="flex items-center gap-2">
          <Input
            type={tipo === "data" ? "date" : "number"}
            className="w-32"
            value={Array.isArray(regra.valor) ? (regra.valor[0] ?? "") : ""}
            onChange={(e) => {
              const atual = Array.isArray(regra.valor) ? regra.valor : ["", ""];
              onChange({ ...regra, valor: [e.target.value, atual[1] ?? ""] });
            }}
          />
          <Input
            type={tipo === "data" ? "date" : "number"}
            className="w-32"
            value={Array.isArray(regra.valor) ? (regra.valor[1] ?? "") : ""}
            onChange={(e) => {
              const atual = Array.isArray(regra.valor) ? regra.valor : ["", ""];
              onChange({ ...regra, valor: [atual[0] ?? "", e.target.value] });
            }}
          />
        </div>
      ) : (
        <Input
          type={tipo === "data" ? "date" : tipo === "numero" ? "number" : "text"}
          className="w-40"
          value={
            typeof regra.valor === "string" || typeof regra.valor === "number" ? regra.valor : ""
          }
          onChange={(e) => onChange({ ...regra, valor: e.target.value })}
        />
      )}
    </div>
  );
}
