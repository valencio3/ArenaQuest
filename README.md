# ArenaQuest

**ArenaQuest** is an open-source, cloud-agnostic engagement and knowledge management portal designed to gamify and track progress in physical and sports activities. Built with a focus on portability and scalability, the platform connects content creators (instructors) and participants (students) through a modular, serverless-ready architecture.

## 🚀 Vision

The project aims to provide a robust framework for managing hierarchical topics, tasks, and student evolution without being locked into a specific cloud provider. Whether you are running on AWS, GCP, Azure, or a private Proxmox-based homelab, ArenaQuest adapts to your infrastructure.

## 🏗️ Technical Architecture

The system is designed following a **Cloud-Agnostic Strategy**:

- **Front-End:** Next.js 15 (React 19) covering the participant catalog, admin backoffice, and authentication flows.
- **Back-End:** Hono-based API running on Cloudflare Workers (Wrangler), organised around a controller layer with `ControllerResult`, Zod-driven `@ValidateBody`/`@Body` decorators, and per-request adapter wiring.
- **Database:** Cloudflare D1 (SQLite) for structured data with a repository-based abstraction layer (users, refresh tokens, topic nodes, tags, media).
- **Cache/Rate-Limit:** Cloudflare KV for transient state and security (login throttling).
- **Storage:** Cloudflare R2 (S3-compatible) with a presigned-upload lifecycle for media handling.

## 🛠️ Key Features (Phase 1 & Beyond)

- **Secure Authentication:** Portable JWT-based auth with PBKDF2 hashing (Web Crypto API), refresh-token rotation, and KV-backed login rate limiting.
- **Hierarchical Content Management:** Topic-tree engine with draft/published/archived states, prerequisites, tags, and Markdown content sanitisation.
- **Media Pipeline:** Presigned uploads to R2/S3, attached to topics and surfaced through dedicated viewers (image, video, document).
- **Engagement Engine:** Tasks and stages to track user milestones (in progress).
- **Student Progress Portal:** A dedicated area for participants to navigate the catalog and visualise their growth.
- **Administrative Backoffice:** Drag-and-drop topic tree, media manager, and user administration with admin lockout guards.

## 🗺️ Roadmap

1. **✅ Foundation & Infrastructure:** Core repository, monorepo setup, and CI/CD.
2. **✅ Auth & User Management:** Secure, portable authentication and admin guards.
3. **✅ Core Content & Media:** Hierarchical topic engine, R2-backed media pipeline, and public catalog.
4. **🚧 Task Engine:** Building the logic for interconnection and progress tracking.

---

## 📂 Repository Structure

This project is organized as a **monorepo** using [pnpm workspaces](https://pnpm.io/workspaces) and [Turborepo](https://turbo.build/repo).

```
ArenaQuest/
├── apps/
│   ├── web/               # Next.js front-end application
│   └── api/               # Cloudflare Workers API (Wrangler)
├── packages/
│   └── shared/            # Shared types, ports (interfaces), and utilities
├── turbo.json             # Turborepo pipeline configuration
├── pnpm-workspace.yaml    # pnpm workspace declarations
├── package.json           # Root package (dev tooling)
└── Makefile               # Developer shortcuts (see below)
```

---

## ⚙️ Getting Started

**Prerequisites:** Node.js ≥ 20 and pnpm ≥ 9.

```bash
# 1. Clone the repository
git clone https://github.com/your-org/ArenaQuest.git
cd ArenaQuest

# 2. Install all workspace dependencies
make install

# 3. Start all apps in development mode (parallel)
make dev
```

> The web app will be available at **http://localhost:3000** and the API Worker at **http://localhost:8787** by default.

---

## 🧰 Makefile Reference

A `Makefile` is provided at the root of the repository with convenient shortcuts for the most common development tasks. Run `make help` at any time to list all available commands.

### 📦 Install & Setup

| Command | Description |
|---|---|
| `make install` | Install all workspace dependencies via `pnpm install` |
| `make bootstrap-admin` | Interactively create the first admin account |

### 🚀 Development

| Command | Description |
|---|---|
| `make dev` | Start **all** apps in parallel (via Turborepo) |
| `make dev-web` | Start only `apps/web` (Next.js dev server) |
| `make dev-api` | Start only `apps/api` (Wrangler dev server) |

### 🏗️ Build & Lint

| Command | Description |
|---|---|
| `make build` | Build all apps and packages via Turborepo |
| `make lint` | Lint all workspaces |
| `make test` | Run all tests across the monorepo |

### 🗄️ Database & Cloudflare Resources

| Command | Description |
|---|---|
| `make db-migrations-dev` | Apply D1 migrations to the local dev database |
| `make db-migrations-staging` | Apply D1 migrations to the remote staging database |
| `make db-migrations-prod` | Apply D1 migrations to the remote production database |
| `make create-db` / `create-db-staging` | Create a new D1 database (production / staging) |
| `make create-kv` / `create-kv-staging` | Create the `RATE_LIMIT_KV` namespace |
| `make list-kv` / `list-kv-staging` | List existing KV namespaces |
| `make cf-typegen` | Regenerate Worker bindings types |

### ☁️ Deployment

| Command | Description |
|---|---|
| `make deploy` | Deploy both Web and API to **Production** |
| `make deploy-staging` | Deploy both Web and API to **Staging** |
| `make deploy-api` / `deploy-api-staging` | Deploy only `apps/api` |
| `make deploy-web` / `deploy-web-staging` | Deploy only `apps/web` |

### 🧹 Clean

| Command | Description |
|---|---|
| `make clean` | Remove `.next`, `.vercel`, and `dist` build artefacts |
| `make clean-cache` | Remove Turborepo caches |
| `make clean-all` | Run both of the above |

---

## 🚀 CI / CD & GitHub Secrets

The following GitHub Actions workflows are defined in `.github/workflows/`:

| Workflow | Trigger | Purpose |
|---|---|---|
| `ci.yml` | Push / PR → `main`, `develop` | Lint → Build → Test |
| `deploy-web.yml` | Push → `main`, `develop` | Build & deploy `apps/web` |
| `deploy-api.yml` | Push → `main`, `develop` | Build & deploy `apps/api` |

### Required GitHub Secrets

| Secret | Description |
|---|---|
| `CF_API_TOKEN` | Cloudflare API token (Pages & Workers edit permissions) |
| `CF_ACCOUNT_ID` | Your Cloudflare account ID |

---

## 🤝 Contributing

As an open-source project, we welcome contributions! Please read the [CONTRIBUTING.md](CONTRIBUTING.md) guide before opening a Pull Request.

## 📄 License

This project is licensed under the [MIT License](LICENSE).
