# Task 01: Topics & Tags Data Layer (Port + D1 Adapter + Migration)

## Metadata
- **Status:** Pending
- **Complexity:** Medium
- **Milestone:** 3 — Content & Media Core
- **Dependencies:** none (foundational)

---

## Summary

Define the `ITopicNodeRepository` and `ITagRepository` ports in `packages/shared/ports`
and their D1 adapters in `apps/api/src/adapters/db/`. This is the persistent foundation
of the topic tree that every other Milestone 3 task depends on.

The `Entities.Content.TopicNode` and `Entities.Content.Tag` types already exist in
`packages/shared/types/entities.ts` — the task wires them to a real DB without leaking
D1 specifics into business logic.

---

## Technical Constraints

- **Ports/Adapters:** interfaces in `packages/shared/ports/`. No `@cloudflare/workers-types`
  imports allowed there.
- **Cloud-Agnostic:** only `d1-topic-node-repository.ts` and `d1-tag-repository.ts`
  import D1 types.
- **Tree integrity:** `parentId` is a nullable FK to `topic_nodes.id` with
  `ON DELETE RESTRICT` — a node cannot be hard-deleted while children exist.
- **Cycle protection:** repository method `canMoveTo(id, newParentId)` exists and is
  used by the router in Task 04; implementation walks parents upward.

---

## Scope

### 1. Port — `packages/shared/ports/i-topic-node-repository.ts`

```ts
export interface TopicNodeRecord extends Entities.Content.TopicNode {
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTopicNodeInput {
  parentId: string | null;
  title: string;
  content?: string;
  estimatedMinutes?: number;
  tagIds?: string[];
  prerequisiteIds?: string[];
}

export interface UpdateTopicNodeInput {
  title?: string;
  content?: string;
  status?: Entities.Config.TopicNodeStatus;
  estimatedMinutes?: number;
  tagIds?: string[];
  prerequisiteIds?: string[];
}

export interface ITopicNodeRepository {
  findById(id: string): Promise<TopicNodeRecord | null>;
  listChildren(parentId: string | null): Promise<TopicNodeRecord[]>;
  listAll(opts?: { status?: Entities.Config.TopicNodeStatus }): Promise<TopicNodeRecord[]>;
  create(input: CreateTopicNodeInput): Promise<TopicNodeRecord>;
  update(id: string, input: UpdateTopicNodeInput): Promise<TopicNodeRecord>;
  move(id: string, newParentId: string | null, newOrder: number): Promise<TopicNodeRecord>;
  archive(id: string): Promise<void>; // soft-delete, cascades
  canMoveTo(id: string, newParentId: string | null): Promise<boolean>;
}
```

### 2. Port — `packages/shared/ports/i-tag-repository.ts`

```ts
export interface ITagRepository {
  findBySlug(slug: string): Promise<Entities.Content.Tag | null>;
  list(): Promise<Entities.Content.Tag[]>;
  upsertMany(names: string[]): Promise<Entities.Content.Tag[]>;
}
```

### 3. D1 migration — `apps/api/migrations/0005_create_topics.sql`

```sql
CREATE TABLE topic_nodes (
  id                 TEXT    NOT NULL PRIMARY KEY,
  parent_id          TEXT    REFERENCES topic_nodes(id) ON DELETE RESTRICT,
  title              TEXT    NOT NULL,
  content            TEXT    NOT NULL DEFAULT '',
  status             TEXT    NOT NULL DEFAULT 'draft',
  sort_order         INTEGER NOT NULL DEFAULT 0,
  estimated_minutes  INTEGER NOT NULL DEFAULT 0,
  created_at         TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_topic_nodes_parent ON topic_nodes(parent_id, sort_order);

CREATE TABLE tags (
  id   TEXT NOT NULL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE
);

CREATE TABLE topic_node_tags (
  topic_node_id TEXT NOT NULL REFERENCES topic_nodes(id) ON DELETE CASCADE,
  tag_id        TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (topic_node_id, tag_id)
);

CREATE TABLE topic_node_prerequisites (
  topic_node_id TEXT NOT NULL REFERENCES topic_nodes(id) ON DELETE CASCADE,
  prereq_id     TEXT NOT NULL REFERENCES topic_nodes(id) ON DELETE CASCADE,
  PRIMARY KEY (topic_node_id, prereq_id),
  CHECK (topic_node_id != prereq_id)
);
```

### 4. Adapters

- `apps/api/src/adapters/db/d1-topic-node-repository.ts`
- `apps/api/src/adapters/db/d1-tag-repository.ts`

Both follow the shape of the existing `D1UserRepository`.

`move` runs inside a single logical transaction:
1. Validate `canMoveTo`.
2. Update `parent_id` + `sort_order`.
3. If the list of siblings becomes fragmented, re-number them in a single `UPDATE`
   using a `ROW_NUMBER()` window function.

### 5. Wire into `AppEnv`

Instantiate the two repositories in `buildApp()` in `apps/api/src/index.ts` and pass
them into `AppRouter.register` — even though the routes land in Tasks 04/05/06, the
wiring is trivial and goes here to keep commits small.

---

## Acceptance Criteria

- [ ] `ITopicNodeRepository` and `ITagRepository` exported from `@arenaquest/shared/ports`.
- [ ] Migration `0005_create_topics.sql` exists and is idempotent via `IF NOT EXISTS`.
- [ ] `D1TopicNodeRepository` and `D1TagRepository` implement every method.
- [ ] `canMoveTo(id, newParentId)`:
  - returns `false` when `newParentId === id`.
  - returns `false` when `newParentId` is a descendant of `id`.
  - returns `true` otherwise.
- [ ] Unit tests in `apps/api/test/db/d1-topic-node-repository.spec.ts` cover:
  - create root + child round-trip.
  - `listChildren(null)` returns only roots.
  - `move` re-numbers siblings.
  - `canMoveTo` rejects cycles.
  - `archive` cascades to descendants.
- [ ] All existing tests remain green; `make lint` clean.

---

## Verification Plan

1. `pnpm --filter api test` — green.
2. `wrangler d1 execute arenaquest-db --local --file ./migrations/0005_create_topics.sql`
   — applies cleanly; running twice is a no-op.
3. `grep -R "@cloudflare/workers-types" packages/shared` — zero matches.
