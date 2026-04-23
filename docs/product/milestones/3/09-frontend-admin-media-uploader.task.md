# Task 09: Frontend — Admin Media Uploader (Presigned Flow + Progress)

## Metadata
- **Status:** Pending
- **Complexity:** Medium
- **Milestone:** 3 — Content & Media Core
- **Dependencies:** Task 05, Task 08

---

## Summary

Add a media section to the admin topic detail pane. Drag-drop files, upload directly to
R2 via presigned URLs, show live progress per file, then list the resulting READY media
alongside each topic.

---

## Technical Constraints

- **Direct-to-storage:** the upload request goes to the presigned URL, NEVER through
  the Worker. Verified in a test by asserting the `fetch` URL target.
- **Progress:** use `XMLHttpRequest` with `upload.onprogress` to drive a progress bar.
  (`fetch` does not expose upload progress in browsers yet.)
- **Concurrency cap:** at most **3 concurrent uploads** per topic to keep the UI
  responsive.
- **Client-side size check:** file size is validated before asking for a presigned URL
  (spare a round-trip).
- **Cancellation:** each in-flight upload has a cancel button. Cancel aborts the XHR
  and calls `DELETE /admin/topics/:id/media/:mediaId` so the PENDING row is cleaned up.

---

## Scope

### 1. API client — `apps/web/src/lib/admin-media-api.ts`

```ts
export const adminMediaApi = {
  presign(token, topicId, input: { filename, type, sizeBytes }): Promise<{ mediaId, uploadUrl, storageKey, expiresIn }>;
  finalize(token, topicId, mediaId): Promise<MediaRecord>;
  delete(token, topicId, mediaId): Promise<void>;
};
```

### 2. Upload helper — `apps/web/src/lib/upload.ts`

```ts
export function uploadWithProgress(
  url: string,
  file: File,
  onProgress: (pct: number) => void,
  signal?: AbortSignal,
): Promise<void>;
```

Wraps `XMLHttpRequest`, resolves on `2xx`, rejects on `abort` / non-2xx.

### 3. Uploader component — `apps/web/src/components/topics/media-uploader.tsx`

Props: `{ topicId, accessToken, onUploaded }`.

Features:
- Drop zone + hidden file input.
- Queue list with per-file status (`queued` / `uploading` / `finalizing` / `done` /
  `failed` / `cancelled`) and a progress bar.
- Up to 3 concurrent uploads; the rest wait in `queued`.
- On `done`, append to the media list via `onUploaded(media)`.

### 4. Media list — `apps/web/src/components/topics/media-list.tsx`

Displays each READY media row with:
- Type-specific icon (PDF / video / image).
- Original filename.
- Size (human-readable).
- `Delete` button → confirm dialog → `adminMediaApi.delete` → remove from list.

### 5. Integration into the topic detail pane

Inside the detail pane from Task 08, mount:
```tsx
<MediaUploader topicId={selected.id} accessToken={token} onUploaded={appendMedia} />
<MediaList items={selected.media} onDelete={handleDelete} />
```

### 6. Component tests

Mock `fetch` and `XMLHttpRequest`:
- Drop a 1 MB PDF → presign called once → upload called with the presigned URL →
  finalize called → `onUploaded` fires.
- Drop a 200 MB MP4 → rejected client-side with a "too large" message; presign is
  NEVER called.
- Cancel an in-flight upload → XHR aborted + `DELETE` called.
- 3-concurrent cap: drop 5 files simultaneously → exactly 3 have status `uploading`,
  the rest `queued`.

---

## Acceptance Criteria

- [ ] Drop a PDF or MP4 → upload bypasses the Worker (target URL is R2, not the API).
- [ ] Progress bar updates in real time.
- [ ] Per-type size limits enforced client-side; oversized files never get a presigned
      URL.
- [ ] Failed upload shows an error row; the topic detail pane is not blocked.
- [ ] Cancel removes the row locally and cleans up the PENDING DB row.
- [ ] Deleting a READY media row removes it from the list; no orphaned storage object.
- [ ] Component tests in §6 pass.
- [ ] `make lint` clean; `pnpm --filter web test` green.

---

## Verification Plan

1. `pnpm --filter web test` — green.
2. Manual (dev env with a real local R2 binding):
   - Upload a 5 MB PDF and a 50 MB MP4 to a topic — both land as READY.
   - Reload — both still listed.
   - Delete one — bucket listing shows the object gone.
3. DevTools Network tab: confirm the large upload request target starts with the R2
   presigned URL, not the Worker domain.
