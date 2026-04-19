# Task 03: Stage Check-in API

## Metadata
- **Status:** Pending
- **Complexity:** Medium
- **Milestone:** 5 — Engagement & Student Progress
- **Dependencies:** Task 01, Task 02 (effective-access check)

---

## Summary

The student-facing write path for task engagement:
`POST /tasks/:id/stages/:stageId/check-in`. Handles ordering (no skipping),
idempotency (double-click safe), side-effects (topic progress + task
completion), and access gating.

---

## Technical Constraints

- **Single service entry point** — `ProgressService.checkInStage(userId,
  taskId, stageId)` — so the HTTP layer stays thin.
- **Transactionality:** the check-in and its side-effects (upsert task
  progress, upsert topic progress for linked topics) run in a single
  `db.batch([...])` so a partial failure does not leave the DB in a weird
  shape.
- **Idempotency:** the contract is "insert OR fetch existing"; the handler
  returns `201` on first call and `200` on a repeat. The response body is
  identical in shape.
- **Ordering:** compute the expected next stage as
  `stages.sort(by order).find(s => !checkedIn.has(s.id))`. If the requested
  stage is not strictly that stage, return `409 OUT_OF_ORDER` with
  `{ expected: { id, label, order } }`.
- **Access gate:** if the task's linked topic set is not a subset of the
  user's `effectiveAccess`, return `403 NOT_ENROLLED` (before the ordering
  check — we don't want to leak ordering info to unenrolled users).

---

## Scope

### 1. Service — `apps/api/src/core/progress/progress-service.ts`

```ts
class ProgressService {
  constructor(
    private progress: IProgressRepository,
    private tasks: ITaskRepository,
    private stages: ITaskStageRepository,
    private linking: ITaskLinkingRepository,
    private enrollments: IEnrollmentRepository,
  ) {}

  async checkInStage(userId, taskId, stageId) {
    // 1. Load task + stages + task-topic links.
    // 2. Enforce published + access gate.
    // 3. Enforce ordering.
    // 4. Insert stage row if missing; compute whether this is the final stage.
    // 5. Upsert task_progress (status, current_stage_id, completed_at).
    // 6. For every topic linked to THIS stage, upsert topic_progress = completed.
    // 7. Return { taskProgress, stageProgress, created: boolean }.
  }
}
```

### 2. Router — `apps/api/src/routes/progress.router.ts`

```ts
router.post('/tasks/:id/stages/:stageId/check-in', checkInHandler);
```

### 3. Tests — `apps/api/test/routes/stage-check-in.spec.ts`

Scenarios (each with a fresh seeded DB):
- First-ever check-in on stage 1 → 201; row created.
- Check-in on stage 2 without stage 1 → 409 `OUT_OF_ORDER`; DB unchanged.
- Check-in on stage 1 twice → 201 then 200; exactly one row.
- Final-stage check-in sets `task_progress.status = completed` and stamps
  `completed_at`.
- Stage linked to topics `[A, B]` → `topic_progress` for A and B is `completed`
  after the call.
- Un-enrolled user → 403 `NOT_ENROLLED`.
- Archived task → 404.
- Race test: two parallel requests for the same `(user, stage)` → exactly one
  `201`, exactly one `200`, exactly one DB row.

---

## Acceptance Criteria

- [ ] Endpoint implemented with the full contract in §3.
- [ ] All test cases pass, including the race test (uses `Promise.all` in the
      Vitest Workers harness).
- [ ] The service exports `ProgressService` for reuse by Task 04 / Task 06.
- [ ] `make lint` clean. `make test-api` green.

---

## Verification Plan

1. `pnpm --filter api test` green.
2. Curl sequence as a seeded student:
   `POST /tasks/$T/stages/$S1/check-in` → 201,
   same request again → 200,
   `POST .../$S3/check-in` before S2 → 409.
