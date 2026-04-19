# Task 08: Frontend — Admin Stage Editor

## Metadata
- **Status:** Pending
- **Complexity:** Medium
- **Milestone:** 4 — Task Engine & Interconnection
- **Dependencies:** Task 04, Task 05, Task 07

---

## Summary

Fill the `StagesEditor` slot inside the task editor with a fully interactive
sortable stage list. Each stage row has an inline-editable label, a
per-stage topic picker constrained to the parent task's link set, and a delete
button that respects the parent-status guard.

---

## Technical Constraints

- **Drag-drop:** `@dnd-kit/sortable` (already used by the topic tree). Reorder fires
  `POST /admin/tasks/:id/stages/reorder` with the new ordered id list. On failure
  (e.g. `STAGE_SET_MISMATCH`), revert to the last server state and toast the
  message.
- **Per-stage topic picker:** receives `allowedTopicIds` (the task-level set) as a
  prop. Topics outside the set are disabled (with a tooltip: "Add this topic to
  the task first") rather than hidden — gives the author a visible hint that the
  set can be widened.
- **Delete guard:** if the parent task is `published`, the delete button is
  disabled with a tooltip "Archive the task first to edit its stages".
- **Optimistic rename:** label changes are sent on blur; on 400 validation, revert
  and show an inline error.

---

## Scope

### 1. API client — extend `admin-tasks-api.ts`

```ts
addStage(token, taskId, input): Promise<TaskStage>;
updateStage(token, taskId, stageId, patch): Promise<TaskStage>;
deleteStage(token, taskId, stageId): Promise<void>;
reorderStages(token, taskId, orderedIds): Promise<TaskStage[]>;
setStageTopics(token, taskId, stageId, topicIds): Promise<string[]>;
```

### 2. Component — `apps/web/src/components/tasks/stage-editor.tsx`

Props: `{ task, onChange }`.

Structure:

```tsx
<SortableList
  items={task.stages}
  onReorder={handleReorder}
>
  {(stage) => (
    <StageRow
      stage={stage}
      allowedTopicIds={task.linkedTopicIds}
      deleteDisabled={task.status === 'published'}
      onLabelChange={...}
      onTopicsChange={...}
      onDelete={...}
    />
  )}
</SortableList>
<AddStageButton onAdd={...} />
```

### 3. Tests — `apps/web/__tests__/app/admin/stage-editor.test.tsx`

- Renders N stages from props.
- "Add stage" calls `addStage` with `{ label: 'New stage' }`.
- Drag-reorder calls `reorderStages` with the correct id array.
- Reorder server-side failure → list reverts, toast shown.
- `setStageTopics` call includes only ids present in the parent task's set (UI
  prevents selecting others).
- When `task.status === 'published'`, delete buttons are disabled.

---

## Acceptance Criteria

- [ ] Authors can add, rename, reorder, and (when permitted) delete stages.
- [ ] Authors can attach topics to each stage from the constrained picker.
- [ ] All four server-side guards (parent-published delete, stage-set mismatch,
      stage-not-in-task, 409 publishability) surface as clear inline UI errors.
- [ ] Component tests in §3 pass.
- [ ] `make lint` clean. `pnpm --filter web test` green.

---

## Verification Plan

1. `pnpm --filter web test` green.
2. Manual: open a draft task → add 3 stages → reorder via drag → reload → order
   preserved. Publish the task → delete button becomes disabled.
