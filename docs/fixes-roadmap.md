# fixes-roadmap.md

A running ledger of every fix applied to **Studio-OS-Chat** — what broke, why, who caught it, who fixed it, and what to do differently on the next build.

This document is the **canonical fix record**. Inbox/outbox envelopes reference fixes by ID (e.g. `fix-ref: FIX-001`). Together they form a complete build archaeology trail.

> **How to read this:**  
> Each entry = one discrete fix event. Entries are numbered sequentially (`FIX-NNN`).  
> Links to inbox messages point to the envelope that first surfaced or resolved the issue.

---

## FIX-001 — 5 TypeScript build errors (CI commits 115–138 red)

| Field | Detail |
|---|---|
| **Date** | 2026-04-25 |
| **Severity** | 🔴 Build-breaking — all CI runs failing |
| **Detected by** | Alice (diagnosed from CI screenshot — Actions tab) |
| **Fixed by** | Alice |
| **Commits** | [`be8a478`](https://github.com/nothinginfinity/Studio-OS-Chat/commit/be8a47820830b60d792e91fc6b2655f8d3baba9d) · [`3c30958`](https://github.com/nothinginfinity/Studio-OS-Chat/commit/3c3095e933d362bb83844114926b32da62d80775) |
| **CI green from** | Commit 139 (`3c30958`) onward |

### Root Cause

Five independent TypeScript errors accumulated across Phase 2–4 feature work, none caught locally because the repo had no pre-commit type-check hook. All five were exposed simultaneously by the CI `tsc -b` step.

### Errors & Fixes

| # | File | TS Error | Fix Applied |
|---|---|---|---|
| 1 | `src/App.tsx` line 41 | `TS2352` — `ChatSettings` cast directly to `Record<string,string>` fails because `ChatSettings` has no index signature | Changed to double-cast: `settings as unknown as Record<string, string>` |
| 2 | `src/App.tsx` line 116 / `src/components/Sidebar.tsx` | `TS2322` — `spaceMailbox` prop passed to `<Sidebar>` but missing from `SidebarProps` interface | Added `import type { UseSpaceMailboxResult }` + `spaceMailbox?: UseSpaceMailboxResult` to `SidebarProps`; destructured as `_spaceMailbox` in function body |
| 3 | `src/lib/chartRenderer.ts` lines 107 & 134 | `TS2322` — `baseOptions()` returned the broad `ChartConfiguration` union type (which includes `radialLinear` scales); assigning to `ChartConfiguration<'line'>` / `ChartConfiguration<'bar'>` failed | Made `baseOptions<T extends keyof ChartTypeRegistry>()` generic; call sites updated to `baseOptions<'line'>`, `baseOptions<'bar'>`, `baseOptions<'scatter'>` |
| 4 | `src/lib/postOcrGeometry/*.test.ts` (3 files) | `TS2307` — `import ... from 'vitest'` unresolvable; `vitest` was never added to `devDependencies` | Added `"vitest": "^1.6.0"` to `devDependencies` in `package.json` |
| 5 | `tsconfig.app.json` | (Related to #4) — `"include": ["src"]` swept up all `.test.ts` files into the production build, exposing the missing `vitest` types on every run | Added `"exclude": ["src/**/*.test.ts", "src/**/*.spec.ts", "src/**/*.test.tsx", "src/**/*.spec.tsx"]` to `tsconfig.app.json` |

### Files Changed

- `src/App.tsx`
- `src/components/Sidebar.tsx`
- `src/lib/chartRenderer.ts`
- `package.json`
- `tsconfig.app.json`

### Inbox / Outbox References

| Direction | Envelope ID | Subject | Timestamp |
|---|---|---|---|
| Alice → Alice (self-note) | [`msg-alice-alice-20260425T160900Z`](https://github.com/nothinginfinity/Studio-OS-Chat/blob/main/spaces/alice.mmcp/inbox.md) | CI BUILD FIX — chart.js / chartjs-adapter-date-fns / date-fns missing from package.json (prior fix attempt) | 2026-04-25T16:09Z |

> **Note on prior attempt:** `msg-alice-alice-20260425T160900Z` records a first fix attempt that added the missing npm packages (`chart.js`, `chartjs-adapter-date-fns`, `date-fns`). That resolved the import errors but left the 5 TypeScript type errors above untouched, which is why CI remained red through commit 138.

### Lesson for Next Build

- **Add `vitest` at project init** — any repo using Vite should include `vitest` in `devDependencies` from day one, not when tests are first written.
- **Exclude test files from `tsconfig.app.json` at project init** — `"include": ["src"]` is too broad; always add the `exclude` glob for `*.test.ts` upfront.
- **Update prop interfaces immediately** when wiring a new hook into a parent component — `spaceMailbox` was added to `App.tsx` but `SidebarProps` was not updated in the same commit.
- **Type Chart.js config builders precisely** — use generic helpers (`baseOptions<T>`) rather than the broad `ChartConfiguration` union, which silently includes scale types (e.g. `radialLinear`) that are invalid for Cartesian charts.
- **Add a pre-commit `tsc --noEmit` check** (or `"typecheck": "tsc -b"` in `package.json` scripts) so these errors surface locally before reaching CI.

---

## FIX-002 — CSV files not accepted by any upload path (IngestDropZone + Add Files)

| Field | Detail |
|---|---|
| **Date** | 2026-04-26 |
| **Severity** | 🟡 Runtime bug — feature entirely inaccessible to end user |
| **Detected by** | User (live testing on mobile, confirmed by Bob via code audit) |
| **Fixed by** | Alice |
| **Commits** | TBD — update after push |
| **CI green from** | TBD |

### Root Cause

Phase 6 (Track A + B) built a complete CSV ingestion and virtualized rendering pipeline (`csvIngestion.ts`, `CsvTableView.tsx`, RFC 4180 hardened parser, `@tanstack/react-virtual` virtualization for 10k+ rows). However, **neither upload entry point was wired to accept or route `.csv` files**. The OCR drop zone (`IngestDropZone.tsx`) hardcodes `accept="image/*,.pdf"` and its `processFile()` function returns `"Unsupported type"` for anything that is not `image/*` or `application/pdf`. The "Add Files" button (`src/hooks/useFiles.ts` → `addFiles()`) called `indexFileListWithCsvSupport` — but wait, that did not exist yet. It called `indexFileList()` directly which calls `indexFile()` → `readSupportedFile()` in `fileParsers.ts`. `readSupportedFile()` only returns text for `TEXT_EXTENSIONS`, not CSV, so it returned `null` — producing a FileRecord with no parseable text content, surfaced to the user as *"No text content available for preview."*

In short: the CSV feature was built end-to-end but never connected to the front door.

### Errors & Fixes

| # | File | Problem | Fix Applied |
|---|---|---|---|
| FIX-002-F1 | `src/components/IngestDropZone.tsx` | `<input accept="image/*,.pdf">` — `.csv` not in the accepted types list | Added `,.csv,text/csv` to `accept` attribute |
| FIX-002-F2 | `src/components/IngestDropZone.tsx` | `processFile()` only branched on `isImage` and `isPdf`; CSVs fell through to `"Unsupported type"` | Added `isCsv` detection + `else if (isCsv)` branch routing to `ingestCsv()`, wrapping result as synthetic `.txt` and calling `indexFile()` |
| FIX-002-F3 | `src/components/IngestDropZone.tsx` | Drop zone label read *"Drop images or PDFs here"*; subtitle only mentioned OCR + PDF | Updated label to *"Drop images, PDFs, or CSVs here"*; updated subtitle to include *"CSVs → structured index"* |
| FIX-002-F4 | `src/hooks/useFiles.ts` | `addFiles()` called `indexFileList()` directly, which called `readSupportedFile()` — returns `null` for CSV | Added `preprocessFile()` + `indexFileListWithCsvSupport()` helpers; `addFiles()` (and fallback in `addFolder()`) now pre-process CSVs through `ingestCsv()` before `indexFile()` |

### Files Changed

- `src/components/IngestDropZone.tsx`
- `src/hooks/useFiles.ts`

### Inbox / Outbox References

| Direction | Envelope ID | Subject | Timestamp |
|---|---|---|---|
| Bob → Alice | [`msg-bob-alice-20260426T005600Z`](https://github.com/nothinginfinity/Studio-OS-Chat/blob/main/spaces/alice.mmcp/inbox.md) | FIX-002 — CSV upload wiring missing — review + fix requested | 2026-04-26T00:56Z |
| Alice → Bob | TBD — outbox reply to follow | FIX-002 COMPLETE | 2026-04-26T01:03Z |

### Lesson for Next Build

- **Wire new ingestion pipelines to all upload entry points in the same PR that builds the pipeline** — csvIngestion.ts was completed in Phase 6 Track A but neither upload path was updated in the same work unit.
- **Test every new file type end-to-end from the UI before closing a track** — a quick manual upload test would have caught this immediately.
- **When adding a new supported file type, audit every `accept=` attribute and every file-type branch in the codebase** — a grep for `accept=` or `isImage\|isPdf` catches these gaps quickly.
- **`readSupportedFile()` in `fileParsers.ts` is not a catch-all** — it only handles `TEXT_EXTENSIONS`. CSV and PDF have their own dedicated pipelines that must be called explicitly; `indexFileList()` alone is not sufficient for those types.
- **"Add Files" and the drop zone are two separate code paths** — any new file type support must be added to both independently; they do not share a single routing function.

---

## Fix Entry Template

Copy this block for each new fix:

```markdown
## FIX-NNN — [Short description]

| Field | Detail |
|---|---|
| **Date** | YYYY-MM-DD |
| **Severity** | 🔴 Build-breaking / 🟡 Runtime bug / 🟠 Type error / 🔵 Lint / ⚪ Cosmetic |
| **Detected by** | Alice / Bob / User / CI |
| **Fixed by** | Alice / Bob |
| **Commits** | [`short-sha`](full-github-url) |
| **CI green from** | Commit N (sha) |

### Root Cause

[One paragraph explanation of why this happened.]

### Errors & Fixes

| # | File | Error | Fix Applied |
|---|---|---|---|
| 1 | `path/to/file.ts` | Description | What was changed |

### Files Changed

- `path/to/file`

### Inbox / Outbox References

| Direction | Envelope ID | Subject | Timestamp |
|---|---|---|---|
| Alice → Bob | `msg-id` | Subject | ISO timestamp |

### Lesson for Next Build

- Bullet points only.
```
