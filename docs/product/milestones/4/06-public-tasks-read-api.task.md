# Task 06: Public Tasks Read API

## Metadata
- **Status:** Pending
- **Complexity:** Low
- **Milestone:** 4 — Task Engine & Interconnection
- **Dependencies:** Task 03, Task 04, Task 05

---

## Summary

Read-only, student-visible endpoints under `/tasks`. Returns only `published` tasks;
every linked topic in the response is also `published`. No write paths here.

---

## Technical Constraints

- **Guard:** `authGuard` only — any signed-in user can read.
- **Hydration:** each task response includes its stages (ordered) and each stage's
  linked topics as `{ id, title }` tuples (not full nodes — the frontend deep-links
  into `/catalog/:id` when the user clicks).
- **Filtering:** tasks with any stage linking to an unpublished topic still appear
  (the stage simply omits that topic from the hydrated list). This matches the
  "links survive but surface as warnings on the admin side" invariant.
- **Pagination:** cursor-less offset pagination (`?limit=`, `?offset=`) is fine for
  M4. Default limit: 50; max: 200.
- **Caching:** set `Cache-Control: private, max-age=30` on the list — tasks rarely
  change and this softens dashboard load. The detail route is uncached.

---

## Scope

### 1. Service — `apps/api/src/core/engagement/task-read-service.ts`

```ts
class TaskReadService {
  listPublished(query): Promise<PublishedTaskSummary[]>;
  getPublished(id): Promise<PublishedTaskDetail>;   // 404 if draft/archived
}
```

### 2. Router — `apps/api/src/routes/tasks.router.ts`

```ts
router.get('/tasks',       listHandler);
router.get('/tasks/:id',   detailHandler);
```

### 3. Response shapes (shared — add to `packages/shared/types/api.ts`)

```ts
interface PublishedTaskSummary {
  id: string;
  title: string;
  stageCount: number;
  topicCount: number;
  updatedAt: string;
}

interface PublishedTaskDetail {
  id: string;
  title: string;
  description: string;       // sanitized Markdown
  stages: Array<{
    id: string;
    label: string;
    order: number;
    topics: Array<{ id: string; title: string }>;
  }>;
  linkedTopics: Array<{ id: string; title: string }>;  // task-level set
  updatedAt: string;
}
```

### 4. Tests — `apps/api/test/routes/tasks-public.spec.ts`

- Anonymous → 401.
- Student with draft task visible → draft not returned.
- Published task with 2 stages and 3 linked topics → detail returns all hydrated,
  topics sorted by title.
- Archive task → 404 on detail.
- Stage links containing a now-archived topic → the archived topic is absent from
  `topics` array; log a `task.link.stale` info-level entry for observability.

---

## Acceptance Criteria

- [ ] `/tasks` and `/tasks/:id` implemented behind `authGuard`.
- [ ] Hydrated response matches the shapes above.
- [ ] Stale-link filtering is covered by a test.
- [ ] `make lint` clean. `make test-api` green.

---

## Verification Plan

1. `pnpm --filter api test` green.
2. Hit `/tasks` as a logged-in student via curl → JSON envelope matches the type.
3. `curl -i` confirms the `Cache-Control` header on list.
