import { createContext, useContext } from "react";

/**
 * Rótulos de entidades configuráveis por empresa (ex.: "Vencimento" pode
 * aparecer como "Apólice" ou "Contrato"). Vem do template do nicho aplicado
 * no onboarding e pode ser editado livremente depois — ver PRD §3.2.
 *
 * Regra de ouro: nenhum componente escreve "apólice", "segurado" ou
 * "corretor" fixo. Sempre passe pelo `useVocabulario()`.
 */
export interface Vocabulario {
  contato: string;
  contatoPlural: string;
  vencimento: string;
  vencimentoPlural: string;
  negocio: string;
  negocioPlural: string;
}

/** Rótulos genéricos, usados antes de uma empresa aplicar seu template. */
export const vocabularioPadrao: Vocabulario = {
  contato: "Contato",
  contatoPlural: "Contatos",
  vencimento: "Vencimento",
  vencimentoPlural: "Vencimentos",
  negocio: "Negócio",
  negocioPlural: "Negócios",
};

export const VocabularioContext = createContext<Vocabulario>(vocabularioPadrao);

/** Lê os rótulos da empresa atual. Nunca hardcode nome de entidade — use este hook. */
export function useVocabulario(): Vocabulario {
  return useContext(VocabularioContext);
}

/** Mescla o `vocabulario` jsonb da empresa (pode vir parcial ou vazio) com o padrão. */
export function mesclarVocabulario(parcial: unknown): Vocabulario {
  if (!parcial || typeof parcial !== "object") return vocabularioPadrao;
  const valores = parcial as Partial<Vocabulario>;
  return {
    contato: valores.contato || vocabularioPadrao.contato,
    contatoPlural: valores.contatoPlural || vocabularioPadrao.contatoPlural,
    vencimento: valores.vencimento || vocabularioPadrao.vencimento,
    vencimentoPlural: valores.vencimentoPlural || vocabularioPadrao.vencimentoPlural,
    negocio: valores.negocio || vocabularioPadrao.negocio,
    negocioPlural: valores.negocioPlural || vocabularioPadrao.negocioPlural,
  };
}
