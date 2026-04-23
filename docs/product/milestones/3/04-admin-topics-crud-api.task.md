# Task 04: Admin Topics CRUD + Move API

## Metadata
- **Status:** Pending
- **Complexity:** Medium
- **Milestone:** 3 — Content & Media Core
- **Dependencies:** Task 01, Task 07 (Markdown sanitization helper, for the write path)

---

## Summary

Expose the authoring endpoints for `topic_nodes` under `/admin/topics`. Admins and
content creators can build the tree, re-parent / reorder nodes safely, and move nodes
through the lifecycle (`draft` → `published` → `archived`).

---

## Technical Constraints

- **RBAC:** the router is guarded by `authGuard + requireRole(ADMIN, CONTENT_CREATOR)`.
  `requireRole` already supports multiple roles via `...roles: RoleName[]`.
- **No Business Logic in Handlers:** handlers call `ITopicNodeRepository` and
  `ITagRepository` directly; non-trivial logic (cycle check, cascade) already lives in
  the repository.
- **Input validation:** Zod.
- **Sanitization:** `content` is run through the shared Markdown sanitizer (Task 07)
  before persistence — stored value is "safe source" Markdown (no inline `<script>`).

---

## Scope

### 1. Router — `apps/api/src/routes/admin-topics.router.ts`

Endpoints:

| Method | Path | Body |
|--------|------|------|
| `GET`    | `/admin/topics`            | — |
| `POST`   | `/admin/topics`            | `{ parentId?, title, content?, tags?, prerequisiteIds?, estimatedMinutes? }` |
| `GET`    | `/admin/topics/:id`        | — |
| `PATCH`  | `/admin/topics/:id`        | subset of create fields + `status` |
| `POST`   | `/admin/topics/:id/move`   | `{ newParentId: string \| null, newOrder: number }` |
| `DELETE` | `/admin/topics/:id`        | — (archive, cascades) |

### 2. Zod schemas

```ts
const CreateTopicSchema = z.object({
  parentId: z.string().uuid().nullable().default(null),
  title: z.string().min(1).max(200),
  content: z.string().max(50_000).default(''),
  estimatedMinutes: z.number().int().nonnegative().default(0),
  tags: z.array(z.string().min(1)).max(20).default([]),
  prerequisiteIds: z.array(z.string().uuid()).max(20).default([]),
});

const MoveTopicSchema = z.object({
  newParentId: z.string().uuid().nullable(),
  newOrder: z.number().int().nonnegative(),
});
```

### 3. Error contract

| Condition | Status | Body |
|-----------|--------|------|
| Input fails Zod | `400` | `{ error: 'BadRequest', details }` |
| Topic not found | `404` | `{ error: 'NotFound' }` |
| Cycle in `move` | `409` | `{ error: 'Conflict', code: 'WOULD_CYCLE' }` |
| Prerequisite id is unknown | `422` | `{ error: 'Unprocessable', code: 'UNKNOWN_PREREQ' }` |

### 4. Response shape

`GET /admin/topics` returns a flat array sorted by `(parent_id NULLS FIRST, sort_order)`
— the frontend assembles the tree. This is cheaper than server-side recursion for the
volumes we expect and keeps the handler trivial.

### 5. Wire

Register the router inside `AppRouter.register`. Inject the two new repositories.

### 6. Integration tests — `apps/api/test/routes/admin-topics.router.spec.ts`

Cover:
- 401 for every endpoint without a token.
- 403 for a non-admin/non-content-creator token.
- Full CRUD round-trip.
- Move into self → `409 WOULD_CYCLE`.
- Move into own descendant → `409 WOULD_CYCLE`.
- Archive cascades: archiving a parent flips all descendants to `archived`.
- Publishing a node whose parent is `draft` is allowed (leaf-first publishing is the
  curator's choice; we do not enforce the cascade direction).

---

## Acceptance Criteria

- [ ] All six endpoints exist and are guarded by `authGuard + requireRole(ADMIN, CONTENT_CREATOR)`.
- [ ] Creating a node with a non-existent `parentId` returns `404`.
- [ ] Creating a node with an unknown prerequisite id returns `422 UNKNOWN_PREREQ`.
- [ ] Moving a node to its own descendant returns `409 WOULD_CYCLE`.
- [ ] Archiving a parent archives all descendants.
- [ ] `PATCH { status: 'published' }` flips the row and `GET` reflects it immediately.
- [ ] Integration tests cover every case above.
- [ ] `make lint` clean; all tests pass.

---

## Verification Plan

1. `pnpm --filter api test` — green.
2. Manual with `wrangler dev` + `curl`:
   - Create root topic "Futebol".
   - Create child "Fundamentos" under it.
   - Create grandchild "Passe".
   - `POST /admin/topics/<futebol>/move { newParentId: <passe> }` → `409`.
   - Publish leaf, verify `GET /admin/topics` reflects the status.
