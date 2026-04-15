# ==============================================================================
# ArenaQuest — Monorepo Makefile
# Stack: pnpm workspaces + Turborepo | apps/web (Next.js) | apps/api (Wrangler)
# ==============================================================================

.DEFAULT_GOAL := help
.PHONY: help install dev dev-web dev-api build build-web build-api \
        lint lint-web lint-shared test test-api \
        cf-typegen deploy-api deploy-web \
        clean clean-cache clean-all

# ── Colours ────────────────────────────────────────────────────────────────────
CYAN  := \033[0;36m
RESET := \033[0m
BOLD  := \033[1m

# ==============================================================================
# 📖 HELP
# ==============================================================================
help: ## Show this help message
	@echo ""
	@echo "$(BOLD)ArenaQuest — available commands$(RESET)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  $(CYAN)%-18s$(RESET) %s\n", $$1, $$2}'
	@echo ""

# ==============================================================================
# 📦 INSTALL
# ==============================================================================
install: ## Install all workspace dependencies
	pnpm install

# ==============================================================================
# 🚀 DEVELOPMENT
# ==============================================================================
dev: ## Start all apps in parallel (Turborepo)
	pnpm turbo run dev

dev-web: ## Start only apps/web (Next.js dev server)
	pnpm --filter web dev

dev-api: ## Start only apps/api (Wrangler dev server)
	pnpm --filter api dev

# ==============================================================================
# 🏗️  BUILD
# ==============================================================================
build: ## Build all apps and packages (Turborepo)
	pnpm turbo run build

build-web: ## Build only apps/web
	pnpm --filter web build

build-api: ## Build only apps/api
	pnpm --filter api build

# ==============================================================================
# 🔍 LINT
# ==============================================================================
lint: ## Lint all workspaces (Turborepo)
	pnpm turbo run lint

lint-web: ## Lint only apps/web
	pnpm --filter web lint

lint-shared: ## Lint only packages/shared
	pnpm --filter @arenaquest/shared lint

# ==============================================================================
# 🧪 TEST
# ==============================================================================
test: ## Run all tests
	pnpm turbo run test

test-api: ## Run apps/api tests (Vitest + Cloudflare Workers pool)
	pnpm --filter api test

# ==============================================================================
# 🔧 CLOUDFLARE WORKERS UTILS
# ==============================================================================
cf-typegen: ## Regenerate Cloudflare Worker types (wrangler types)
	pnpm --filter api cf-typegen

# ==============================================================================
# 🚢 DEPLOY
# ==============================================================================
deploy-web: ## Build and deploy apps/web to Cloudflare Pages (requires CF_API_TOKEN + CF_ACCOUNT_ID)
	pnpm turbo build --filter=web... && \
	pnpm --filter web exec wrangler pages deploy .next --project-name=arenaquest-web

deploy-api: ## Deploy apps/api to Cloudflare Workers (production)
	pnpm --filter api deploy

# ==============================================================================
# 🧹 CLEAN
# ==============================================================================
clean: ## Remove build artefacts (.next, dist) from all apps
	@echo "$(CYAN)Cleaning build artefacts...$(RESET)"
	rm -rf apps/web/.next
	rm -rf apps/api/dist
	@echo "Done."

clean-cache: ## Remove Turborepo cache (.turbo)
	@echo "$(CYAN)Cleaning Turborepo cache...$(RESET)"
	rm -rf .turbo apps/**/.turbo
	@echo "Done."

clean-all: clean clean-cache ## Remove build artefacts AND Turborepo cache
