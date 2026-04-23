# Task 04: Topic Progress API (visit + complete)

## Metadata
- **Status:** Pending
- **Complexity:** Low
- **Milestone:** 5 — Engagement & Student Progress
- **Dependencies:** Task 01, Task 02

---

## Summary

Two small write endpoints for topic-level progress signals:

- `POST /topics/:id/visit` — idempotent signal that the student opened the
  topic; transitions `not_started → in_progress`, never regresses.
- `POST /topics/:id/complete` — explicit mark-as-done; transitions whatever →
  `completed`.

Both routes respect the access gate and refuse draft/archived topics.

---

## Technical Constraints

- **Monotonic status:** `visit` never demotes. If the row is already
  `completed`, `visit` returns 200 with the existing row and no mutation.
- **Idempotency:** `complete` is likewise a single-shot marker. Repeated calls
  return 200 + existing row.
- **Access gate:** 403 if the topic id is not in the user's effective-access
  set. Draft/archived topics → 404 (leaking draft-vs-unenrolled would be an
  info-disclosure bug).
- **Response shape:** `{ topicProgress: TopicProgressRecord, changed: boolean }`
  so the UI can decide whether to refresh dashboard aggregates.

---

## Scope

### 1. Extend `ProgressService`

```ts
markTopicVisited(userId, topicId): Promise<{ topicProgress, changed }>;
markTopicCompleted(userId, topicId): Promise<{ topicProgress, changed }>;
```

### 2. Router — extend `progress.router.ts`

```ts
router.post('/topics/:id/visit',    visitHandler);
router.post('/topics/:id/complete', completeHandler);
```

### 3. Tests — `apps/api/test/routes/topic-progress.spec.ts`

- First `visit` on a published topic → 200 + `in_progress`.
- `visit` when already `completed` → 200 + no status change.
- `complete` from `not_started` → 200 + `completed_at` stamped.
- `visit` on a draft topic → 404.
- `complete` without enrollment → 403.
- Non-existent topic id → 404.

---

## Acceptance Criteria

- [ ] Both routes implemented and tested.
- [ ] The monotonic-status contract has an explicit test.
- [ ] `make lint` clean. `make test-api` green.

---

## Verification Plan

1. `pnpm --filter api test` green.
2. Curl as seeded student:
   `POST /topics/$T/visit` → 200 `in_progress`,
   `POST /topics/$T/complete` → 200 `completed`,
   `POST /topics/$T/visit` → 200 (no regression).
