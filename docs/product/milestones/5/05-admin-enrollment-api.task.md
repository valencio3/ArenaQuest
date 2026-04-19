# Task 05: Admin Enrollment API

## Metadata
- **Status:** Pending
- **Complexity:** Medium
- **Milestone:** 5 — Engagement & Student Progress
- **Dependencies:** Task 02

---

## Summary

Admin-only endpoints to grant and revoke topic access for individual users and
for user groups.

---

## Technical Constraints

- **Guards:** `authGuard + requireRole('admin', 'content_creator')`.
- **Idempotent grants:** granting the same `(user, topic)` twice returns 200
  with the existing row; only the first call returns 201.
- **Cascade flag on revoke:** `DELETE ...?cascade=true` removes grants on
  descendants belonging to the same subject.
- **Audit breadcrumbs:** every grant and revoke emits a structured log line
  (`enrollment.grant` / `enrollment.revoke`) with `actorId`, `subjectId`,
  `topicId`, `cascade?`. Lightweight — no new audit table in M5.

---

## Scope

### 1. Service — `apps/api/src/core/enrollment/enrollment-service.ts`

```ts
class EnrollmentService {
  constructor(private enrollments: IEnrollmentRepository) {}

  listUserGrants(userId): Promise<EnrollmentRecord[]>;
  grantUser(actorId, userId, topicId): Promise<{ record; created }>;
  revokeUser(userId, topicId, opts?): Promise<void>;

  listGroupGrants(groupId): Promise<EnrollmentRecord[]>;
  grantGroup(actorId, groupId, topicId): Promise<{ record; created }>;
  revokeGroup(groupId, topicId, opts?): Promise<void>;
}
```

### 2. Router — `apps/api/src/routes/admin-enrollment.router.ts`

```ts
router.get   ('/admin/users/:userId/enrollments',               listUserHandler);
router.post  ('/admin/users/:userId/enrollments',               grantUserHandler);
router.delete('/admin/users/:userId/enrollments/:topicId',      revokeUserHandler);

router.get   ('/admin/groups/:groupId/enrollments',             listGroupHandler);
router.post  ('/admin/groups/:groupId/enrollments',             grantGroupHandler);
router.delete('/admin/groups/:groupId/enrollments/:topicId',    revokeGroupHandler);
```

### 3. Tests — `apps/api/test/routes/admin-enrollment.spec.ts`

- Grant user → 201; regrant → 200 (idempotent).
- List user grants → returns direct grants only (not expanded).
- Revoke without cascade → only the explicit row gone.
- Revoke with `cascade=true` → descendants with explicit rows also gone.
- Grant group → member's effective-access set expands on next lookup.
- Non-admin role → 403 on every route.

---

## Acceptance Criteria

- [ ] All six routes implemented, tested, and wired in `AppRouter`.
- [ ] Idempotency + cascade semantics covered by tests.
- [ ] Structured log lines emitted on grant and revoke.
- [ ] `make lint` clean. `make test-api` green.

---

## Verification Plan

1. `pnpm --filter api test` green.
2. Curl as admin: grant topic "Futebol" to Alice, read effective access via
   `/me/progress/topics` as Alice — subtree visible.
