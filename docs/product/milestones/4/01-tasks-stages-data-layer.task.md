# Task 01: Tasks & Stages Data Layer

## Metadata
- **Status:** Pending
- **Complexity:** Medium
- **Milestone:** 4 — Task Engine & Interconnection
- **Dependencies:** Milestone 3 Task 01 (topics table must exist so FKs are valid later)

---

## Summary

Introduce the two backbone entities of Milestone 4 — `Task` and `TaskStage` — as:

- Two ports (`ITaskRepository`, `ITaskStageRepository`) in `packages/shared/ports/`.
- Two D1-backed adapters under `apps/api/src/adapters/db/`.
- A new migration `0007_tasks_and_stages.sql`.
- Matching Vitest integration tests.

Linking tables are added in Task 02; this task deliberately stops at the root entities.

---

## Technical Constraints

- **Ports first:** no concrete D1 imports in the port definitions. The port returns
  plain records, never `D1Result`.
- **Status enum:** reuse a new enum `Entities.Config.TaskStatus` with values
  `draft`, `published`, `archived`, added to `packages/shared/types/entities.ts`.
  Mirror the exact pattern used for `TopicNodeStatus`.
- **Ordering:** `task_stages.order` is an integer. Sibling uniqueness within a task is
  enforced by a unique index on `(task_id, order)`. Gaps are allowed.
- **Timestamps:** `created_at` / `updated_at` are ISO strings (UTC) — consistent with
  the topic migrations.
- **Cascade:** `task_stages.task_id` FK has `ON DELETE CASCADE`.

---

## Scope

### 1. Migration — `apps/api/migrations/0007_tasks_and_stages.sql`

```sql
CREATE TABLE tasks (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'draft'
               CHECK (status IN ('draft','published','archived')),
  created_by   TEXT NOT NULL REFERENCES users(id),
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE INDEX idx_tasks_status     ON tasks(status);
CREATE INDEX idx_tasks_created_by ON tasks(created_by);

CREATE TABLE task_stages (
  id         TEXT PRIMARY KEY,
  task_id    TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  label      TEXT NOT NULL,
  "order"    INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (task_id, "order")
);

CREATE INDEX idx_task_stages_task ON task_stages(task_id);
```

### 2. Ports — `packages/shared/ports/i-task-repository.ts`

```ts
export interface TaskRecord {
  id: string;
  title: string;
  description: string;
  status: Entities.Config.TaskStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ITaskRepository {
  findById(id: string): Promise<TaskRecord | null>;
  list(filter: { status?: TaskStatus; limit?: number; offset?: number }): Promise<TaskRecord[]>;
  create(input: Omit<TaskRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<TaskRecord>;
  update(id: string, patch: Partial<Pick<TaskRecord, 'title' | 'description' | 'status'>>): Promise<TaskRecord>;
  delete(id: string): Promise<void>;
}
```

### 3. Ports — `packages/shared/ports/i-task-stage-repository.ts`

```ts
export interface TaskStageRecord {
  id: string;
  taskId: string;
  label: string;
  order: number;
  createdAt: string;
}

export interface ITaskStageRepository {
  listByTask(taskId: string): Promise<TaskStageRecord[]>;
  findById(id: string): Promise<TaskStageRecord | null>;
  create(input: Omit<TaskStageRecord, 'id' | 'createdAt'>): Promise<TaskStageRecord>;
  update(id: string, patch: Partial<Pick<TaskStageRecord, 'label' | 'order'>>): Promise<TaskStageRecord>;
  delete(id: string): Promise<void>;
  /** Rewrite orders atomically to the given sequence. */
  reorder(taskId: string, orderedIds: string[]): Promise<void>;
}
```

### 4. Adapters

- `apps/api/src/adapters/db/d1-task-repository.ts`
- `apps/api/src/adapters/db/d1-task-stage-repository.ts`

Use prepared statements, `.bind(...)`, and the project's existing UUID helper. Map
rows with a shared `mapRow` in each file, same pattern as the topic repository.

### 5. Tests

- `apps/api/test/adapters/d1-task-repository.spec.ts` — CRUD round-trip, filter by
  status.
- `apps/api/test/adapters/d1-task-stage-repository.spec.ts` — create / reorder /
  delete, unique-order violation surfaces an error the service layer can translate.

Tests run under the workers pool (`@cloudflare/vitest-pool-workers`) with a migrated
in-memory D1.

---

## Acceptance Criteria

- [ ] Migration applied cleanly in a fresh dev DB via the existing migration runner.
- [ ] `ITaskRepository` and `ITaskStageRepository` exported from
      `packages/shared/index.ts`.
- [ ] `Entities.Config.TaskStatus` enum exists and is used in the port types.
- [ ] Both adapters pass their Vitest integration suites.
- [ ] `make lint` clean. `make test-api` green.
- [ ] No D1-specific type leaks outside `apps/api/src/adapters/db/`.

---

## Verification Plan

1. `pnpm --filter api exec wrangler d1 migrations apply DB --local` → migration
   succeeds.
2. `pnpm --filter api test` → new suites pass.
3. `grep -R "D1Database" apps/api/src/core apps/api/src/routes` → zero hits.
