# Task 09: Frontend — Student Task View

## Metadata
- **Status:** Pending
- **Complexity:** Medium
- **Milestone:** 4 — Task Engine & Interconnection
- **Dependencies:** Task 06

---

## Summary

Two read-only surfaces for any signed-in user:

- `/tasks` — card list of published tasks.
- `/tasks/:id` — detail page showing description, stages, and per-stage topic
  chips that deep-link into `/catalog/:topicId`.

No mutation controls — check-in and progress are Milestone 5.

---

## Technical Constraints

- **Markdown rendering:** description goes through `renderSafeMarkdownToHtml` from
  the M3 shared helper. Defence-in-depth: server already sanitized on write.
- **Deep links:** topic chips render as `<Link href={'/catalog/' + topicId}>`.
  The catalog page already exists from M3 Task 10.
- **Accessibility:** stage list uses an `<ol>` with semantic `<li>` children;
  topic chips are `<a>` elements inside the `<li>` so screen readers enumerate
  "Stage 2: Practice, topics: X, Y".
- **Empty state:** when `/tasks` returns `[]`, render a friendly "No tasks yet"
  illustration with a hint to check back later — do not suggest creating one
  (students can't).

---

## Scope

### 1. API client — `apps/web/src/lib/tasks-api.ts`

```ts
export const tasksApi = {
  list(token): Promise<PublishedTaskSummary[]>;
  get(token, id): Promise<PublishedTaskDetail>;
};
```

### 2. Pages

- `apps/web/src/app/(protected)/tasks/page.tsx` — list.
- `apps/web/src/app/(protected)/tasks/[id]/page.tsx` — detail.

### 3. Components

- `apps/web/src/components/tasks/task-card.tsx` — title, stage count, topic count,
  "Open" CTA.
- `apps/web/src/components/tasks/stage-list.tsx` — ordered list of stages with
  topic chips.

### 4. Navigation

Add "Tasks" entry to the protected-area sidebar (the component extended in M2
Task 09 / M3 Task 08 — confirm the exact module). Visible to all signed-in roles.

### 5. Tests — `apps/web/__tests__/app/tasks.test.tsx`

- List: renders N cards from mock data; clicking a card navigates to `/tasks/:id`.
- Detail: renders description, stages in order, topic chips per stage.
- XSS: detail page with a description containing `<script>window.__xss=true</script>`
  renders the rest of the content; `window.__xss` is undefined.
- Empty state: `list` returns `[]` → empty-state copy visible.
- Topic chip → href is `/catalog/:topicId`.

---

## Acceptance Criteria

- [ ] `/tasks` and `/tasks/:id` reachable by any signed-in user.
- [ ] Draft/archived tasks are absent (enforced by the server; verify with a
      fixture that seeds one draft and one published — only published appears).
- [ ] Markdown renders safely; XSS test passes.
- [ ] Clicking a topic chip lands on `/catalog/:topicId`.
- [ ] Component tests in §5 pass.
- [ ] `make lint` clean. `pnpm --filter web test` green.

---

## Verification Plan

1. `pnpm --filter web test` green.
2. Manual: seed a task via the admin UI, log in as a student, open `/tasks`, open
   the task, click a topic chip → `/catalog/:topicId` renders the topic.
