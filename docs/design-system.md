# Design system — "Soft Professional"

Identidade visual do Facility a partir desta sessão, substituindo a `ui-ux-pro-max` (Calistoga/Inter, paleta azul) de um incremento anterior. **Use este arquivo como referência ao construir qualquer tela nova** — antes de inventar uma cor, um raio ou um peso de fonte, confira se já existe um token aqui.

## Spec original (do usuário, guardado na íntegra)

> # Style
>
> The design follows a 'Soft Professional' aesthetic. It pairs the high-contrast dark sidebar (#0f172a) with a light background (#f8fafc). Typography is handled by 'Plus Jakarta Sans', utilizing extreme weight contrasts (from 400 to 800) to create clear hierarchy. Components feature large corner radii (up to 40px/2.5rem for main cards) and subtle, soft shadows to denote depth without clutter.
>
> ## Spec
>
> ### Visual Theme
> - **Primary Background**: #f8fafc
> - **Sidebar Background**: #0f172a
> - **Accent Colors**:
>   - Primary: #4f46e5 (Indigo)
>   - Success: #10b981 (Emerald)
>   - Warning: #f59e0b (Amber)
>   - Danger: #f43f5e (Rose)
>   - Info: #3b82f6 (Blue)
>
> ### Typography
> - **Primary Font**: 'Plus Jakarta Sans', sans-serif
> - **Secondary Font**: 'Inter', sans-serif for body text
> - **Headings**: Weight 800 (Extra Bold), tracking -0.02em
> - **KPI Numbers**: Weight 900 (Black), font-size 24px-32px
> - **Labels/Metadata**: Weight 700, font-size 10px-11px, uppercase, tracking 0.1em
>
> ### Border & Elevation
> - **Border Radius**:
>   - Dashboard Cards: 40px (2.5rem)
>   - Buttons/Small Cards: 16px (1rem)
>   - KPI Icons: 12px
> - **Borders**: 1px solid #f1f5f9 (for light cards), 1px solid #1e293b (for sidebar items)
> - **Shadows**:
>   - Card Shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05)
>   - Sidebar Active Shadow: 0 10px 15px -3px rgba(79, 70, 229, 0.4)
>
> ### Animations
> - **Hover Transitions**: 300ms cubic-bezier(0.4, 0, 0.2, 1)
> - **Micro-interactions**: Subtle scale (1.02x) on card hover, color shifts on sidebar items.

## Mapeamento pra tokens do projeto

Tudo em `src/app/globals.css` (`hsl(var(--x))`) + `tailwind.config.ts`. Hex convertido pra HSL porque é o formato que o projeto usa em todo lugar.

| Papel | Hex do spec | HSL | Token CSS | Uso |
|---|---|---|---|---|
| Fundo (claro) | `#f8fafc` → ajustado | `210 30% 95%` | `--background` | `bg-background` — ver nota de contraste abaixo |
| Sidebar | `#0f172a` | `222.2 47.4% 11.2%` | `--sidebar` | `bg-sidebar` — **fixa nos dois temas**, não inverte no escuro |
| Primary (Indigo) | `#4f46e5` | `243.4 75.3% 58.6%` | `--primary` | `bg-primary`/`text-primary`, botão padrão, item de nav ativo |
| Success (Emerald) | `#10b981` | `160.1 84.1% 39.4%` | `--success` | `bg-success`, badge `variant="success"` — outcomes positivos (renovado, ganho) |
| Warning (Amber) | `#f59e0b` | `37.7 92.1% 50.2%` | `--urgencia` | mesmo token que já existia pra "atrasado/atenção" — cor atualizada |
| Danger (Rose) | `#f43f5e` | `349.7 89.2% 60.2%` | `--destructive` | `bg-destructive`, badge `variant="destructive"` — ações destrutivas, outcomes negativos |
| Info (Blue) | `#3b82f6` | `217.2 91.2% 59.8%` | `--info` | `bg-info`, badge `variant="info"` — informativo neutro |
| Borda (clara) | `#f1f5f9` → ajustado | `214 20% 84%` | `--border`/`--input` | ver nota de contraste abaixo |

**Modo escuro:** o spec original só cobre tema claro. A variante escura em `globals.css` (bloco `.dark`) é extrapolação — mesmos 5 acentos, fundo mais escuro que a sidebar (pra ela se destacar), superfícies de card um pouco mais claras que o fundo. A sidebar usa o **mesmo** `#0f172a` nos dois temas — não faz sentido "inverter" uma cor que já é escura.

**Nota de contraste (ajuste pós-spec, tema claro):** o valor original do spec pra fundo (`#f8fafc`, 98% de luminosidade) e o `--border` derivado dele (96.1%) ficavam quase colados em luminosidade com o `--card` branco puro (100%) — na prática, dava pra "perder" onde um card terminava e o fundo começava. Correção: `--background` desceu pra 95% (fica visivelmente mais acinzentado que o card branco) e `--border`/`--input` desceram pra 84% (linha de fronteira nítida, em vez de quase invisível). `--muted` (91%) desceu proporcionalmente, pra manter a hierarquia `border (84%) < muted (91%) < background (95%) < card (100%)`. Vale pra qualquer token novo que for criado no tema claro: **nunca deixe `--border` a menos de ~10 pontos de luminosidade do `--card`** — é a régua que evita esse problema se repetir.

## Tipografia

- **`font-display`** (`Plus Jakarta Sans`): headings, números de KPI, marca ("Facility" na sidebar). Pesos instalados: 400/500/600/700/800.
- **`font-sans`** (`Inter`): corpo de texto, UI geral — continua sendo a fonte padrão do `body`, não muda.
- **Heading:** `font-display font-extrabold tracking-[-0.02em]`.
- **Número de KPI:** `font-display font-extrabold tracking-[-0.02em]`, tamanho `text-2xl` (24px) a `text-3xl` (32px) conforme o espaço. *(O spec pede peso 900/black; o Fontsource do Plus Jakarta Sans só vai até 800 — usar `font-black` funcionaria, mas o navegador cairia pro 800 mesmo assim por não achar a face 900, então fica explícito em `font-extrabold` pra não sugerir um peso que não existe.)*
- **Label/metadado:** `text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground` — títulos de seção, rótulos abaixo de números, nomes de campo curtos.
- Nunca misturar `font-display` num texto de corpo nem `font-sans` num heading — é exatamente essa mistura (fonte errada no lugar errado) que gera o efeito de "fonte inconsistente".

## Raio e sombra

- **Cards de destaque** (KPI, gráfico, painel de resumo — poucos por tela, com espaço ao redor): `<Card variant="destaque">` → 20px (`rounded-card-lg`, token `card-lg` em `tailwind.config.ts`). O spec original pedia 40px; reduzido a pedido do usuário, ficava "muito arredondado" na prática.
- **Card padrão** (fichas, listas, diálogos, formulários): `<Card>` (sem variant) → 16px (`rounded-2xl`).
- **Botões, inputs, selects, itens de sidebar:** `rounded-lg` (`--radius`, hoje `0.625rem`/10px) — reduzido a pedido do usuário, o 16px do spec original ficou "muito arredondado" nesses controles pequenos/densos. `--radius` é o único lugar pra ajustar esse valor de novo (cascata pra `rounded-sm`/`rounded-md`/`rounded-lg` — ver `tailwind.config.ts`).
- **Ícone de KPI** (círculo/quadrado pequeno dentro de um card de destaque): `rounded-xl` (12px).
- **Sombra de card:** `shadow-card` (`0 4px 6px -1px rgb(0 0 0 / 0.05)`) — já embutida no `Card`, não precisa adicionar.
- **Glow do item ativo da sidebar:** `shadow-sidebar-active` (`0 10px 15px -3px rgb(79 70 229 / 0.4)`) — já aplicado em `AppShell.tsx`.

## Animação

- **Controles interativos** (botão, input, select, item de sidebar): `transition-all duration-150 ease-in-out`. O spec original pedia 300ms; reduzido a pedido do usuário — 300ms em algo que troca de estado a cada clique/hover (like trocar de página na sidebar) parecia lentidão, não suavidade. 300ms continua correto pra transições MAIORES e mais raras (abrir modal, a escala do card de destaque).
- Hover de card de destaque: `hover:scale-[1.02]` (300ms, `Card` — não mudou) — só em `Card variant="destaque"` (painéis pequenos/vistosos). Não usar em cards grandes e estáticos (ficha, formulário) — a tela inteira "pulando" no hover atrapalha mais que ajuda.
- Hover de item de navegação: mudança de cor/fundo, já embutido em `ItemNav` (`AppShell.tsx`).

## O que NÃO usar

- Cores fora da paleta de 5 acentos + neutros pra qualquer coisa com significado de estado/ação. Decoração pura (ex.: cor por fase do kanban em `CardNegocio.tsx`) pode usar outras cores do Tailwind, mas **evite âmbar, esmeralda e rosa** — são os tokens semânticos de warning/success/danger; reaproveitá-los decorativamente confunde quem está lendo a tela.
- `rounded-card-lg` (40px) fora de cards de destaque — fica estranho em qualquer coisa densa ou pequena.
- `font-display` em texto de corpo, tabela ou lista — é só pra heading/KPI/marca.

## Escopo aplicado nesta sessão

Camada de token (`globals.css`, `tailwind.config.ts`) e primitivos (`Card`, `Button`, `Badge`, `Input`, `Select`) — efeito automático em toda tela que os usa, ou seja, o app inteiro herdou cor/raio/fonte/sombra novos. Ajuste manual fino de hierarquia tipográfica (headings extrabold, labels uppercase) foi feito nas telas "Hoje" (`Inicio.tsx`, `CardsResumo.tsx`, `GraficoResumo.tsx`, `SecaoAcoesHoje.tsx`, `BarraPrimeirosPassos.tsx`) e no shell (`AppShell.tsx`). Outras telas (Contatos, Vencimentos, Tarefas, onboarding, auth) ainda não passaram por esse ajuste fino — ficam com a cara nova nos componentes compartilhados, mas headings/labels antigos até alguém revisitar essas telas.
