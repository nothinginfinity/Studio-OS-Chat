# Studio-OS-Chat — Phase 5 Roadmap
## Performance · Large Files · Offline / PWA · End-to-End Test Suite

> **Phase 5 goal:** Make the app fast, resilient, and verifiably correct.
> Phases 1–4 built and polished all screens. Phase 5 makes them production-ready:
> profiled, optimised, stress-tested against large files, hardened for offline use,
> and covered by an automated E2E test suite.
> No new UI features are added in this phase.

---

## Where We Are After Phase 4

All visual polish is complete. The app is functionally correct and visually
consistent, but has four open risks that Phase 5 addresses:

| Risk | Symptom | Phase 5 Track |
|---|---|---|
| Unknown render cost | No profiling has been done | Track A |
| Large file degradation | No stress tests above a few MB | Track B |
| App fails when offline | No service worker | Track C |
| Zero automated test coverage | All verification has been manual | Track D |

Tracks A–D are largely independent after their shared prerequisite
(Track A · A-1 baseline metrics) is established.

---

## Track A — Performance Profiling + Optimisation

**Goal:** Identify and fix the top render-cost and bundle-size issues.
A-1 (baseline audit) must land first — it determines which A-2/A-3/A-4
tasks are highest priority.

---

### A-1 · Establish baseline metrics

**Owner:** Bob  
**Files:** `docs/perf-baseline.md` (new)

Run a full performance audit before touching any code:

- Bundle size analysis via `vite-bundle-visualizer` (or equivalent)
- React DevTools Profiler flamegraph on FilesPanel + MessageList + FileViewerModal
- IndexedDB query timing for `searchLocalIndex()` on a 500-file corpus
- Lighthouse score (Performance, Accessibility, Best Practices, SEO)

Record all results in `docs/perf-baseline.md`. This document gates the
priority order for A-2 through A-4.

**Acceptance criteria:**
- [ ] `docs/perf-baseline.md` committed with bundle sizes, component render costs, and Lighthouse scores
- [ ] Top 3 render hotspots identified and documented
- [ ] IndexedDB search latency measured at p50 / p95 / p99

---

### A-2 · Bundle size optimisation

**Owner:** Bob  
**Files:** `vite.config.ts`, `package.json`, affected components

Based on A-1 findings:

- Code-split FileViewerModal and all viewer components (`CsvTableView`, `JsonTreeView`, `OcrImageView`, `MarkdownView`, `CsvChartPanel`) behind `React.lazy` + `Suspense`
- Audit Chart.js import — use tree-shakeable ESM imports only (`import { Chart, BarController, … } from 'chart.js'`)
- Move any large static assets (icons, fonts) to `public/` and load via URL instead of bundling
- Target: main bundle ≤ 150 KB gzipped

**Acceptance criteria:**
- [ ] FileViewerModal and all viewer components are lazy-loaded
- [ ] Chart.js bundle contribution reduced by ≥ 30% vs. baseline
- [ ] Main bundle ≤ 150 KB gzipped
- [ ] No functional regressions

---

### A-3 · React render optimisation

**Owner:** Alice  
**Files:** `src/components/MessageList.tsx`, `src/components/FilesPanel.tsx`, `src/lib/fileIndex.ts`

Based on A-1 flamegraph findings:

- Wrap `MessageList` and `FileRootCard` in `React.memo` with shallow-equality checks
- Replace any context values that change on every render with stable refs or split contexts
- Memoize `searchLocalIndex` results with `useMemo` keyed on query string
- Audit `useFiles` hook — ensure `roots`, `progress`, and `error` are stable references between renders

**Acceptance criteria:**
- [ ] MessageList re-renders only when `messages` array reference changes
- [ ] FilesPanel re-renders only when `roots` or `isIndexing` change
- [ ] No unnecessary re-renders visible in React DevTools Profiler after fix

---

### A-4 · IndexedDB query optimisation

**Owner:** Alice  
**Files:** `src/lib/fileIndex.ts`, `src/lib/search.ts`

- Add a compound index on `(rootId, lastModified)` in the file-index store
- Implement cursor-based pagination in `searchLocalIndex()` — return a `nextCursor` so callers can page results instead of loading all matches
- Cache the last 5 search queries in memory (LRU, keyed by query + limit); invalidate on any `indexFile()` call

**Acceptance criteria:**
- [ ] p95 search latency ≤ 50 ms on a 500-file corpus (measured in test harness)
- [ ] `searchLocalIndex` accepts `cursor` param and returns `{ results, nextCursor }`
- [ ] LRU cache hit rate ≥ 80% in simulated repeated-query scenario

---

## Track B — Large File Handling

**Goal:** The app must remain responsive when processing files ≥ 10 MB
and tables with ≥ 50 000 rows. Track B items are independent.

---

### B-1 · Streaming PDF ingest

**Owner:** Bob  
**Files:** `src/lib/pdfIngestion.ts`

The current `ingestPdfAsMarkdown()` loads the entire file into memory before
processing. For large PDFs (50+ pages / 20+ MB) this causes a UI freeze.

- Process pages in batches of 10 using an async generator
- Emit progress events via a callback so `IngestDropZone` can show per-page progress
- Abort mid-ingest if the component unmounts (use `AbortSignal`)

**Acceptance criteria:**
- [ ] A 50-page, 20 MB PDF ingests without freezing the UI thread
- [ ] IngestDropZone shows page-level progress (`Page 12 / 50`)
- [ ] Aborted ingests do not leave partial records in IndexedDB

---

### B-2 · CSV streaming + chunked indexing

**Owner:** Alice  
**Files:** `src/lib/csvIngestion.ts`, `src/lib/fileIndex.ts`

The current `ingestCsv()` parses the entire file synchronously. For CSVs
with ≥ 50 000 rows this blocks the main thread.

- Use `FileReader.readAsText` in 64 KB chunks with a streaming CSV parser
- Index chunks incrementally — write each 1 000-row chunk to IndexedDB
  as a separate record rather than one giant blob
- Cap in-memory row buffer at 5 000 rows; older rows are evicted once indexed

**Acceptance criteria:**
- [ ] A 100 000-row CSV ingests without a UI freeze
- [ ] IngestDropZone shows row-count progress (`12 400 / 100 000 rows`)
- [ ] `CsvTableView` virtual scroll works correctly against chunked records

---

### B-3 · Virtual scroll stress test + fix

**Owner:** Bob  
**Files:** `src/components/CsvTableView.tsx`

Verify `@tanstack/react-virtual` performs correctly at scale and fix any
issues found:

- Render a 100 000-row, 20-column table and profile frame rate
- Ensure column widths are stable (no reflow on scroll)
- Fix overscan value — current default may cause blank rows on fast scroll
- Add a "Jump to row" input that scrolls the virtual list to an arbitrary row index

**Acceptance criteria:**
- [ ] 100 000-row table maintains ≥ 55 fps on scroll on a mid-range device
- [ ] No blank rows visible during fast scroll
- [ ] "Jump to row" input works correctly

---

### B-4 · Large image OCR progress + memory guard

**Owner:** Alice  
**Files:** `src/lib/ocr.ts`, `src/components/IngestDropZone.tsx`

Images > 8 MP can cause the OCR engine to exhaust memory. Add guards:

- Reject images > 20 MB with a clear user-facing error before OCR starts
- For images 5–20 MB, downsample to 2× display resolution before OCR
- Emit progress events from `ingestImageAsMarkdown()` (0 → 1.0 float) so
  `IngestDropZone` can show a determinate progress bar

**Acceptance criteria:**
- [ ] Images > 20 MB are rejected with a clear error message before OCR runs
- [ ] Images 5–20 MB are downsampled without visible quality loss in OCR output
- [ ] IngestDropZone shows a progress bar during OCR

---

## Track C — Offline / PWA Hardening

**Goal:** The app must be usable without a network connection after first load.
All file content is already stored in IndexedDB — the missing piece is the
service worker and manifest.

---

### C-1 · Vite PWA plugin + service worker

**Owner:** Bob  
**Files:** `vite.config.ts`, `public/sw.js` (generated), `public/manifest.webmanifest`

- Add `vite-plugin-pwa` to the build pipeline
- Configure a Workbox `StaleWhileRevalidate` strategy for all app shell assets
- Configure `NetworkFirst` for any external API calls (LLM endpoints)
- Add `manifest.webmanifest` with correct `name`, `short_name`, `icons`, `theme_color`

**Acceptance criteria:**
- [ ] App loads fully offline after first visit (Chrome DevTools offline mode)
- [ ] Service worker updates silently in the background and activates on next load
- [ ] `manifest.webmanifest` passes Lighthouse PWA audit

---

### C-2 · Offline fallback screens

**Owner:** Alice  
**Files:** `src/components/OfflineBanner.tsx` (new), `src/hooks/useNetworkStatus.ts` (new)

- Implement `useNetworkStatus()` hook using `navigator.onLine` + `online`/`offline` events
- Render `OfflineBanner` at the top of the app shell when offline:
  - Banner text: "You're offline — file search and viewing still work"
  - LLM send button is disabled when offline with tooltip: "Requires internet connection"
- When a network request fails due to offline status, show a toast with a retry button

**Acceptance criteria:**
- [ ] Banner appears within 200 ms of going offline
- [ ] Banner disappears within 200 ms of coming back online
- [ ] LLM send is disabled and clearly labelled when offline
- [ ] All IndexedDB-backed features (file search, viewer) work fully offline

---

### C-3 · IndexedDB persistence + storage quota guard

**Owner:** Bob  
**Files:** `src/lib/fileIndex.ts`, `src/components/FilesPanel.tsx`

- Call `navigator.storage.persist()` on first launch to request durable storage
- Query `navigator.storage.estimate()` and surface usage in FilesPanel:
  `Using 24 MB of 512 MB` with a thin progress bar
- If estimated usage > 80% of quota, show a warning with suggested actions
  (remove unused roots, re-index to deduplicate)

**Acceptance criteria:**
- [ ] `persist()` is called once and result stored in `localStorage`
- [ ] Storage usage shown in FilesPanel (updates on index/remove)
- [ ] Warning shown when usage > 80% of quota

---

## Track D — End-to-End Test Suite

**Goal:** All critical user journeys covered by automated tests that run in CI.
Track D is the highest-risk track — it requires the most setup but provides
the biggest quality safety net for all future phases.

---

### D-1 · Test framework setup

**Owner:** Bob  
**Files:** `package.json`, `playwright.config.ts` (new), `tests/` (new directory)

- Add Playwright as the E2E testing framework
- Add Vitest + `@testing-library/react` for unit/integration tests
- Configure a `test` script in `package.json` that runs both Vitest (unit) and Playwright (E2E)
- Add a GitHub Actions workflow `.github/workflows/ci.yml` that runs `npm test` on every push and PR

**Acceptance criteria:**
- [ ] `npm test` runs unit tests + E2E tests in sequence
- [ ] GitHub Actions CI passes on a clean clone
- [ ] Test run completes in ≤ 5 minutes on the CI runner

---

### D-2 · CSV ingest + search unit tests

**Owner:** Alice  
**Files:** `tests/unit/csvIngestion.test.ts` (new), `tests/unit/search.test.ts` (new)

Write Vitest unit tests for:

**`csvIngestion.test.ts`**
- Empty file → error
- Single-row header only → 0 data rows, correct columns
- 1 000-row CSV → correct `rowCount`, `columns`, `chunkText`
- RFC 4180 edge cases: quoted commas, embedded newlines, escaped quotes
- Malformed CSV (unclosed quote) → graceful error, not a crash

**`search.test.ts`**
- Exact match returns score 1.0
- Partial match returns score > 0 and < 1
- No match returns empty results
- Query with 0 results does not throw
- Pagination: cursor advances correctly across pages

**Acceptance criteria:**
- [ ] ≥ 15 unit tests covering the above cases
- [ ] All tests pass on `npm test`
- [ ] Code coverage ≥ 80% on `csvIngestion.ts` and `search.ts`

---

### D-3 · File ingest E2E tests

**Owner:** Bob  
**Files:** `tests/e2e/ingest.spec.ts` (new), `tests/fixtures/` (new)

Write Playwright E2E tests for the full ingest flow:

- Drop a small CSV → file appears in FilesPanel with row/column count
- Drop a small PNG → OCR runs → file appears in FilesPanel with word count
- Drop an unsupported file type → error message shown, file not added
- Re-index a file → last-indexed timestamp updates

**Fixtures needed:** `tests/fixtures/sample.csv` (100 rows), `tests/fixtures/sample.png`

**Acceptance criteria:**
- [ ] All 4 scenarios pass in Playwright headless Chromium
- [ ] Tests run against `localhost:5173` (Vite dev server started by Playwright global setup)
- [ ] Flake rate < 2% across 50 consecutive runs

---

### D-4 · Chat flow E2E tests

**Owner:** Alice  
**Files:** `tests/e2e/chat.spec.ts` (new)

Write Playwright E2E tests for the core chat flow:

- Empty MessageList shows empty state + 3 prompt chips
- Clicking a prompt chip pre-fills the input
- Sending a message adds a user bubble immediately
- Assistant bubble animates in after response (mock LLM response)
- Sending while offline shows disabled state + tooltip

**Acceptance criteria:**
- [ ] All 5 scenarios pass in headless Chromium
- [ ] LLM calls are intercepted via `page.route()` — no real API calls in tests
- [ ] Tests complete in ≤ 30 seconds total

---

### D-5 · FileViewerModal E2E tests

**Owner:** Alice  
**Files:** `tests/e2e/viewer.spec.ts` (new)

Write Playwright E2E tests for the file viewer:

- Opening a CSV file shows the Table tab with virtual-scrolled rows
- Switching to Charts tab renders at least one chart canvas
- Error boundary: inject a rendering error → error fallback UI appears
- Re-index button in error fallback triggers re-index without page reload
- Modal close animation completes before the modal is removed from the DOM

**Acceptance criteria:**
- [ ] All 5 scenarios pass in headless Chromium
- [ ] Error injection done via `page.addScriptTag()` — no source changes needed
- [ ] Flake rate < 2% across 50 consecutive runs

---

## Build Order

```
Track A (perf baseline first — gates priority order)
  └── A-1 · Baseline metrics                  [Bob]   ← do first
  └── A-2 · Bundle size optimisation           [Bob]   ← after A-1
  └── A-3 · React render optimisation          [Alice] ← after A-1
  └── A-4 · IndexedDB query optimisation       [Alice] ← after A-1

Track B (large file handling — independent)
  └── B-1 · Streaming PDF ingest              [Bob]
  └── B-2 · CSV streaming + chunked indexing  [Alice]
  └── B-3 · Virtual scroll stress test        [Bob]
  └── B-4 · Large image OCR + memory guard    [Alice]

Track C (offline / PWA — independent)
  └── C-1 · Vite PWA plugin + service worker  [Bob]
  └── C-2 · Offline fallback screens          [Alice]
  └── C-3 · IndexedDB persistence + quota     [Bob]

Track D (test suite — can start in parallel with A-1)
  └── D-1 · Test framework setup              [Bob]   ← do early
  └── D-2 · CSV ingest + search unit tests    [Alice] ← after D-1
  └── D-3 · File ingest E2E tests             [Bob]   ← after D-1
  └── D-4 · Chat flow E2E tests               [Alice] ← after D-1
  └── D-5 · FileViewerModal E2E tests         [Alice] ← after D-1
```

---

## Task Summary

| Task | Track | Owner | Depends On |
|---|---|---|---|
| A-1 · Baseline metrics | Perf | Bob | — |
| A-2 · Bundle optimisation | Perf | Bob | A-1 |
| A-3 · React render optimisation | Perf | Alice | A-1 |
| A-4 · IndexedDB query optimisation | Perf | Alice | A-1 |
| B-1 · Streaming PDF ingest | Large files | Bob | — |
| B-2 · CSV streaming + chunked indexing | Large files | Alice | — |
| B-3 · Virtual scroll stress test | Large files | Bob | — |
| B-4 · Large image OCR guard | Large files | Alice | — |
| C-1 · PWA service worker | Offline | Bob | — |
| C-2 · Offline fallback screens | Offline | Alice | — |
| C-3 · IndexedDB quota guard | Offline | Bob | — |
| D-1 · Test framework setup | Testing | Bob | — |
| D-2 · CSV + search unit tests | Testing | Alice | D-1 |
| D-3 · File ingest E2E | Testing | Bob | D-1 |
| D-4 · Chat flow E2E | Testing | Alice | D-1 |
| D-5 · FileViewerModal E2E | Testing | Alice | D-1 |

**Alice: A-3, A-4, B-2, B-4, C-2, D-2, D-4, D-5 (8 tasks)**  
**Bob: A-1, A-2, B-1, B-3, C-1, C-3, D-1, D-3 (8 tasks)**

---

## Acceptance Criteria — Phase 5 Complete

- [ ] Main bundle ≤ 150 KB gzipped; all viewer components lazy-loaded
- [ ] No UI thread freeze on a 50-page PDF, 100 000-row CSV, or 10 MP image
- [ ] Virtual scroll ≥ 55 fps on 100 000-row table on mid-range device
- [ ] App loads fully offline after first visit
- [ ] Storage usage visible in FilesPanel; quota warning at 80%
- [ ] `npm test` passes: ≥ 15 unit tests + 14 E2E scenarios
- [ ] CI green on every push and PR
- [ ] No regressions in any Phase 1–4 functionality

---

## What Phase 5 Is NOT

- Not new UI features — no new screens, components, or file type support
- Not a redesign — Phase 4 locked the visual design
- Not a backend — all processing remains client-side

---

## Phase 6 Preview (Not Specced Here)

Phase 6 will cover:
- Multi-session management (sidebar with session history)
- Collaborative features (shared chat export, shareable file links)
- Plugin / extension API (third-party ingestors and viewers)
- Accessibility audit + WCAG 2.1 AA compliance pass

---

*Roadmap authored: 2026-04-26 · Alice (alice.mmcp) · Studio-OS-Chat*
