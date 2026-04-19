# Task 05: Admin Task-Topic Linking API

## Metadata
- **Status:** Pending
- **Complexity:** Medium
- **Milestone:** 4 — Task Engine & Interconnection
- **Dependencies:** Task 02, Task 03, Task 04

---

## Summary

Endpoints that **replace** the topic link set for a task and for each individual
stage. Uses the `ITaskLinkingRepository.setTaskTopics` / `setStageTopics` methods
wired in Task 02.

---

## Technical Constraints

- **PUT-style semantics for "replace a set":** the request body is the complete
  desired set; the server mirrors it exactly. We expose `POST` (not `PUT`) because
  the path is action-flavoured (`/topics` is not the resource — `task` is) and it
  mirrors the Rails-style nested-action convention already used elsewhere in this
  codebase.
- **Validation:** each `topicIds` entry must be a valid UUID format and must
  correspond to an existing `topic_node` row. Missing ids → `400
  UNKNOWN_TOPIC_IDS` with the offending list.
- **Stage subset enforcement:** the adapter throws `StageTopicNotInTaskError` (from
  Task 02); the route maps it to `409 STAGE_TOPIC_NOT_IN_TASK`.
- **Publish consistency:** if the task is `published`, every new topic id must also
  be `published` (same check as Task 03's publish gate). Otherwise `409
  LINKED_TOPIC_NOT_PUBLISHED`. Drafts can link to drafts freely.

---

## Scope

### 1. Extend `TaskService`

```ts
setTaskTopics(taskId, topicIds: string[]): Promise<string[]>;
setStageTopics(taskId, stageId, topicIds: string[]): Promise<string[]>;
```

Both return the persisted id set (sorted) so the client can diff.

### 2. Router — extend `admin-tasks.router.ts`

```ts
router.post('/admin/tasks/:id/topics',                     setTaskTopicsHandler);
router.post('/admin/tasks/:id/stages/:stageId/topics',     setStageTopicsHandler);
```

Request body: `{ topicIds: string[] }`.

### 3. Consistency on shrink: when the task-level set shrinks, the service MUST also
    shrink every stage's set to stay a subset. Implement as:

```ts
async setTaskTopics(taskId, topicIds) {
  await linking.setTaskTopics(taskId, topicIds);
  const stages = await stageRepo.listByTask(taskId);
  for (const s of stages) {
    const current = await linking.listStageTopics(s.id);
    const pruned  = current.filter(id => topicIds.includes(id));
    if (pruned.length !== current.length) {
      await linking.setStageTopics(s.id, pruned);
    }
  }
  return topicIds;
}
```

(Batched inside a single D1 transaction at the adapter level if the adapter allows
it; otherwise sequential is acceptable for M4.)

### 4. Tests — `apps/api/test/routes/admin-task-linking.spec.ts`

- Set `[T1, T2]` on a draft task → 200; `hydrate` confirms the set.
- Set `[T1]` when a stage had `[T1, T2]` → stage set shrinks to `[T1]`
  automatically.
- Set `[T1, T2]` on a stage when the task has `[T1]` → 409
  `STAGE_TOPIC_NOT_IN_TASK`; DB unchanged.
- Set topics with an unknown id → 400 `UNKNOWN_TOPIC_IDS`.
- On a published task, set topics containing a draft id → 409
  `LINKED_TOPIC_NOT_PUBLISHED`.
- Empty array resets the set to empty (200).

---

## Acceptance Criteria

- [ ] Both routes implemented and tested.
- [ ] The shrink-cascade invariant has an explicit test.
- [ ] `make lint` clean. `make test-api` green.

---

## Verification Plan

1. `pnpm --filter api test` green.
2. Curl sequence: create task, link 2 topics, add stage, link stage to both, shrink
   task to one, GET stage → shrinks automatically.
