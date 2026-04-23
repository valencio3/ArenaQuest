# Task 07: Markdown Sanitization Helper (Shared Package)

## Metadata
- **Status:** Pending
- **Complexity:** Low
- **Milestone:** 3 — Content & Media Core
- **Dependencies:** none

---

## Summary

Create a single, shared sanitization helper usable on both the Worker (content write
path) and the browser (content render path), so the "safe Markdown" contract is
expressed in exactly one place.

Two surfaces need it:
- **Write-side (Task 04):** strip dangerous Markdown / HTML *before* persistence. The
  stored string never contains `<script>`, `<iframe>`, `on*` attributes, or `javascript:`
  URIs.
- **Render-side (Task 10):** render persisted Markdown to HTML; defence-in-depth pass
  with the same sanitizer in case someone bypasses the API and writes directly to D1.

---

## Technical Constraints

- **Isomorphic:** the helper runs in both Workers (fetch/Response environment) and
  React (browser). `isomorphic-dompurify` satisfies both.
- **Single source of truth:** lives in `packages/shared/content/sanitize-markdown.ts`.
- **No HTML output at boundaries:** the WRITE-side function takes Markdown → returns
  Markdown (minus the disallowed constructs). The RENDER-side function takes Markdown →
  returns sanitized HTML. Never mix directions in one function.
- **Allowlist, not denylist:** start from DOMPurify's safe defaults and tighten; do not
  try to blocklist attack strings.

---

## Scope

### 1. Dependencies (add to `packages/shared/package.json`)

```jsonc
"dependencies": {
  "marked": "^14",
  "isomorphic-dompurify": "^2"
}
```

### 2. API

```ts
// packages/shared/content/sanitize-markdown.ts

export const ALLOWED_TAGS = [
  'h1','h2','h3','h4','h5','h6',
  'p','ul','ol','li','blockquote','code','pre',
  'strong','em','a','hr','br',
  'table','thead','tbody','tr','th','td',
];

export const ALLOWED_ATTR = ['href','title'];

/** Returns sanitized Markdown — safe to store. */
export function sanitizeMarkdownSource(input: string): string;

/** Returns sanitized HTML — safe to render via `dangerouslySetInnerHTML`. */
export function renderSafeMarkdownToHtml(input: string): string;
```

The write-side function:
1. Runs `DOMPurify.sanitize(input, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })` on the raw
   string first (strip any raw HTML entirely).
2. Returns the remaining text. Markdown syntax (`**bold**`, `[x](y)`) is preserved
   because it is plain text to the sanitizer.

The render-side function:
1. `marked.parse(input, { async: false, gfm: true, breaks: true })` → HTML.
2. `DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR })`.
3. Force-rewrites every `href` to reject `javascript:` / `data:` URIs (except
   `data:image/*` if we ever enable inline images; not in this task).

### 3. Tests — `packages/shared/test/sanitize-markdown.spec.ts`

Attack strings that MUST NOT survive:
- `<script>alert(1)</script>` → dropped on both sides.
- `<img src=x onerror=alert(1)>` → dropped.
- `[xss](javascript:alert(1))` → the rendered anchor has no `href`.
- `<a href="data:text/html,<script>..." >x</a>` → dropped.
- `<iframe src=...>` → dropped.

Strings that MUST survive:
- `# Title\n\nParagraph with **bold** and _italic_.`
- Code fences with language hints (`\`\`\`ts ... \`\`\``).
- Tables (GFM).

### 4. Re-export

Add to `packages/shared/index.ts`:

```ts
export { sanitizeMarkdownSource, renderSafeMarkdownToHtml } from './content/sanitize-markdown';
```

---

## Acceptance Criteria

- [ ] `sanitizeMarkdownSource` and `renderSafeMarkdownToHtml` exported from
      `@arenaquest/shared`.
- [ ] Every attack string listed in §3 is neutralised.
- [ ] Every legitimate Markdown construct listed in §3 survives.
- [ ] The test suite runs in both `vitest` contexts (the package compiles and tests
      pass; consumer apps in `apps/api` and `apps/web` can import without type errors).
- [ ] `make lint` clean; all tests pass.

---

## Verification Plan

1. `pnpm --filter @arenaquest/shared test` — green.
2. `pnpm --filter api build` + `pnpm --filter web build` — both compile.
3. Ad-hoc REPL check via `node -e "...sanitizeMarkdownSource(...)..."`.
