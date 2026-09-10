---
paths:
  - "src/**"
---

# Frontend (React + Vite + TypeScript)

## Vertical slice

- Cada feature vive em `src/features/<slice>/`: `api/` (hooks TanStack Query), `components/`, `schemas.ts` e páginas. Nada de chamada ao Supabase direto em componente — sempre via hook do `api/`.
- Componentes de `src/components/ui/` são shadcn/ui puro, sem regra de negócio.
- `src/lib/` concentra cliente Supabase, datas, formatadores BR e vocabulário — reuse antes de criar utilitário novo.

## Nada de nicho no código

- Rótulos, nomes de entidade, tipos de vencimento e textos de mensagem vêm do template da empresa via `useVocabulario()`. Nunca escreva "apólice", "segurado" ou "corretor" fixo em componente.
- Campos personalizados e funis são dados, renderizados dinamicamente — não modele um funil ou campo específico do nicho como componente próprio.

## Formulários e validação

- React Hook Form + Zod em todo formulário; o schema em `schemas.ts` do slice é a fonte única de verdade da validação (reusado por cliente e, quando aplicável, pela Edge Function).
- Máscaras e validação de CPF, CNPJ, telefone e CEP usam os formatadores de `src/lib/`, nunca regex ad-hoc por componente.

## Datas

- Vencimento e aniversário são `date` (string `YYYY-MM-DD`), nunca `Date` do navegador. "Hoje" e o cálculo de régua vêm do fuso da empresa, nunca do fuso do navegador.
- Exibição sempre em `dd/mm/aaaa`; valores monetários em BRL.

## UX e acessibilidade

- Mobile first: ações de ligar e abrir WhatsApp em um toque.
- Todo estado tem loading, vazio (com orientação do que fazer) e erro tratados — nunca uma tela em branco.
- Mensagens de erro em português, claras para o usuário final (não repasse erro técnico do Supabase).
- Suportar modo escuro.

## Segurança e qualidade

- Nunca guardar dados pessoais de contatos em `localStorage`, URL ou log de console.
- `any` só com comentário justificando por que o tipo não pôde ser inferido.
- Não editar `src/types/database.ts` à mão — é gerado por `make db-types`.

---
paths:
  - "src/**/*.{ts,tsx}"
---


