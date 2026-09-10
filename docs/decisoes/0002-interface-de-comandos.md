# 0002 — npm scripts como interface de comandos, Makefile fino por cima

## Status

Aceita — incremento 1A.

## Contexto

O `CLAUDE.md` documentava 12 alvos `make` (`make dev`, `make db-reset`, `make test-db`...) desde antes de existir qualquer código. O ambiente de desenvolvimento é Windows com Git Bash; `make` não está instalado e não é trivial de instalar sem privilégios administrativos ou passos extras (`winget`/`scoop`). Node, npm e Docker já estavam disponíveis.

## Decisão

Os scripts em `package.json` são a fonte da verdade (`npm run dev`, `npm run db:reset`, `npm run test:db` etc.) — funcionam em qualquer máquina com Node, sem instalação extra. Um `Makefile` fino delega para eles (`dev: ; npm run dev`), preservando a ergonomia `make <alvo>` para quem tiver `make` instalado, sem duplicar lógica.

## Consequências

- `CLAUDE.md` passa a documentar os dois: os alvos `make` continuam válidos como referência rápida, mas o comando que sempre funciona é o `npm run`.
- Scripts do `package.json`: `dev`, `build`, `lint`, `typecheck`, `test`, `test:watch`, `supabase:start`, `supabase:stop`, `functions`, `db:reset`, `db:types`, `db:migration`, `test:db`.
- `npm run dev` sobe Supabase local (via `concurrently`) e o Vite juntos — requer o Docker Desktop aberto antes.
