# Task 02: Media Data Layer (Entity + Migration + Linking)

## Metadata
- **Status:** Pending
- **Complexity:** Low
- **Milestone:** 3 — Content & Media Core
- **Dependencies:** Task 01

---

## Summary

Persist `Media` rows linked to a `TopicNode`, tracking the three lifecycle states
(PENDING, READY, DELETED) so the platform can distinguish an issued-but-unused upload
URL from a completed attachment.

`Entities.Content.Media` already exists in shared types. This task extends it with
persistence fields (`storageKey`, `sizeBytes`, `originalName`, `uploadedBy`, `status`,
`createdAt`) and wires a repository.

---

## Technical Constraints

- **Ports/Adapters:** `IMediaRepository` in `packages/shared/ports/`. Business logic
  never imports storage or DB types.
- **Storage coupling:** the repository stores only a `storageKey` string — it never
  resolves URLs or talks to R2. URL resolution lives in the storage adapter (Task 03)
  and is stitched together by the controller (Task 05).
- **Orphan prevention:** a background cleanup can safely delete PENDING rows older than
  1 hour (scheduled cleanup is out of scope here; the column + filter are enough).

---

## Scope

### 1. Extend the shared entity

In `packages/shared/types/entities.ts`, extend `Entities.Content.Media`:

```ts
export enum MediaStatus {
  PENDING  = 'pending',
  READY    = 'ready',
  DELETED  = 'deleted',
}

export interface Media {
  id: string;
  topicNodeId: string;
  storageKey: string;
  type: string;           // MIME
  sizeBytes: number;
  originalName: string;
  uploadedBy: string;     // user id
  status: MediaStatus;
  createdAt: Date;
}
```

### 2. Port — `packages/shared/ports/i-media-repository.ts`

```ts
export interface CreateMediaInput {
  topicNodeId: string;
  storageKey: string;
  type: string;
  sizeBytes: number;
  originalName: string;
  uploadedBy: string;
}

export interface IMediaRepository {
  findById(id: string): Promise<Entities.Content.Media | null>;
  listByTopic(topicNodeId: string, includePending?: boolean): Promise<Entities.Content.Media[]>;
  create(input: CreateMediaInput): Promise<Entities.Content.Media>; // inserts with status=PENDING
  markReady(id: string): Promise<Entities.Content.Media>;
  softDelete(id: string): Promise<void>;                            // status → DELETED
  hardDelete(id: string): Promise<void>;                            // removes the row
}
```

### 3. Migration — `apps/api/migrations/0006_create_media.sql`

```sql
CREATE TABLE media (
  id             TEXT    NOT NULL PRIMARY KEY,
  topic_node_id  TEXT    NOT NULL REFERENCES topic_nodes(id) ON DELETE CASCADE,
  storage_key    TEXT    NOT NULL UNIQUE,
  type           TEXT    NOT NULL,
  size_bytes     INTEGER NOT NULL,
  original_name  TEXT    NOT NULL,
  uploaded_by    TEXT    NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status         TEXT    NOT NULL DEFAULT 'pending',
  created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_media_topic_status ON media(topic_node_id, status);
```

### 4. Adapter — `apps/api/src/adapters/db/d1-media-repository.ts`

Straightforward CRUD with a `listByTopic` that filters out `DELETED` (and conditionally
`PENDING`) rows.

---

## Acceptance Criteria

- [ ] `MediaStatus` enum + extended `Media` interface exported from shared types.
- [ ] `IMediaRepository` port exported from `@arenaquest/shared/ports`.
- [ ] Migration `0006_create_media.sql` exists; applies cleanly twice.
- [ ] `D1MediaRepository` implements every method.
- [ ] Unit tests cover:
  - `create` inserts with `status = 'pending'`.
  - `markReady` transitions PENDING → READY.
  - `listByTopic(..., false)` excludes PENDING and DELETED.
  - `softDelete` keeps the row but hides it from `listByTopic`.
  - `hardDelete` removes the row.
- [ ] `make lint` clean; all tests pass.

---

## Verification Plan

1. `pnpm --filter api test` — green.
2. Apply migration locally, then:
   ```bash
   wrangler d1 execute arenaquest-db --local \
     --command "INSERT INTO media ... VALUES (...)"
   ```
3. Verify via `SELECT` that the status column defaults to `'pending'`.
