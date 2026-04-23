# Task 08: Frontend — Student Dashboard

## Metadata
- **Status:** Pending
- **Complexity:** Medium-High
- **Milestone:** 5 — Engagement & Student Progress
- **Dependencies:** Task 06

---

## Summary

Replace the `/dashboard` placeholder with a genuine student home surface:
progress summary cards, a "Continue" list of in-progress tasks, and a
per-top-level-topic progress breakdown.

---

## Technical Constraints

- **Client-side data fetching** via `useAuth` token + the new `progressApi`;
  no server components (the token lives in context).
- **No heavy chart deps in M5:** all visualisations are plain SVG + Tailwind.
  A `RadialProgress` atom renders an SVG circle with `stroke-dasharray`
  math; a `BarProgress` atom renders a div with width %.
- **Stale-while-revalidate feel:** on mount, render cached data from a small
  in-memory map, then fetch fresh; the UI flashes freshly but never shows an
  empty state unless the data really is empty.
- **Accessibility:** every progress visualisation has an adjacent numeric
  readout (`<span aria-hidden>` for the ring, `<span className="sr-only">`
  carrying "40 % of topics completed"). No colour-only encoding.

---

## Scope

### 1. API client — `apps/web/src/lib/progress-api.ts`

```ts
export const progressApi = {
  summary(token): Promise<ProgressSummary>;
  topics(token): Promise<TopicProgressEntry[]>;
  tasks(token): Promise<TaskProgressEntry[]>;
};
```

### 2. Page — `apps/web/src/app/(protected)/dashboard/page.tsx`

Layout:

```
┌──────────────────────────────────────────────┐
│  ⟨greeting⟩                                   │
├──────────────────────────────────────────────┤
│  SummaryRow:                                  │
│    [Topics 40%] [Tasks 40%] [Last active …]   │
├──────────────────────────────────────────────┤
│  "Continue" section                           │
│    Card: Task A — Stage 2 "Practice" — [Open] │
│    Card: Task B — Stage 1 "Reading"  — [Open] │
├──────────────────────────────────────────────┤
│  Topics section (top-level only)              │
│    "Futebol"   ▰▰▰▰▱▱▱▱▱▱ 40%                 │
│    "Vôlei"     ▰▰▱▱▱▱▱▱▱▱ 20%                 │
└──────────────────────────────────────────────┘
```

### 3. Components — under `apps/web/src/components/progress/`

- `summary-card.tsx` — label, big number / percent, subtitle.
- `continue-list.tsx` — task card row; deep-links to `/tasks/:id`.
- `topic-progress-list.tsx` — bar-per-root-topic. Rolls up descendants as:
  `descendants_completed / descendants_total`.
- `radial-progress.tsx` and `bar-progress.tsx` — atoms.

### 4. Roll-up logic

Given `TopicProgressEntry[]` and a lightweight tree structure from `/topics`,
compute for each root:

```ts
{
  rootId,
  rootTitle,
  completed: descendants.filter(t => t.status === 'completed').length,
  total:     descendants.length,
}
```

Extract into `apps/web/src/lib/progress-rollup.ts` (pure function, unit-tested).

### 5. Tests — `apps/web/__tests__/app/dashboard.test.tsx`

- Renders summary percentages from mocked API.
- "Continue" list renders up to 3 most recent in-progress tasks ordered by
  `updatedAt DESC`.
- Topic roll-up collapses descendants under their root.
- Empty state: `summary.topics.total === 0` → "You don't have any topics
  assigned yet" message (no progress bar).
- Accessible copy: each progress ring has a text equivalent.

---

## Acceptance Criteria

- [ ] `/dashboard` renders the three sections with live API data.
- [ ] Pure `progress-rollup` function has its own unit tests.
- [ ] Loads under 500 ms against a seeded fixture of 50 topics + 10 tasks
      (`performance.mark` measurement; document in PR).
- [ ] Component tests in §5 pass.
- [ ] `make lint` clean. `pnpm --filter web test` green.

---

## Verification Plan

1. `pnpm --filter web test` green.
2. Manual: log in as seeded student; check boxes / progress bars update after
   a check-in in another tab and a dashboard refresh.
