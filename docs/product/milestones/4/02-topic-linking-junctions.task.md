# Task 02: Topic Linking Junctions

## Metadata
- **Status:** Pending
- **Complexity:** Medium
- **Milestone:** 4 — Task Engine & Interconnection
- **Dependencies:** Task 01

---

## Summary

Add the two junction tables that wire `Task` and `TaskStage` to `TopicNode`, the
corresponding port (`ITaskLinkingRepository`), and its D1 adapter. Enforces the
"stage link ⊆ task link" invariant at the repository level.

---

## Technical Constraints

- **Narrowing invariant:** every `(stageId, topicId)` in `task_stage_topic_links`
  MUST have a matching `(taskId, topicId)` in `task_topic_links` where `stageId`
  belongs to `taskId`. Enforced in the adapter via a transactional read before
  write — **not** via SQL CHECK (D1 does not support cross-table CHECKs reliably).
- **Uniqueness:** `(task_id, topic_node_id)` and `(stage_id, topic_node_id)` are
  unique.
- **Cascades:** both junctions use `ON DELETE CASCADE` for the task/stage side and
  `ON DELETE RESTRICT` for the `topic_node_id` side — we want topic deletes to fail
  loudly until an admin explicitly detaches.

---

## Scope

### 1. Migration — `apps/api/migrations/0008_task_topic_links.sql`

```sql
CREATE TABLE task_topic_links (
  task_id       TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  topic_node_id TEXT NOT NULL REFERENCES topic_nodes(id) ON DELETE RESTRICT,
  created_at    TEXT NOT NULL,
  PRIMARY KEY (task_id, topic_node_id)
);

CREATE INDEX idx_ttl_topic ON task_topic_links(topic_node_id);

CREATE TABLE task_stage_topic_links (
  stage_id      TEXT NOT NULL REFERENCES task_stages(id) ON DELETE CASCADE,
  topic_node_id TEXT NOT NULL REFERENCES topic_nodes(id) ON DELETE RESTRICT,
  created_at    TEXT NOT NULL,
  PRIMARY KEY (stage_id, topic_node_id)
);

CREATE INDEX idx_tstl_topic ON task_stage_topic_links(topic_node_id);
```

### 2. Port — `packages/shared/ports/i-task-linking-repository.ts`

```ts
export interface ITaskLinkingRepository {
  /** Replace the task-level topic link set atomically. */
  setTaskTopics(taskId: string, topicIds: string[]): Promise<void>;
  listTaskTopics(taskId: string): Promise<string[]>;

  /** Replace the stage-level topic link set. Rejects ids not in the parent task set. */
  setStageTopics(stageId: string, topicIds: string[]): Promise<void>;
  listStageTopics(stageId: string): Promise<string[]>;

  /** Convenience aggregate used by read APIs. */
  hydrate(taskId: string): Promise<{
    taskTopicIds: string[];
    stageTopicIds: Record<string, string[]>; // keyed by stageId
  }>;
}
```

### 3. Adapter — `apps/api/src/adapters/db/d1-task-linking-repository.ts`

- `setTaskTopics` runs in a single `db.batch([...])`:
  `DELETE FROM task_topic_links WHERE task_id = ?` + N `INSERT OR IGNORE`.
- `setStageTopics` first reads the parent task id (via `task_stages`), loads the
  current `taskTopicIds`, validates `topicIds ⊆ taskTopicIds` — throws a typed
  `StageTopicNotInTaskError` if not — then batches delete + insert.
- `hydrate` issues exactly two queries (one per junction) and reduces them in memory.

### 4. Tests

`apps/api/test/adapters/d1-task-linking-repository.spec.ts`:

- Round-trip: set → list returns the same set.
- Replacement: setting a smaller set removes the removed ids.
- Stage subset: `setStageTopics([T1, T2])` when the task has `[T1]` throws
  `StageTopicNotInTaskError`; DB unchanged.
- Cascade: deleting a stage removes its stage-topic links; deleting a task removes
  both sets for that task.
- `hydrate` returns correct shape for a task with 2 stages and 3 task-topic links.

---

## Acceptance Criteria

- [ ] Migration applies cleanly.
- [ ] `ITaskLinkingRepository` exported from `packages/shared/index.ts`.
- [ ] All tests in §4 pass under the workers pool.
- [ ] A typed error class `StageTopicNotInTaskError` lives in `packages/shared/ports/`
      and is used by the adapter.
- [ ] `make lint` clean. `make test-api` green.

---

## Verification Plan

1. Apply migration; `.schema` confirms both junctions with expected FKs.
2. Vitest suite green.
3. Manual REPL: attach topic T, delete T → D1 returns `FOREIGN KEY constraint failed`,
   confirming the RESTRICT behaviour.
