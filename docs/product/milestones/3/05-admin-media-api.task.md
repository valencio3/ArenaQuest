# Task 05: Admin Media API (Presigned Upload + Finalize + Delete)

## Metadata
- **Status:** Pending
- **Complexity:** Medium
- **Milestone:** 3 — Content & Media Core
- **Dependencies:** Task 02, Task 03

---

## Summary

Expose the media-lifecycle endpoints so the admin UI can upload attachments directly to
R2 using presigned URLs. The Worker never handles the file bytes — it issues a URL,
records a PENDING row, and flips it to READY after the client confirms.

---

## Technical Constraints

- **Presigned-URL flow only:** the Worker refuses to stream bodies to R2 for media
  uploads. This protects the 100 MB Worker request limit and keeps CPU time bounded.
- **Per-type size limits:** enforced at presign time via `Content-Length`.
  - `application/pdf` → 25 MB
  - `video/mp4` → 100 MB
  - `image/*` → 5 MB
- **Storage key layout:** `topics/{topicId}/{mediaId}-{sanitizedName}` — one prefix per
  topic enables `listObjects` for auditing and bulk delete.
- **RBAC:** guarded by `authGuard + requireRole(ADMIN, CONTENT_CREATOR)`.
- **Finalize is idempotent:** calling finalize twice is a no-op for a READY row and
  400 for a DELETED row.

---

## Scope

### 1. Router — `apps/api/src/routes/admin-media.router.ts`

Mounted under `/admin/topics/:id/media`:

| Method | Path | Body |
|--------|------|------|
| `POST`   | `/presign`            | `{ filename, type, sizeBytes }` |
| `POST`   | `/:mediaId/finalize`  | — |
| `DELETE` | `/:mediaId`           | — |

### 2. Presign handler flow

```ts
1. Validate `type` is in the allow-list.
2. Validate `sizeBytes` against the per-type limit.
3. Generate `mediaId = crypto.randomUUID()` and compute `storageKey`.
4. `media.create({ topicNodeId, storageKey, type, sizeBytes, originalName: filename,
                  uploadedBy: user.sub })`  → inserts with `status = 'pending'`.
5. `storage.getPresignedUploadUrl(storageKey, { contentType: type, maxSizeBytes,
                                                 expiresInSeconds: 600 })`.
6. Return `{ mediaId, uploadUrl, storageKey, expiresIn: 600 }`.
```

### 3. Finalize handler flow

```ts
1. Load the media row; 404 if missing or its `topicNodeId` does not match `:id`.
2. Call `storage.headObject(storageKey)`; if it returns null, 409 `NOT_UPLOADED`.
3. Optionally verify `size` from `headObject` matches the declared `sizeBytes`;
   reject with 409 `SIZE_MISMATCH` if off by > 1 % (tolerance for provider rounding).
4. `media.markReady(mediaId)`.
5. Return the updated row.
```

### 4. Delete handler flow

```ts
1. Load the media row; 404 if missing.
2. `media.softDelete(mediaId)` — DB first, so a storage failure cannot orphan the row.
3. `storage.deleteObject(storageKey)` — log and continue on error; a sweeper job can
   reconcile later.
4. Return 204.
```

### 5. Integration tests

- Presign with an invalid MIME → 400.
- Presign with PDF > 25 MB → 400 `TOO_LARGE`.
- Finalize before upload → 409 `NOT_UPLOADED`. Use a mock storage adapter whose
  `headObject` returns `null`.
- Finalize after upload → 200, row is READY.
- Finalize again → 200, row stays READY (idempotent).
- Delete → 204, `listByTopic(..., false)` no longer returns the row.

---

## Acceptance Criteria

- [ ] All three endpoints work and are RBAC-guarded.
- [ ] Presign rejects unsupported MIME and oversized declarations.
- [ ] Finalize verifies the object exists in storage before flipping to READY.
- [ ] Delete removes the storage object; failure to delete from storage does not leave
      the DB in an inconsistent state.
- [ ] Integration tests in `admin-media.router.spec.ts` pass every case above using an
      in-memory fake storage adapter (no real R2).
- [ ] `make lint` clean; all tests pass.

---

## Verification Plan

1. `pnpm --filter api test` — green.
2. Manual `wrangler dev` + `curl` (local R2 bucket):
   - `POST /admin/topics/<t>/media/presign { filename: "lesson.pdf", type: "application/pdf", sizeBytes: 123456 }` → returns URL.
   - `curl -X PUT <uploadUrl> --data-binary @lesson.pdf -H 'Content-Type: application/pdf'` → 200.
   - `POST /admin/topics/<t>/media/<m>/finalize` → 200, status READY.
   - `DELETE /admin/topics/<t>/media/<m>` → 204, bucket listing shows the object gone.
