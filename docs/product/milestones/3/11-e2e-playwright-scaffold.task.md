# Task 11: E2E Scaffolding (Playwright Smoke Test)

## Metadata
- **Status:** Pending
- **Complexity:** Medium
- **Milestone:** 3 — Content & Media Core
- **Dependencies:** Task 08, Task 09, Task 10

---

## Summary

Introduce Playwright as the end-to-end test runner — an initiative that was deliberately
deferred at the end of Milestone 2. Ship a single, reliable smoke test that exercises
the "admin creates + publishes a topic → student sees and consumes it" journey, and set
up the scaffolding so Milestone 4+ tasks can add scenarios without re-litigating the
tooling choice.

---

## Technical Constraints

- **Location:** tests live under `e2e/` at the repo root (not inside an app package),
  so they span both `apps/web` and `apps/api`.
- **Runner:** `@playwright/test` with the Chromium browser only (initial scope;
  Firefox/WebKit can be added later).
- **Isolation:** each test seeds a unique admin user and topic via the API (using a
  test-only `ADMIN_BOOTSTRAP_TOKEN` seeded in the dev DB) so the suite is
  deterministic and parallel-safe.
- **Local environment:** a new `make e2e` target boots both apps with
  `concurrently`, waits for health, then runs Playwright.
- **CI:** a new GitHub Actions job runs the smoke test on every PR and uploads
  screenshots + traces on failure.

---

## Scope

### 1. Package setup

```
e2e/
├── playwright.config.ts
├── fixtures/
│   └── auth.ts          // login helpers, API helpers
├── tests/
│   └── catalogue-smoke.spec.ts
├── package.json
└── tsconfig.json
```

`e2e/package.json` declares `@playwright/test` and a `test` script.
Root `pnpm-workspace.yaml` includes `e2e`.

### 2. Make targets

```makefile
e2e:         ## Run the Playwright smoke suite
	pnpm --filter e2e exec playwright install --with-deps chromium
	pnpm --filter e2e exec playwright test

e2e-headed:
	pnpm --filter e2e exec playwright test --headed
```

### 3. Fixtures — `fixtures/auth.ts`

Helpers:
- `loginAs(page, email, password)` — fills the login form, waits for `/dashboard`.
- `apiLogin(email, password)` — fetches an access token directly.
- `createTopicViaApi(token, { title, parentId, status })`.
- `addMediaViaApi(token, topicId, file)` — presign → PUT → finalize.

### 4. The smoke test — `tests/catalogue-smoke.spec.ts`

```ts
test('admin publishes a topic with media; student sees it in the catalogue', async ({ page }) => {
  const admin    = await apiLogin('admin@arenaquest.com', 'password123');
  const topic    = await createTopicViaApi(admin, { title: 'E2E Smoke', status: 'published' });
  await addMediaViaApi(admin, topic.id, 'fixtures/sample.pdf');

  await loginAs(page, 'student@arenaquest.com', 'password123');
  await page.goto('/catalog');
  await expect(page.getByRole('treeitem', { name: 'E2E Smoke' })).toBeVisible();
  await page.getByRole('treeitem', { name: 'E2E Smoke' }).click();
  await expect(page.locator('object[type="application/pdf"]')).toBeVisible();
});
```

A small `fixtures/sample.pdf` (≤ 100 KB) is committed for upload tests.

### 5. CI job — `.github/workflows/e2e.yml`

- Installs pnpm + dependencies.
- Boots `apps/api` (miniflare) and `apps/web` (Next dev) in the background.
- Waits for `/health` on both.
- Runs `make e2e`.
- Uploads `e2e/test-results/` on failure.

### 6. README pointer

Add a short section to the root README explaining how to run `make e2e` locally.

---

## Acceptance Criteria

- [ ] `e2e/` workspace exists and is listed in `pnpm-workspace.yaml`.
- [ ] `make e2e` runs the suite locally and passes.
- [ ] The smoke test exercises: admin seed → create published topic with PDF → student
      login → catalogue listing → PDF embed visible.
- [ ] CI workflow `.github/workflows/e2e.yml` exists and runs on PRs.
- [ ] On a simulated failure (e.g. rename the button to break the test), the CI run
      uploads Playwright traces and screenshots as artifacts.
- [ ] Suite runs in under 2 minutes locally on a cold start.
- [ ] `make lint` clean (including any new TS files).

---

## Verification Plan

1. `make dev` in one terminal; `make e2e` in another → green.
2. Break the catalogue page intentionally (remove the treeitem `role`) → run `make e2e`
   → the smoke test fails with a useful trace; revert.
3. Push a branch; confirm the new CI job runs and the artifact is uploaded on a
   forced failure.
