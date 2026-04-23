# Task 01: Progress Data Layer

## Metadata
- **Status:** Pending
- **Complexity:** Medium
- **Milestone:** 5 — Engagement & Student Progress
- **Dependencies:** Milestone 3 Task 01 (topics), Milestone 4 Task 01 (tasks & stages)

---

## Summary

Introduce the three progress tables, their port (`IProgressRepository`), and its
D1 adapter. The API surface is covered in Tasks 03, 04, and 06 — this task is
strictly data-layer.

---

## Technical Constraints

- **Append-only for stage check-ins:** no `updated_at` column on
  `task_stage_progress`; there is no `update` method on the repo.
- **Upsert semantics:** `topic_progress` and `task_progress` use "insert on
  conflict do update" via D1's `INSERT ... ON CONFLICT(...) DO UPDATE`.
- **UTC ISO timestamps** everywhere.
- **No business logic in the adapter** — ordering / gating / aggregation lives
  in the service layer (Task 03+).

---

## Scope

### 1. Migration — `apps/api/migrations/0009_progress.sql`

```sql
CREATE TABLE topic_progress (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic_node_id TEXT NOT NULL REFERENCES topic_nodes(id) ON DELETE CASCADE,
  status        TEXT NOT NULL CHECK (status IN ('not_started','in_progress','completed')),
  completed_at  TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  UNIQUE (user_id, topic_node_id)
);
CREATE INDEX idx_topic_progress_user ON topic_progress(user_id);

CREATE TABLE task_progress (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id          TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  status           TEXT NOT NULL CHECK (status IN ('not_started','in_progress','completed')),
  current_stage_id TEXT REFERENCES task_stages(id),
  completed_at     TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  UNIQUE (user_id, task_id)
);
CREATE INDEX idx_task_progress_user ON task_progress(user_id);

CREATE TABLE task_stage_progress (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id        TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  stage_id       TEXT NOT NULL REFERENCES task_stages(id) ON DELETE CASCADE,
  checked_in_at  TEXT NOT NULL,
  UNIQUE (user_id, stage_id)
);
CREATE INDEX idx_stage_progress_user_task ON task_stage_progress(user_id, task_id);
```

### 2. Port — `packages/shared/ports/i-progress-repository.ts`

```ts
export interface IProgressRepository {
  // topic progress
  getTopicProgress(userId, topicId): Promise<TopicProgressRecord | null>;
  listTopicProgress(userId, topicIds?: string[]): Promise<TopicProgressRecord[]>;
  upsertTopicProgress(
    userId, topicId,
    patch: { status: ProgressStatus; completedAt?: string | null },
  ): Promise<TopicProgressRecord>;

  // task progress
  getTaskProgress(userId, taskId): Promise<TaskProgressRecord | null>;
  listTaskProgress(userId): Promise<TaskProgressRecord[]>;
  upsertTaskProgress(
    userId, taskId,
    patch: { status: ProgressStatus; currentStageId?: string | null; completedAt?: string | null },
  ): Promise<TaskProgressRecord>;

  // stage check-ins
  hasStageCheckIn(userId, stageId): Promise<boolean>;
  listStageCheckIns(userId, taskId): Promise<TaskStageProgressRecord[]>;
  createStageCheckIn(userId, taskId, stageId): Promise<TaskStageProgressRecord>;

  // aggregates — used by the dashboard
  countCompletedTopics(userId, topicIds?: string[]): Promise<number>;
  countCompletedTasks(userId, taskIds?: string[]): Promise<number>;
}
```

### 3. Adapter — `apps/api/src/adapters/db/d1-progress-repository.ts`

Prepared statements. `createStageCheckIn` uses `INSERT OR IGNORE` + a post-read
to support the "double check-in returns the existing row" contract (the service
layer wraps this into a 200 response).

### 4. Tests — `apps/api/test/adapters/d1-progress-repository.spec.ts`

- Upsert topic progress twice → one row, last write wins.
- Insert stage check-in twice with the same `(user, stage)` → second call does
  not create a row; `hasStageCheckIn` returns `true` either way.
- Count queries respect the optional `topicIds` / `taskIds` filter.
- Cascade: deleting a task removes its stage-progress rows and its task-progress
  rows (relies on FK cascade).

---

## Acceptance Criteria

- [ ] Migration applies cleanly.
- [ ] Port exported from `packages/shared/index.ts`.
- [ ] Adapter passes all Vitest specs under the workers pool.
- [ ] `make lint` clean. `make test-api` green.
- [ ] No D1 types leak outside `apps/api/src/adapters/db/`.

---

## Verification Plan

1. `pnpm --filter api exec wrangler d1 migrations apply DB --local`.
2. `pnpm --filter api test` → new suite green.
3. `sqlite3 .wrangler/state/d1/DB.sqlite ".schema topic_progress"` → matches §1.
