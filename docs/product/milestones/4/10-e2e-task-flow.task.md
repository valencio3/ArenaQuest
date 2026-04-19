# Task 10: E2E Extension — Task Authoring → Student View

## Metadata
- **Status:** Pending
- **Complexity:** Low
- **Milestone:** 4 — Task Engine & Interconnection
- **Dependencies:** Task 07, Task 08, Task 09 (and the M3 Playwright scaffold, Task 11)

---

## Summary

Extend the Playwright smoke suite introduced in Milestone 3 with a second scenario
that exercises the full Milestone 4 happy path end-to-end. No new runner, no new CI
job — just one more `.spec.ts` file and a small set of API fixtures.

---

## Technical Constraints

- **Runs inside the existing `e2e/` workspace** — do not duplicate scaffolding.
- **Isolation:** each run seeds a uniquely-suffixed topic tree AND task via the API
  helpers (so the suite is parallel-safe and deterministic).
- **Timeout budget:** the new spec must finish under 45 s locally on a warm start.
- **Assertions lean on semantic selectors** (`getByRole('link', { name: ... })`) —
  avoid CSS class selectors.

---

## Scope

### 1. Fixture extensions — `e2e/fixtures/auth.ts`

```ts
export async function createTaskViaApi(token, input: {
  title, description, topicIds,
}): Promise<Task>;

export async function addStageViaApi(token, taskId, { label }): Promise<Stage>;

export async function setStageTopicsViaApi(token, taskId, stageId, topicIds): Promise<void>;

export async function publishTaskViaApi(token, taskId): Promise<void>;
```

### 2. Spec — `e2e/tests/task-authoring.spec.ts`

```ts
test('admin authors a task; student sees it with deep links to /catalog', async ({ page }) => {
  const admin = await apiLogin('admin@arenaquest.com', 'password123');

  const topicA = await createTopicViaApi(admin, { title: 'E2E Topic A', status: 'published' });
  const topicB = await createTopicViaApi(admin, { title: 'E2E Topic B', status: 'published' });

  const task = await createTaskViaApi(admin, {
    title: 'E2E Smoke Task',
    description: '# Hello\n\nA test task.',
    topicIds: [topicA.id, topicB.id],
  });
  const stage = await addStageViaApi(admin, task.id, { label: 'Reading' });
  await setStageTopicsViaApi(admin, task.id, stage.id, [topicA.id]);
  await publishTaskViaApi(admin, task.id);

  await loginAs(page, 'student@arenaquest.com', 'password123');
  await page.goto('/tasks');

  const card = page.getByRole('link', { name: /E2E Smoke Task/ });
  await expect(card).toBeVisible();
  await card.click();

  await expect(page.getByRole('heading', { name: 'E2E Smoke Task' })).toBeVisible();
  await expect(page.getByText('Reading')).toBeVisible();

  const chip = page.getByRole('link', { name: 'E2E Topic A' });
  await expect(chip).toHaveAttribute('href', `/catalog/${topicA.id}`);
  await chip.click();
  await expect(page.getByRole('treeitem', { name: 'E2E Topic A' })).toBeVisible();
});
```

### 3. CI — no changes required. The existing `e2e.yml` already runs every spec
    under `e2e/tests/`.

---

## Acceptance Criteria

- [ ] New spec passes locally via `make e2e`.
- [ ] Same spec passes in CI on a PR.
- [ ] A forced failure (rename the task title assertion) uploads traces +
      screenshots as artifacts.
- [ ] Total e2e suite still finishes under 3 minutes locally on a cold start.
- [ ] `make lint` clean (including any new TS files in `e2e/`).

---

## Verification Plan

1. `make dev` + `make e2e` → both specs green.
2. Break the task title intentionally (`title: 'nope'`) → run `make e2e` → failure
   with a useful trace; revert.
3. Push branch; confirm the existing CI job runs and reports pass / fail for both
   scenarios.
