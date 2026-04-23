# Task 02: Enrollment Data Layer

## Metadata
- **Status:** Pending
- **Complexity:** Medium-High
- **Milestone:** 5 — Engagement & Student Progress
- **Dependencies:** Milestone 3 Task 01 (topics)

---

## Summary

Add the two enrollment tables plus an `IEnrollmentRepository` port that exposes,
among grant / revoke primitives, the key method the rest of the milestone leans
on: `getEffectiveAccessTopicIds(userId)` — the union of a user's direct grants,
their groups' grants, and every descendant topic of any granted subtree.

---

## Technical Constraints

- **Recursive CTE:** D1 supports `WITH RECURSIVE`. The effective-access query
  uses one CTE to collect direct+group grants and a second recursive CTE to
  expand each grant into its subtree. This is a spike — verify at the start of
  the task that D1 actually runs the query at acceptable latency on a fixture
  of 1000 topics and 20 grants (target: < 50 ms local).
- **No materialised table in M5:** the plan document must justify this (cost of
  invalidation > cost of recompute at current scale). Revisit in M6 if
  dashboard p95 > 500 ms.
- **Cascade semantics for revoke:**
  - Default: delete the explicit grant row on the target topic only.
  - `cascade=true`: also delete any grant rows on descendants of that topic
    belonging to the same subject (user or group).
- **Idempotency:** granting the same `(user, topic)` twice is a no-op + 200.

---

## Scope

### 1. Migration — `apps/api/migrations/0010_enrollments.sql`

```sql
CREATE TABLE enrollments_user (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic_node_id TEXT NOT NULL REFERENCES topic_nodes(id) ON DELETE CASCADE,
  granted_at    TEXT NOT NULL,
  granted_by    TEXT NOT NULL REFERENCES users(id),
  UNIQUE (user_id, topic_node_id)
);
CREATE INDEX idx_enroll_user_user ON enrollments_user(user_id);

CREATE TABLE enrollments_user_group (
  id             TEXT PRIMARY KEY,
  user_group_id  TEXT NOT NULL REFERENCES user_groups(id) ON DELETE CASCADE,
  topic_node_id  TEXT NOT NULL REFERENCES topic_nodes(id) ON DELETE CASCADE,
  granted_at     TEXT NOT NULL,
  granted_by     TEXT NOT NULL REFERENCES users(id),
  UNIQUE (user_group_id, topic_node_id)
);
CREATE INDEX idx_enroll_group_group ON enrollments_user_group(user_group_id);
```

> **Note:** `user_groups` and the `user_group_members` join table are expected
> from earlier milestones. If they do not yet exist (verify before merging),
> add a minimal migration to create them — flag this to the reviewer as a
> scope slip from M2 that surfaces here.

### 2. Port — `packages/shared/ports/i-enrollment-repository.ts`

```ts
export interface IEnrollmentRepository {
  listUserGrants(userId): Promise<EnrollmentRecord[]>;
  listGroupGrants(groupId): Promise<EnrollmentRecord[]>;

  grantUser(userId, topicId, grantedBy): Promise<EnrollmentRecord>;
  revokeUser(userId, topicId, opts?: { cascade?: boolean }): Promise<void>;

  grantGroup(groupId, topicId, grantedBy): Promise<EnrollmentRecord>;
  revokeGroup(groupId, topicId, opts?: { cascade?: boolean }): Promise<void>;

  /** Effective access = direct grants ∪ group grants, expanded to descendants. */
  getEffectiveAccessTopicIds(userId): Promise<Set<string>>;
}
```

### 3. Adapter — `apps/api/src/adapters/db/d1-enrollment-repository.ts`

Sketch of the effective-access query:

```sql
WITH RECURSIVE
  roots AS (
    SELECT topic_node_id AS id FROM enrollments_user WHERE user_id = ?1
    UNION
    SELECT eug.topic_node_id
      FROM enrollments_user_group eug
      JOIN user_group_members ugm ON ugm.user_group_id = eug.user_group_id
     WHERE ugm.user_id = ?1
  ),
  subtree (id) AS (
    SELECT id FROM roots
    UNION
    SELECT tn.id
      FROM topic_nodes tn
      JOIN subtree s ON tn.parent_id = s.id
  )
SELECT id FROM subtree;
```

The adapter returns a `Set<string>` to make downstream membership checks O(1).

### 4. Tests — `apps/api/test/adapters/d1-enrollment-repository.spec.ts`

- Grant root → effective set contains root + all descendants.
- Grant only a leaf → effective set contains exactly the leaf.
- Group grant + user membership → effective set contains the group's subtree.
- Revoke without cascade → descendants that had their own explicit grants
  remain.
- Revoke with cascade → any descendant explicit grant belonging to the same
  subject is also removed.
- 1000-topic fixture → `getEffectiveAccessTopicIds` runs in under 50 ms (perf
  assertion using `performance.now()` with a 5× margin).

---

## Acceptance Criteria

- [ ] Migration applies cleanly.
- [ ] `IEnrollmentRepository` exported from `packages/shared/index.ts`.
- [ ] All test cases in §4 pass.
- [ ] Recursive CTE performance spike documented in the task PR description.
- [ ] `make lint` clean. `make test-api` green.

---

## Verification Plan

1. Apply migration; inspect schema.
2. `pnpm --filter api test` green.
3. Seed 1000 topics via a scratch script; run the adapter perf test locally.
