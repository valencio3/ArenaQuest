# Task 04: Admin Task Stages API

## Metadata
- **Status:** Pending
- **Complexity:** Medium
- **Milestone:** 4 — Task Engine & Interconnection
- **Dependencies:** Task 03

---

## Summary

Nested REST endpoints for `TaskStage` CRUD + bulk reorder. Lives under
`/admin/tasks/:id/stages`. Includes the parent-status guard ("cannot delete stages
on a published task").

---

## Technical Constraints

- **Order allocation on create:** new stages go to `max(order) + 10` (gaps of 10 keep
  manual insertions cheap without a full renumber). If the table is empty, start at
  `10`.
- **Reorder atomicity:** `POST /admin/tasks/:id/stages/reorder` accepts the full
  ordered id list and rewrites every `order` in a single batched transaction. The
  request is rejected if the id set does not exactly match the persisted set
  (`409 STAGE_SET_MISMATCH`).
- **Delete guard:** if the parent task is `published`, `DELETE` returns
  `409 STAGE_DELETE_FORBIDDEN` with `reason: 'PARENT_PUBLISHED'`.
- **Label validation:** 1–120 chars, trimmed, no newlines.

---

## Scope

### 1. Extend `TaskService` (same file as Task 03)

```ts
addStage(taskId, input: { label: string }): Promise<TaskStageRecord>;
updateStage(taskId, stageId, patch: { label?: string }): Promise<TaskStageRecord>;
deleteStage(taskId, stageId): Promise<void>;   // enforces parent-status guard
reorderStages(taskId, orderedIds: string[]): Promise<TaskStageRecord[]>;
```

The service validates that `stageId.taskId === taskId` before mutation (404 if not).

### 2. Router — extend `admin-tasks.router.ts`

```ts
router.post  ('/admin/tasks/:id/stages',                       addStageHandler);
router.patch ('/admin/tasks/:id/stages/:stageId',              updateStageHandler);
router.delete('/admin/tasks/:id/stages/:stageId',              deleteStageHandler);
router.post  ('/admin/tasks/:id/stages/reorder',               reorderHandler);
```

### 3. Tests — `apps/api/test/routes/admin-task-stages.spec.ts`

- Create stage on draft task → 201; order is 10 (first), 20 (second), 30 (third).
- Reorder `[third, first, second]` → 200, reading the task returns the new order.
- Reorder with a missing id → 409 `STAGE_SET_MISMATCH`.
- PATCH label to a 200-char string → 400 (validation).
- Delete on `draft` task → 204.
- Delete on `published` task → 409 `STAGE_DELETE_FORBIDDEN`.
- Stage not belonging to `:id` → 404.

---

## Acceptance Criteria

- [ ] All routes in §2 implemented, tested, and wired in `AppRouter`.
- [ ] Order allocation and reorder atomicity verified under concurrent-write test
      (two requests racing reorder → both succeed or one returns `STAGE_SET_MISMATCH`;
      no duplicate orders).
- [ ] `make lint` clean. `make test-api` green.

---

## Verification Plan

1. `pnpm --filter api test` green.
2. Manual sequence via curl:
   - create task (draft), add 3 stages, reorder, delete middle stage, read.
3. `sqlite3 .wrangler/state/d1/DB.sqlite "SELECT id, \"order\" FROM task_stages;"` →
   orders match the last reorder call.
