# Task 09: Frontend — Stage Check-in UI + Topic Mark-as-read

## Metadata
- **Status:** Pending
- **Complexity:** Medium
- **Milestone:** 5 — Engagement & Student Progress
- **Dependencies:** Task 03, Task 04, Milestone 4 Task 09 (student task view)

---

## Summary

Wire the two student-facing write surfaces:

- On `/tasks/:id`, per-stage "Check in" buttons respecting ordering.
- On `/catalog/:id`, a "Mark as read" button + a silent "visited" beacon on
  first mount.

---

## Technical Constraints

- **Disable-then-toast pattern:** the check-in button disables while the
  request is in flight. On 409 `OUT_OF_ORDER`, the UI surfaces
  "Check in stage ⟨N⟩ first" using the `expected.label` from the error body.
- **Double-click guard:** the onClick handler bails if a pending request is
  already tracked for that stage id (local Map). Separate from the server-side
  idempotency — both layers must work.
- **Visited beacon:** fired via `navigator.sendBeacon` when available,
  otherwise `fetch(..., { keepalive: true })`. It must not block the render.
- **Local optimistic update:** on a 2xx, append to a local `checkedIn` set so
  the UI instantly renders the next stage as primary. Re-sync from the server
  on mount or when the user navigates back.
- **Accessibility:** stage list is an `<ol>`; the primary next stage is marked
  with `aria-current="step"`.

---

## Scope

### 1. API client extensions

`apps/web/src/lib/tasks-api.ts`:

```ts
checkInStage(token, taskId, stageId): Promise<{ taskProgress, stageProgress, created }>;
```

`apps/web/src/lib/topics-api.ts`:

```ts
visit(token, topicId): Promise<void>;
complete(token, topicId): Promise<{ topicProgress, changed }>;
```

### 2. Component — extend `apps/web/src/components/tasks/stage-list.tsx` (M4)

- Load `taskProgress` and `stageCheckIns` from `/me/progress/tasks` and from
  the task detail hydration (whichever is cheaper — measure in PR).
- Render each stage with a status:
  - `checked` (green chip with date)
  - `current` (primary button "Check in")
  - `locked` (muted; tooltip "Complete previous stages first")
- On click, call `checkInStage`; on success, update local state and trigger a
  dashboard-cache invalidation (simple event bus or a shared context).

### 3. Component — extend `apps/web/src/components/viewers/topic-view.tsx` (M3)

Props gain `{ progress, onComplete }`:

- Fire `topicsApi.visit(topicId)` once on mount (per session — use a small
  module-scoped `Set`).
- Render a "Mark as read" button if `progress?.status !== 'completed'`.
  Clicking calls `complete(topicId)` and flips the UI.

### 4. Tests

- `apps/web/__tests__/components/stage-list.test.tsx`
  - Renders the next-expected stage as primary.
  - Clicking it calls the API and advances local state.
  - 409 error surfaces the expected-stage toast; UI reverts.
  - Double-click fires exactly one API call.
- `apps/web/__tests__/components/topic-view-progress.test.tsx`
  - `visit` is called once per mount (not twice under StrictMode).
  - "Mark as read" flips to `completed` + the button disappears.
  - XSS still guarded (regression check against M3 Task 10).

---

## Acceptance Criteria

- [ ] Student can advance through a 3-stage task via the UI.
- [ ] Out-of-order click surfaces a useful toast and does not mutate state.
- [ ] Topic visit beacon fires once per mount; mark-as-read works.
- [ ] All tests in §4 pass.
- [ ] `make lint` clean. `pnpm --filter web test` green.

---

## Verification Plan

1. `pnpm --filter web test` green.
2. Manual as seeded + enrolled student:
   - Open `/tasks/:id`, check in all stages in order → dashboard shows 100 %
     on the task.
   - Open `/catalog/:id`, hit "Mark as read" → dashboard shows the topic
     completed.
