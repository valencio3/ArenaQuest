# Task 07: Access-aware Read Filter on `/tasks` and `/topics`

## Metadata
- **Status:** Pending
- **Complexity:** Low-Medium
- **Milestone:** 5 — Engagement & Student Progress
- **Dependencies:** Task 02

---

## Summary

Until now the student surfaces returned **all published** topics and tasks.
This task tightens the filter: a student sees only topics in their
effective-access set, and only tasks whose linked-topic set is a subset of
that access set. Admins and content creators bypass the filter.

---

## Technical Constraints

- **Role bypass:** if the caller has `admin` or `content_creator` role, skip
  the filter entirely. This keeps the admin "preview as student" flow a
  future UI concern, not something to bake in now.
- **Single access lookup per request:** cache the `effectiveAccessTopicIds`
  set on a request-scoped `c.get('access')` once, reuse across the request.
- **No silent trimming:** a task whose `linkedTopicIds` is NOT a subset of the
  caller's access is OMITTED from the list and 404's on detail. Do not return
  a half-rendered task.
- **Backwards compatibility note for the UI:** this changes observable behaviour
  for existing fixtures. Seeds and Playwright helpers in M3 / M4 assumed
  "published = visible"; update those fixtures to also enroll the seeded
  student user into the relevant subtree so tests remain green.

---

## Scope

### 1. Read services

- Extend `TopicReadService` (M3) with an `accessibleTopicIds?: Set<string>`
  filter; when present, every list/get query includes a `WHERE id IN (...)`
  clause or filters post-fetch for trees.
- Extend `TaskReadService` (M4 Task 06) analogously, filtering tasks where
  `linkedTopicIds ⊄ accessibleTopicIds`.

### 2. Wiring

- In `apps/api/src/index.ts` (or the composition file), for every request that
  passes through `authGuard` AND the caller is a student, populate
  `c.set('access', await enrollments.getEffectiveAccessTopicIds(userId))`.
  Skip for admin/content_creator roles.

### 3. Fixture updates

- M3 Playwright fixture: `createTopicViaApi` in `e2e/fixtures/auth.ts` now also
  enrolls the seeded `student@arenaquest.com` into the created root topic (via
  the M5 admin enrollment API).
- M4 Playwright fixture: similarly, after publishing a task, ensure its linked
  topics are in the student's access set.
- Seed SQL (`apps/api/scripts/0004_seed_dev_users.sql` or a new seed) grants
  the demo student access to the demo root topic.

### 4. Tests

- `apps/api/test/routes/tasks-public.spec.ts` gains cases: unenrolled student
  sees empty `/tasks`; after grant, sees the task; after revoke, back to
  empty.
- `apps/api/test/routes/topics-public.spec.ts` gains analogous cases.
- Admin role sees everything regardless of grants — verify with a dedicated
  test.

---

## Acceptance Criteria

- [ ] Student sees only accessible topics and tasks.
- [ ] Admin/content_creator sees everything.
- [ ] M3 and M4 Playwright scenarios still pass after fixture updates.
- [ ] `make lint` clean. `make test-api` green. `make e2e` green.

---

## Verification Plan

1. `pnpm --filter api test` green (with updated M3/M4 suites).
2. `make e2e` green — both the M3 catalogue scenario and the M4 task scenario
   pass with the new enrollment seeding.
3. Curl as unenrolled student: `/tasks` returns `[]`; grant; `/tasks` returns
   the task.
