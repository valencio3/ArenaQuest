# Task 10: Frontend — Admin Enrollment Panel

## Metadata
- **Status:** Pending
- **Complexity:** Medium
- **Milestone:** 5 — Engagement & Student Progress
- **Dependencies:** Task 05

---

## Summary

Two admin surfaces for managing topic access:

- An "Enrollments" tab on the existing `/admin/users/:userId` page.
- A new `/admin/groups` list page + `/admin/groups/:groupId` detail page (if
  group management does not yet exist — deliver a minimal viable version here).

---

## Technical Constraints

- **Role gate:** `requireRole('admin', 'content_creator')` on the client via
  `useHasAnyRole`.
- **Reuse the TopicPicker** from M4 Task 07 — the same component handles
  multi-select against the full topic tree.
- **Explicit cascade toggle on revoke:** the delete confirmation modal
  includes a checkbox "Also revoke descendants explicitly granted" — maps to
  `cascade=true`.
- **Effective vs direct:** the panel clearly distinguishes:
  - **Directly granted** (edit-able list).
  - **Effective** (derived — read-only, shown as a muted chip list).
- **Minimal groups UX:** for the groups page, a list + detail with add/remove
  members + grants is enough — do not attempt a full group CRUD if one does
  not exist. Flag to the reviewer as a scope-creep carve-out.

---

## Scope

### 1. API client — `apps/web/src/lib/admin-enrollment-api.ts`

```ts
export const adminEnrollmentApi = {
  listUser(token, userId): Promise<EnrollmentRecord[]>;
  grantUser(token, userId, topicId): Promise<EnrollmentRecord>;
  revokeUser(token, userId, topicId, opts?): Promise<void>;

  listGroup(token, groupId): Promise<EnrollmentRecord[]>;
  grantGroup(token, groupId, topicId): Promise<EnrollmentRecord>;
  revokeGroup(token, groupId, topicId, opts?): Promise<void>;
};
```

### 2. User detail tab — extend `apps/web/src/app/(protected)/admin/users/[id]/page.tsx`

New tab with:
- "Directly granted" list: rows of topic titles + revoke button (opens
  cascade-aware modal).
- "Add grant" button → opens `<TopicPicker />` (single-select here — the grant
  is issued one-topic-at-a-time to keep audit lines simple).
- "Effective access" collapsible list (read-only).

### 3. Groups pages

- `apps/web/src/app/(protected)/admin/groups/page.tsx` — table of groups +
  "New group" button.
- `apps/web/src/app/(protected)/admin/groups/[id]/page.tsx` — name, members,
  grants sub-sections.

If a group entity does not yet exist server-side, this task stops at the user
tab — the groups page is spun off into a follow-up task and `milestone.md` DoD
is adjusted.

### 4. Tests — `apps/web/__tests__/app/admin/enrollments.test.tsx`

- User tab: renders direct grants from mock API.
- Grant action calls `grantUser` with the selected topic id.
- Revoke with cascade checkbox toggled calls the API with `cascade=true`.
- Revoke without cascade calls without the flag.
- Student role → cannot access the tab.

---

## Acceptance Criteria

- [ ] Admin can grant and revoke topics for a user from the UI.
- [ ] Cascade toggle is visible and functional.
- [ ] Effective access is visibly distinguished from direct grants.
- [ ] Component tests in §4 pass.
- [ ] `make lint` clean. `pnpm --filter web test` green.

---

## Verification Plan

1. `pnpm --filter web test` green.
2. Manual as admin:
   - Grant "Futebol" to Alice → the effective list shows the whole subtree.
   - Revoke with cascade unchecked → explicit descendants (if any) remain.
   - Log in as Alice → `/tasks` includes the tasks under "Futebol".
