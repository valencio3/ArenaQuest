# Task 11: E2E Extension — Enroll → Consume → Check-in → Dashboard

## Metadata
- **Status:** Pending
- **Complexity:** Low-Medium
- **Milestone:** 5 — Engagement & Student Progress
- **Dependencies:** Task 07 (fixture updates), Task 08, Task 09, Task 10

---

## Summary

Extend the Playwright smoke suite with a third scenario exercising the full
M5 loop end-to-end: admin enrolls → student consumes a topic → student
checks into every stage of a task → dashboard reflects 100 %.

---

## Technical Constraints

- Runs under the existing `e2e/` workspace — no new runner / CI job.
- Scenario budget: under 60 s locally on a warm start.
- Uses semantic selectors (`getByRole`, `getByText`) — never CSS classes.
- Reuses the M4 fixture helpers (`createTaskViaApi`, `addStageViaApi`, etc.)
  plus new ones for enrollment.

---

## Scope

### 1. Fixture extensions — `e2e/fixtures/auth.ts`

```ts
export async function grantTopicToUserViaApi(adminToken, userId, topicId): Promise<void>;
export async function revokeTopicFromUserViaApi(adminToken, userId, topicId, opts?): Promise<void>;
```

### 2. Spec — `e2e/tests/progress-flow.spec.ts`

```ts
test('enrolled student completes a task and sees dashboard update', async ({ page }) => {
  const admin = await apiLogin('admin@arenaquest.com', 'password123');

  const root    = await createTopicViaApi(admin, { title: 'E2E Progress Root', status: 'published' });
  const child   = await createTopicViaApi(admin, { title: 'E2E Child',      status: 'published', parentId: root.id });

  const task    = await createTaskViaApi(admin, {
    title: 'E2E Progress Task',
    description: 'Check in through all stages.',
    topicIds: [child.id],
  });
  const s1 = await addStageViaApi(admin, task.id, { label: 'Reading' });
  const s2 = await addStageViaApi(admin, task.id, { label: 'Practice' });
  const s3 = await addStageViaApi(admin, task.id, { label: 'Review' });
  for (const s of [s1, s2, s3]) await setStageTopicsViaApi(admin, task.id, s.id, [child.id]);
  await publishTaskViaApi(admin, task.id);

  const student = await apiFindUserByEmail(admin, 'student@arenaquest.com');
  await grantTopicToUserViaApi(admin, student.id, root.id);

  await loginAs(page, 'student@arenaquest.com', 'password123');
  await page.goto('/dashboard');
  await expect(page.getByText(/Topics .*0%/)).toBeVisible();

  await page.goto(`/tasks/${task.id}`);
  for (const label of ['Reading', 'Practice', 'Review']) {
    await page.getByRole('button', { name: new RegExp(`Check in .*${label}`, 'i') }).click();
    await expect(page.getByText(new RegExp(`Checked in.*${label}`, 'i'))).toBeVisible();
  }

  await page.goto('/dashboard');
  await expect(page.getByText(/Tasks .*100%/)).toBeVisible();
  await expect(page.getByText(/Topics .*100%/)).toBeVisible();
});
```

### 3. Negative-path spec (optional in the same file)

- Before the grant, visit `/tasks` → task is NOT present.
- After revoke (cascade=true), re-visit `/tasks` → task is absent again.

---

## Acceptance Criteria

- [ ] New spec passes locally via `make e2e`.
- [ ] Same spec passes in CI.
- [ ] Forced failure (e.g. break the "Review" label assertion) uploads
      traces + screenshots.
- [ ] Full E2E suite (three scenarios from M3, M4, M5) finishes under 4
      minutes locally on a cold start.
- [ ] `make lint` clean.

---

## Verification Plan

1. `make dev` + `make e2e` → all three specs green.
2. Force failure as above → useful trace in `e2e/test-results/`; revert.
3. CI run on a PR uploads artifacts on the intentional failure attempt.
