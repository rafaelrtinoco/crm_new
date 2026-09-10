# Interface `make` fina — delega tudo para os npm scripts (fonte da
# verdade, ver docs/decisoes/0002-interface-de-comandos.md). Existe só
# pra quem tem `make` instalado; se não tiver, use `npm run <alvo>` direto.

.PHONY: install dev functions migration db-reset db-types lint typecheck test test-db deploy-staging deploy-prod

install:
	npm install

dev:
	npm run dev

functions:
	npm run functions

migration:
	npm run db:migration -- $(name)

db-reset:
	npm run db:reset

db-types:
	npm run db:types

lint:
	npm run lint

typecheck:
	npm run typecheck

test:
	npm run test

test-db:
	npm run test:db

deploy-staging:
	@echo "deploy-staging: pendente — entra na Fase 1 quando houver ambiente de staging configurado."
	@exit 1

deploy-prod:
	@echo "deploy-prod: pendente — entra na Fase 1 quando houver ambiente de produção configurado."
	@exit 1
