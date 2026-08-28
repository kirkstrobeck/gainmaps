# GOAL-EVIDENCE-L46

## Score BEFORE: 58/100

## Parts implemented

| Part | Description | Status |
|------|-------------|--------|
| 1    | Public JSON API (photos, logos, version) + OpenAPI spec + /openapi.json route | Done |
| 2    | Accept: text/markdown content negotiation via middleware rewrite to /api/markdown | Done |
| 4    | Trust anchor pages: /about, /contact, /privacy | Done |
| 5    | Metadata: canonical, og:image, contactPoint to Organization JSON-LD | Done |
| 6    | llms.txt: appended "When to use Gainmaps" section | Done |
| 7    | Heading structure test for homepage h1/h2 hierarchy | Done |

## Markdown negotiation

Middleware intercepts requests with `Accept: text/markdown` before the cookie/header logic runs. If the pathname is in `MARKDOWN_PATHS`, the request is rewritten to `/api/markdown?path=<pathname>` via `NextResponse.rewrite()`. The middleware config matcher excludes `/api/*` so the markdown route itself is not intercepted. Unknown paths return a 404 markdown body with navigation hints.

## 404 markdown

When `Accept: text/markdown` is present and the path is not in `MARKDOWN_PATHS`, middleware returns a 404 response with `content-type: text/markdown` and a body listing key site URLs.

## Sample OpenAPI spec paths

```
GET /api/photos          → listPhotos   → 200 array
GET /api/photos/{slug}   → getPhoto     → 200 | 404
GET /api/logos           → listLogos    → 200 array
GET /api/logos/{slug}    → getLogo      → 200 | 404
GET /api/version         → getVersion   → 200 object
```

Every operation has `operationId`, `description`, and typed `responses`.

## Test suite

All new files have tests. Test counts per file:
- api-photos.test.ts: 4 passed
- api-logos.test.ts: 4 passed
- api-version.test.ts: 3 passed
- openapi.test.ts: 3 passed
- api-markdown.test.ts: 6 passed
- static-pages.test.tsx: 8 passed (includes 3 trust anchor page tests)
- structured-data.test.tsx: 5 passed (includes contactPoint test)
- layout-metadata.test.ts: 3 passed
- heading-structure.test.tsx: 3 passed

## Checks not fixed

- **#5 brand search (external SEO)**: Requires external indexing and search ranking — outside codebase control.
- **#15 npm publish**: Requires publishing pipeline credentials — not a codebase change.

## Notes

- `address` field omitted from Organization JSON-LD — no real address to add; including a placeholder would be inaccurate. This rubric point remains open.
- The `/openapi.json` route path uses a Next.js route segment named `openapi.json`, which correctly serves the spec at that URL path.
