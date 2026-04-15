# ArenaQuest

**ArenaQuest** is an open-source, cloud-agnostic engagement and knowledge management portal designed to gamify and track progress in physical and sports activities. Built with a focus on portability and scalability, the platform connects content creators (instructors) and participants (students) through a modular, serverless-ready architecture.

## 🚀 Vision

The project aims to provide a robust framework for managing hierarchical topics, tasks, and student evolution without being locked into a specific cloud provider. Whether you are running on AWS, GCP, Azure, or a private Proxmox-based homelab, ArenaQuest adapts to your infrastructure.

## 🏗️ Technical Architecture

The system is designed following a **Cloud-Agnostic Strategy**:

- **Front-End:** Modern, responsive interface (Next.js) focused on the participant's journey.
- **Back-End:** Decoupled logic using Cloudflare Workers (Wrangler) for serverless, edge-first API execution.
- **Database:** Utilizing flexible persistence layers (NoSQL/Document-based) to maintain schema agility.
- **Storage:** Object Storage integration for media handling, compatible with S3-like APIs.

## 🛠️ Key Features (Phase 1 & Beyond)

- **Hierarchical Content Management:** Organize sports and activities into logical trees of topics and sub-topics.
- **Engagement Engine:** Define tasks and stages to track user milestones.
- **Student Progress Portal:** A dedicated area for participants to visualize their growth and pending activities.
- **Administrative Backoffice:** Comprehensive tools for managing users, content, and system configurations.

## 🗺️ Roadmap

1. **Foundation & Infrastructure:** Setting up the core repository and CI/CD pipelines.
2. **Auth & User Management:** Implementing secure, portable authentication.
3. **Core Content & Media:** Deploying the hierarchical topic engine and media storage.
4. **Task Engine:** Building the logic for interconnection and progress tracking.

---

## 📂 Repository Structure

This project is organized as a **monorepo** using [pnpm workspaces](https://pnpm.io/workspaces) and [Turborepo](https://turbo.build/repo).

```
ArenaQuest/
├── apps/
│   ├── web/               # Next.js front-end application
│   └── api/               # Cloudflare Workers API (Wrangler)
├── packages/
│   └── shared/            # Shared types, utilities and constants
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

### 📦 Install

| Command | Description |
|---|---|
| `make install` | Install all workspace dependencies via `pnpm install` |

### 🚀 Development

| Command | Description |
|---|---|
| `make dev` | Start **all** apps in parallel (via Turborepo) |
| `make dev-web` | Start only `apps/web` (Next.js dev server) |
| `make dev-api` | Start only `apps/api` (Wrangler dev server) |

### 🏗️ Build

| Command | Description |
|---|---|
| `make build` | Build all apps and packages via Turborepo (with caching) |
| `make build-web` | Build only `apps/web` |
| `make build-api` | Build only `apps/api` |

### 🔍 Lint

| Command | Description |
|---|---|
| `make lint` | Lint all workspaces (via Turborepo) |
| `make lint-web` | Lint only `apps/web` |

### 🧪 Test

| Command | Description |
|---|---|
| `make test` | Run all tests across the monorepo |
| `make test-api` | Run `apps/api` tests (Vitest + Cloudflare Workers pool) |

### ☁️ Cloudflare Workers

| Command | Description |
|---|---|
| `make cf-typegen` | Regenerate Cloudflare Worker types (`wrangler types`) |
| `make deploy-api` | Deploy `apps/api` to Cloudflare Workers (production) |

### 🧹 Clean

| Command | Description |
|---|---|
| `make clean` | Remove build artefacts (`.next`, `dist`) from all apps |
| `make clean-cache` | Remove Turborepo caches (`.turbo` directories) |
| `make clean-all` | Remove build artefacts **and** Turborepo cache |

---

## 🤝 Contributing

As an open-source project, we welcome contributions! Whether you are a front-end developer, a backend enthusiast, or a DevOps specialist, your help is appreciated.

Please read the [CONTRIBUTING.md](CONTRIBUTING.md) guide before opening a Pull Request. It covers the **branch strategy**, commit conventions, PR guidelines, and local development setup.

## 📄 License

This project is licensed under the [MIT License](LICENSE).
