# Task 06: Public Topics Read API (Published-Only Catalogue)

## Metadata
- **Status:** Pending
- **Complexity:** Low
- **Milestone:** 3 — Content & Media Core
- **Dependencies:** Task 04, Task 05

---

## Summary

Expose the student-facing read API. It returns only `published` topics and only READY
media. Draft / archived content and PENDING / DELETED media are strictly invisible here.

---

## Technical Constraints

- **Separate router:** lives in `apps/api/src/routes/topics.router.ts` (not `admin-*`).
  This keeps the RBAC surface obvious — `/topics` is authed for any signed-in user,
  `/admin/topics` is curator-only.
- **Presigned download URLs:** for each READY media row, the handler generates a
  short-lived (`expiresInSeconds: 900`) download URL. URLs are NOT cached to preserve
  expiry semantics.
- **Payload shape:** identical to `GET /admin/topics/:id` plus the `downloadUrl` field
  on each media item, MINUS any draft/archived children.

---

## Scope

### 1. Router

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/topics`            | Flat array of published nodes sorted by `(parent_id NULLS FIRST, sort_order)`. |
| `GET` | `/topics/:id`        | Single node + published children + READY media (each with `downloadUrl`). |

Both protected by `authGuard` only.

### 2. Query helper in the repository

Add `listPublished()` to `ITopicNodeRepository` — `listAll({ status: 'published' })`
already exists from Task 01; use it.

For `GET /topics/:id`, call:
- `findById` → 404 if not found or if `status !== 'published'`.
- `listChildren(id)` → filter to `status === 'published'`.
- `media.listByTopic(id, includePending = false)` → attach `downloadUrl` via
  `storage.getPresignedDownloadUrl(m.storageKey)`.

### 3. Caching header

Set `Cache-Control: private, max-age=30` on both endpoints. The 30-second TTL balances
freshness with the repeat-read pattern of a student browsing the tree.

### 4. Integration tests

- Both endpoints return 401 without a token.
- A student token CAN access both endpoints (any active user can read the catalogue).
- A node in `draft` → `GET /topics/:id` returns 404.
- A node in `archived` → 404.
- A PENDING media row is absent from the response.
- A DELETED media row is absent from the response.
- `downloadUrl` points to the expected storage key (string-match on the prefix).

---

## Acceptance Criteria

- [ ] `GET /topics` and `GET /topics/:id` exist, authGuard-protected.
- [ ] Draft/archived nodes invisible; PENDING/DELETED media invisible.
- [ ] Each READY media row carries a `downloadUrl` generated via the storage adapter.
- [ ] `Cache-Control: private, max-age=30` is set.
- [ ] Integration tests cover every case.
- [ ] `make lint` clean; all tests pass.

---

## Verification Plan

1. `pnpm --filter api test` — green.
2. Manual `wrangler dev`:
   - Create a draft topic via admin; `GET /topics/<id>` → 404.
   - Publish it; the next `GET /topics/<id>` → 200.
   - Add a PENDING media row by calling `/presign` without finalizing; verify the
     student response does not include it.
