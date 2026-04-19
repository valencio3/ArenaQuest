# Task 07: Frontend — Admin Tasks Dashboard (List + Editor Skeleton)

## Metadata
- **Status:** Pending
- **Complexity:** Medium
- **Milestone:** 4 — Task Engine & Interconnection
- **Dependencies:** Task 03 (and structurally Task 05, but the UI for linking can be
  stubbed and wired in Task 08)

---

## Summary

Two pages:

- `/admin/tasks` — list of all tasks (drafts + published + archived) with status
  chips and a "New task" button.
- `/admin/tasks/:id` — editor frame: title + Markdown description + topic picker +
  status toggle. Stage editing lives in Task 08 (mounted as a slot here).

---

## Technical Constraints

- **Role gate:** same `useHasAnyRole('admin', 'content_creator')` helper introduced
  for the topic dashboard in M3 Task 08. Students → redirect to `/dashboard`.
- **API client:** new `apps/web/src/lib/admin-tasks-api.ts` mirroring the shape of
  `admin-topics-api.ts`. All HTTP through this module.
- **Topic picker:** a reusable `<TopicPicker value onChange includeDrafts />`
  component that wraps the existing published-tree fetcher. When `includeDrafts` is
  true (task status = draft), it fetches from `/admin/topics` instead.
- **Status toggle guards:** on publish attempt, surface the 409 `reasons` from the
  API as inline errors (e.g. "Add at least one stage" / "Topic X is not
  published"). Do **not** block client-side — let the server be the source of
  truth, but mirror the most common cases in a tooltip.
- **Loading state:** show a Skeleton list (not a spinner) while loading; mirrors
  the style of the admin users dashboard.

---

## Scope

### 1. API client — `apps/web/src/lib/admin-tasks-api.ts`

```ts
export const adminTasksApi = {
  list(token, filter?): Promise<TaskSummary[]>;
  get(token, id): Promise<TaskDetail>;
  create(token, input): Promise<TaskSummary>;
  update(token, id, patch): Promise<TaskSummary>;
  archive(token, id): Promise<void>;
  setTopics(token, id, topicIds): Promise<string[]>;
};
```

### 2. Pages

- `apps/web/src/app/(protected)/admin/tasks/page.tsx` — list.
- `apps/web/src/app/(protected)/admin/tasks/new/page.tsx` — thin wrapper creating a
  draft and redirecting to `/admin/tasks/:id`.
- `apps/web/src/app/(protected)/admin/tasks/[id]/page.tsx` — editor.

### 3. Components

- `apps/web/src/components/tasks/task-list.tsx` — card rows with title, status
  chip, stage count, updatedAt. Click → `/admin/tasks/:id`. "Archive" action with
  confirm modal.
- `apps/web/src/components/tasks/task-editor.tsx` — title input, description
  textarea + preview (using `renderSafeMarkdownToHtml` from M3 Task 07), topic
  picker, status toggle, "Save" button. **Stages slot** is a placeholder
  `<StagesEditorPlaceholder />` for Task 08 to fill.
- `apps/web/src/components/tasks/topic-picker.tsx` — dialog with the published
  topic tree (read-only from `/topics` or `/admin/topics`), checkbox multi-select,
  search. Uses the existing `CatalogTree` visuals from M3 Task 10.

### 4. Tests — `apps/web/__tests__/app/admin/tasks.test.tsx`

- List page renders 3 mocked tasks with their statuses.
- "Archive" calls `adminTasksApi.archive` and removes the row.
- Editor: typing in title and blurring calls `update`.
- Publish toggle: server returns 409 with `reasons:['NO_STAGES']` → UI shows
  "Add at least one stage" error.
- Student role → redirected to `/dashboard`.

---

## Acceptance Criteria

- [ ] Both pages compile and lint clean.
- [ ] The list page loads under 300 ms against mocked data (React profiler).
- [ ] The editor persists title / description / status / task-level topic links.
- [ ] The stage editor placeholder is visibly marked "Stages editor — Task 08".
- [ ] Component tests in §4 pass.
- [ ] `make lint` clean. `pnpm --filter web test` green.

---

## Verification Plan

1. `pnpm --filter web test` green.
2. Manual (both apps running):
   - Log in as admin → `/admin/tasks` lists existing tasks.
   - Click "New task" → URL becomes `/admin/tasks/:id` with a blank draft.
   - Edit title, select 2 topics, save → reload → state preserved.
