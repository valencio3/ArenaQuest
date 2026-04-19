# Task 03: Admin Tasks CRUD API

## Metadata
- **Status:** Pending
- **Complexity:** Medium
- **Milestone:** 4 — Task Engine & Interconnection
- **Dependencies:** Task 01

---

## Summary

Expose HTTP endpoints for authoring tasks under `/admin/tasks`. Covers list, create,
read-one, update, and archive. Topic linking and stage endpoints are separate tasks
(05 and 04 respectively) — this task is intentionally narrow.

---

## Technical Constraints

- **Guards:** every route is protected by `authGuard + requireRole('admin',
  'content_creator')`. The guard composition pattern is already established in
  `apps/api/src/routes/admin-*.router.ts` — reuse it.
- **Validation:** Zod schemas in `apps/api/src/routes/admin-tasks.schemas.ts`.
  Title max 200 chars; description max 20,000 chars (post-sanitize).
- **Sanitization:** description runs through `sanitizeMarkdownSource` before
  persistence (M3 helper). If the sanitized output differs from input, the response
  includes `descriptionSanitized: true` so the UI can warn the author.
- **Status transitions** enforced server-side:
  - `draft → published`: requires at least one stage (query count) and that every
    linked topic has `status = 'published'` (loaded via the topic repo). Otherwise
    `409 TASK_NOT_PUBLISHABLE` with a machine-readable `reasons: string[]`.
  - `published → archived`: always allowed.
  - `archived → draft`: allowed.
  - `archived → published`: forbidden (`409 INVALID_TRANSITION`).
- **Archive is soft:** `DELETE /admin/tasks/:id` sets `status = 'archived'`; the row
  is not removed.

---

## Scope

### 1. Service — `apps/api/src/core/engagement/task-service.ts`

```ts
class TaskService {
  constructor(
    private tasks: ITaskRepository,
    private stages: ITaskStageRepository,
    private linking: ITaskLinkingRepository,
    private topics: ITopicNodeRepository,
  ) {}

  list(filter): Promise<TaskRecord[]>;
  get(id): Promise<TaskDetail>;              // task + stages + hydrated link sets
  create(userId, input): Promise<TaskRecord>;
  update(id, patch): Promise<TaskRecord>;    // enforces transitions
  archive(id): Promise<void>;
}
```

### 2. Router — `apps/api/src/routes/admin-tasks.router.ts`

```ts
router.get('/admin/tasks',       listHandler);
router.post('/admin/tasks',      createHandler);
router.get('/admin/tasks/:id',   readHandler);
router.patch('/admin/tasks/:id', updateHandler);
router.delete('/admin/tasks/:id',archiveHandler);
```

Register inside `AppRouter` alongside existing admin routers.

### 3. DI

Add `ITaskRepository`, `ITaskStageRepository`, `ITaskLinkingRepository`,
`ITopicNodeRepository` wiring to the per-request composition in `index.ts` (existing
pattern).

### 4. Tests — `apps/api/test/routes/admin-tasks.spec.ts`

- `POST /admin/tasks` with malformed body → 400 with Zod error shape.
- `POST /admin/tasks` with valid body → 201 + persisted record.
- `GET /admin/tasks?status=draft` → filtered list.
- `PATCH /admin/tasks/:id` with `{status: 'published'}` when the task has no stages →
  409 `TASK_NOT_PUBLISHABLE`, reasons include `'NO_STAGES'`.
- Same PATCH when the task has stages but a linked topic is `draft` → 409 with
  reason `'LINKED_TOPIC_NOT_PUBLISHED'`.
- Same PATCH when all guards pass → 200, row updated.
- `DELETE /admin/tasks/:id` → 204 + row status becomes `archived`.
- Non-admin role (tutor) → 403 on every route.
- Unauthenticated → 401.

---

## Acceptance Criteria

- [ ] All routes in §2 are reachable and behave per the Functional Requirements.
- [ ] Vitest suite in §4 passes.
- [ ] Description sanitization is visible in a test: submitting `<script>` returns
      200 and the stored description contains no `<script>`.
- [ ] `make lint` clean. `make test-api` green.
- [ ] OpenAPI / shared types (if present) updated with the new response shapes.

---

## Verification Plan

1. `pnpm --filter api test` green.
2. Hit routes via the running worker using `scripts/` curl helpers (create one if
   missing — mirror `scripts/seed-dev-users.sh`).
3. Confirm `grep -R "topic_nodes" apps/api/src/core` only references the port, not
   SQL.
