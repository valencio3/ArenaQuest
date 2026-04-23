# Task 06: Progress Aggregation Service + `/me/progress/*`

## Metadata
- **Status:** Pending
- **Complexity:** Medium
- **Milestone:** 5 — Engagement & Student Progress
- **Dependencies:** Task 01, Task 02, Task 03, Task 04

---

## Summary

Read endpoints the student dashboard lives on. All three routes scope their
answer to the caller's effective-access set so percentages are meaningful
(completion of "what the student can see", not of the global catalogue).

---

## Technical Constraints

- **Everything is computed:** no denormalised counters in M5. Each request runs
  small, indexed queries; if p95 > 500 ms under the 1000-topic fixture, add
  caching in a follow-up task rather than inline.
- **Caller scoping:** the "denominator" for percentages is the intersection of
  `effectiveAccessTopicIds` with `topic_nodes.status = 'published'` (topics),
  and analogously for tasks (published AND every linked topic in the user's
  effective access).
- **Response shapes are committed** via `packages/shared/types/api.ts` so the
  web client and future mobile clients share them.
- **Cache-Control:** `private, max-age=15` on all three routes (the dashboard
  refreshes visibly on navigation but doesn't hammer the API).

---

## Scope

### 1. Service — extend `ProgressService`

```ts
getMySummary(userId): Promise<ProgressSummary>;
listMyTopicProgress(userId): Promise<TopicProgressEntry[]>;
listMyTaskProgress(userId): Promise<TaskProgressEntry[]>;
```

Where `ProgressSummary`:

```ts
interface ProgressSummary {
  topics:  { total: number; completed: number; inProgress: number; percent: number };
  tasks:   { total: number; completed: number; inProgress: number; percent: number };
  lastActivityAt: string | null;
}
```

### 2. Router — extend `progress.router.ts`

```ts
router.get('/me/progress/summary', summaryHandler);
router.get('/me/progress/topics',  topicsHandler);
router.get('/me/progress/tasks',   tasksHandler);
```

### 3. Percentage rounding: `Math.round(completed / total * 100)` with a defined
    `total === 0 ⇒ percent = 0` branch (no NaN).

### 4. Tests — `apps/api/test/routes/me-progress.spec.ts`

- 10 topics accessible, 4 completed → `topicsPercent === 40`.
- 0 accessible tasks → `tasks.percent === 0` (not NaN).
- `listMyTopicProgress` only returns rows for accessible topics (no leaks).
- `lastActivityAt` equals the max of topic/task progress `updated_at`.
- Cache-Control header present on all three routes.

---

## Acceptance Criteria

- [ ] All three routes implemented behind `authGuard`.
- [ ] Percentages are deterministic and cover the `total === 0` branch.
- [ ] Responses match the shared types; `packages/shared` exports them.
- [ ] `make lint` clean. `make test-api` green.

---

## Verification Plan

1. `pnpm --filter api test` green.
2. Seed fixture: 10 topics, 4 completed, 5 tasks, 2 completed → manual curl
   confirms `{ topics: { percent: 40 }, tasks: { percent: 40 } }`.
