# Task 08: Frontend — Admin Topic Tree Dashboard

## Metadata
- **Status:** Pending
- **Complexity:** High
- **Milestone:** 3 — Content & Media Core
- **Dependencies:** Task 04

---

## Summary

Build the authoring surface at `/admin/topics`. The page shows the full tree
(including drafts and archived nodes), lets a content creator create / rename / delete /
publish nodes, and supports drag-drop reordering and re-parenting.

---

## Technical Constraints

- **Role gate:** the page is accessible to `admin` AND `content_creator` roles —
  introduce a helper `useHasAnyRole(...roles)` in `hooks/use-auth.ts`.
- **Typed API client:** all HTTP goes through `apps/web/src/lib/admin-topics-api.ts`,
  similar to `admin-users-api.ts` already in place.
- **Drag-drop:** `@dnd-kit/core` + `@dnd-kit/sortable`. The tree is kept in a flat
  list + `indent` depth; `@dnd-kit` handles the sortable visuals.
- **Optimistic UI:** not required; show a loading spinner on each persisted mutation.
- **Error surfacing:** `409 WOULD_CYCLE` and other `409 Conflict` codes show a toast /
  inline error and revert the optimistic position if one was applied.

---

## Scope

### 1. API client — `apps/web/src/lib/admin-topics-api.ts`

```ts
export const adminTopicsApi = {
  list(token): Promise<TopicNodeRecord[]>;
  create(token, input): Promise<TopicNodeRecord>;
  get(token, id): Promise<TopicNodeRecord>;
  update(token, id, patch): Promise<TopicNodeRecord>;
  move(token, id, newParentId, newOrder): Promise<TopicNodeRecord>;
  archive(token, id): Promise<void>;
};
```

### 2. Page — `apps/web/src/app/(protected)/admin/topics/page.tsx`

Layout:
```
┌─────────────────────────────┬──────────────────────────────┐
│  Tree pane (sidebar)        │  Detail pane                  │
│  • Search box               │  (selected node)              │
│  • Drag-drop tree           │  • Title (inline edit)        │
│  • "+ Add root" button      │  • Status chip + toggle       │
│  • Status filters (chips)   │  • Content <textarea>         │
│                             │  • Tags (chip input)          │
│                             │  • Prerequisites (multi-sel)  │
│                             │  • Estimated minutes          │
│                             │  • Media (placeholder — Task 09)│
└─────────────────────────────┴──────────────────────────────┘
```

Features:
- Click a node → populate the detail pane.
- Inline edit on title (blur or Enter saves).
- "Add child" button per node.
- Status chip toggles through `draft → published → archived`; archived can be restored
  to draft only (no direct archived → published).
- Drag a node onto another to re-parent. Drop between siblings to reorder. On drop,
  call `adminTopicsApi.move(...)` and refresh the tree on success.
- On move failure (`409 WOULD_CYCLE`), show a toast and revert the visual position.

### 3. Re-usable tree widget

Extract `<TopicTree items={...} onMove={...} onSelect={...} />` into
`apps/web/src/components/topics/topic-tree.tsx` — separates the dnd-kit plumbing from
the page.

### 4. Component tests

- Renders the tree with mock data (root + 2 children).
- "Add root" calls `adminTopicsApi.create` with `parentId: null`.
- Changing status to `published` calls `update` with `{ status: 'published' }`.
- Move event: simulate a move; the component calls `onMove(nodeId, newParentId,
  newOrder)` with the correct args.
- A user with only the `student` role is redirected away (mock `useHasAnyRole` returns
  `false`).

---

## Acceptance Criteria

- [ ] `/admin/topics` page compiles and lints.
- [ ] An admin or content creator can create a root, create children, rename, edit
      content, toggle status, and archive a node.
- [ ] A student visiting `/admin/topics` is redirected to `/dashboard`.
- [ ] Drag-drop reorder persists across reload.
- [ ] Drag-drop re-parent persists across reload.
- [ ] A move that would cycle surfaces `"Cannot move a topic under its own descendant"`
      and visually reverts.
- [ ] Component tests in `__tests__/app/admin/topics.test.tsx` cover every case in §4.
- [ ] `pnpm --filter web test` — green. `make lint` clean.

---

## Verification Plan

1. `pnpm --filter web test` — green.
2. Manual (both apps running):
   - Log in as admin, navigate to `/admin/topics`, build a three-level tree.
   - Reload — tree structure preserved.
   - Drag a grandchild onto its grandparent — success; reload — preserved.
   - Drag the grandparent under the grandchild — error toast, no change.
