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
