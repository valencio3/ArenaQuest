# Task 10: Frontend — Student Catalogue + Content Viewers

## Metadata
- **Status:** Pending
- **Complexity:** High
- **Milestone:** 3 — Content & Media Core
- **Dependencies:** Task 06, Task 07

---

## Summary

Build the read-only surface at `/catalog` where any signed-in user can browse the
published topic tree and consume its content. Introduces the three viewers: safe
Markdown, inline PDF, and native HTML5 video.

---

## Technical Constraints

- **Defence in depth:** Markdown is sanitized on the server (Task 04 write-path) AND
  again in the client via `renderSafeMarkdownToHtml` from Task 07. The page uses
  `dangerouslySetInnerHTML` only on the result of that helper — never on raw input.
- **URL freshness:** each time a media item is viewed, use the `downloadUrl` returned
  by the API (15-minute expiry). Do not cache URLs across route changes.
- **Server components where possible:** the outer `/catalog/page.tsx` is a client
  component (it uses `useAuth`), but viewers themselves can be simple presentational
  components.
- **Accessibility:** the tree uses `role="tree"` / `role="treeitem"`; media viewers
  have text alternatives (title attribute + visible filename for PDF/video fallback).

---

## Scope

### 1. API client — `apps/web/src/lib/topics-api.ts`

```ts
export const topicsApi = {
  list(token): Promise<TopicNodeRecord[]>;       // published only
  get(token, id): Promise<TopicNodeDetail>;      // node + children + media(with downloadUrl)
};
```

### 2. Page — `apps/web/src/app/(protected)/catalog/page.tsx`

Layout:
```
┌────────────┬────────────────────────────┐
│ Sidebar    │  Content pane               │
│ (tree)     │  ── Title                   │
│            │  ── Tags · estimatedMinutes │
│            │  ── Sanitized Markdown      │
│            │  ── Media list              │
│            │       • PdfViewer           │
│            │       • VideoViewer         │
│            │       • ImageViewer         │
└────────────┴────────────────────────────┘
```

### 3. Viewers — `apps/web/src/components/viewers/`

- `markdown-viewer.tsx` — takes raw Markdown, renders via
  `renderSafeMarkdownToHtml`, injects with `dangerouslySetInnerHTML`, adds a `prose`
  CSS class for typography.
- `pdf-viewer.tsx` — `<object data={url} type="application/pdf" className="w-full h-[70vh]">`
  with a fallback `<a>` link for browsers without the plugin.
- `video-viewer.tsx` — `<video controls src={url} className="w-full max-h-[70vh]">`
  with a captions slot (unused this milestone but stub the prop).
- `image-viewer.tsx` — `<img alt={name} src={url}>` with lazy loading.

### 4. Tree sidebar — `apps/web/src/components/topics/catalog-tree.tsx`

Same flat → nested transform as Task 08's admin tree, but read-only (no drag-drop).

### 5. Component tests — `__tests__/app/catalog.test.tsx`

- Tree renders from mock data.
- Selecting a node fetches its detail and renders Markdown + media.
- Attempting to render `# Heading\n\n<script>alert(1)</script>` results in the
  heading being visible but `window.alert` is never called (verify via spy).
- A media item of type `application/pdf` renders `<object type="application/pdf">`.

---

## Acceptance Criteria

- [ ] `/catalog` is reachable by any signed-in user.
- [ ] Only published topics appear in the tree.
- [ ] Markdown renders headings, bold, lists, code blocks, links.
- [ ] A topic whose Markdown contains `<script>` does NOT execute JS (XSS test passes).
- [ ] A PDF embeds inline and loads via the presigned URL.
- [ ] A video streams via the presigned URL with native controls.
- [ ] Component tests in §5 pass.
- [ ] `make lint` clean; `pnpm --filter web test` green.

---

## Verification Plan

1. `pnpm --filter web test` — green.
2. Manual (both apps running with content seeded via the admin UI):
   - Log in as a student.
   - Navigate to `/catalog`.
   - Select a node with a PDF and a video → both play inline.
   - Inspect DevTools Network: asset requests go to R2, each URL has `X-Amz-Expires` ≈ 900.
3. XSS smoke test: as admin, create a topic with content
   `# Hi\n\n<script>window.__xss=true</script>` and publish. Open as student → page
   loads; `window.__xss` is undefined.
