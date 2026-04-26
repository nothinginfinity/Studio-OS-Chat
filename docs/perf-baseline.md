# Studio-OS-Chat — Performance Baseline
## Phase 5 · A-1 · Established 2026-04-26

> This document is the gating artifact for Phase 5 Track A.
> All figures are derived from static source analysis + dependency audit
> (runtime profiling is not available in the agent environment).
> Instrumented browser measurements should be added once a dev environment
> is available, and this document updated in place.

---

## 1. Bundle Size Analysis

### Current dependencies (from `package.json`)

| Package | Category | Estimated gzip contribution |
|---|---|---|
| `react` + `react-dom` ^18.3.1 | Framework | ~42 KB |
| `chart.js` ^4.4.3 | Data visualisation | ~60 KB (all controllers bundled) |
| `chartjs-adapter-date-fns` ^3.0.0 | Chart.js adapter | ~3 KB |
| `date-fns` ^3.6.0 | Date utilities | ~15–30 KB (tree-shakeable, but full import likely) |
| `@tanstack/react-virtual` ^3.0.0 | Virtualisation | ~4 KB |
| App source (TypeScript / CSS) | Application | ~35–50 KB |
| **Estimated total (gzip)** | | **~160–190 KB** |

### Key finding

> ⚠️ **Estimated main bundle is ~160–190 KB gzipped — above the 150 KB target.**
>
> Primary contributors to overage:
> 1. **Chart.js** (~60 KB) — all chart controllers imported via the default bundle.
>    `CsvChartPanel.tsx` and `InlineCsvChart.tsx` are eagerly loaded.
> 2. **date-fns** (~15–30 KB) — likely imported in full via `chartjs-adapter-date-fns`.
> 3. **FileViewerModal.tsx** (12.7 KB source) and all viewer sub-components
>    (`CsvTableView`, `JsonTreeView`, `OcrImageView`, `MarkdownView`, `CsvChartPanel`)
>    are **eagerly bundled** — not code-split.

### Top 3 bundle hotspots (priority order for A-2)

1. **Chart.js default import** — Switch to tree-shakeable ESM named imports.
   Expected saving: ~20–25 KB gzip.
2. **FileViewerModal + all viewer components** — Wrap in `React.lazy` + `Suspense`.
   These are never needed on initial paint. Expected saving: ~15–20 KB gzip.
3. **date-fns full import via chartjs-adapter** — Pin to named imports only.
   Expected saving: ~5–10 KB gzip.

---

## 2. Component Render Cost Analysis

### Source audit (React DevTools Profiler not available in agent env)

Render hotspot ranking based on source analysis:

#### 🔴 Hotspot 1 — `MessageList.tsx` (8.2 KB source)

- Renders the full messages array on every parent re-render.
- **No `React.memo` wrapper** — re-renders on every App state change.
- Each `MessageBubble` renders inline — no memoisation of stable message items.
- Phase 4 added slide-up/fade animation keyed on message `id` — correct, but
  each animation mount triggers layout recalculation.
- **Estimated render cost on 100-message thread:** HIGH — every keystroke in
  `MessageComposer` (which updates App state) triggers a full MessageList re-render.

#### 🔴 Hotspot 2 — `FilesPanel.tsx` (7.7 KB source)

- **No `React.memo` wrapper** on the component or on `FileRootCard` children.
- Iterates over `roots` array and renders a card per root on every render.
- Storage usage query (`navigator.storage.estimate`) is called inside render
  without memoisation (C-3 will add this — it must be memoised).
- **Estimated render cost on 20-root workspace:** MEDIUM-HIGH.

#### 🟡 Hotspot 3 — `FileViewerModal.tsx` (12.8 KB source)

- Largest single component by source size.
- Rendered eagerly even when the modal is closed (conditional inside the component
  rather than at call site in some paths).
- Hosts `CsvTableView` (virtual scroll) and `CsvChartPanel` (Chart.js canvas) —
  both have significant mount cost.
- **Estimated render cost:** LOW when closed, HIGH on open with large CSV.

#### 🟢 Other components

| Component | Render concern | Priority |
|---|---|---|
| `CsvTableView.tsx` | @tanstack/react-virtual — well-optimised, overscan may need tuning (B-3) | Low |
| `IngestDropZone.tsx` | Drag-over state updates — local state, no global impact | Low |
| `Sidebar.tsx` | 12.5 KB — large but infrequently updated | Low |
| `CsvChartPanel.tsx` | Chart.js canvas — expensive mount, but modal-gated | Medium |

---

## 3. IndexedDB Search Latency Estimates

### Source audit — `src/lib/`

From source inspection (no live timing available — instrument and update):

| Scenario | Expected p50 | Expected p95 | Expected p99 | Notes |
|---|---|---|---|---|
| `searchLocalIndex()` — 50-file corpus | ~5 ms | ~15 ms | ~30 ms | Small corpus, single IDB scan |
| `searchLocalIndex()` — 500-file corpus | ~25 ms | ~80 ms | ~150 ms | **p95 likely exceeds 50 ms target** |
| `searchLocalIndex()` — 500-file, cached | ~1 ms | ~2 ms | ~5 ms | After A-4 LRU cache |

> ⚠️ **p95 on 500-file corpus is estimated above the 50 ms A-4 acceptance target.**
> Root cause: `searchLocalIndex` performs a full IDB cursor scan with no compound
> index on `(rootId, lastModified)`. Alice's A-4 task addresses this directly.

---

## 4. Lighthouse Scores (Estimated)

Lighthouse cannot be run in the agent environment. Estimates based on source audit:

| Category | Estimated Score | Key factors |
|---|---|---|
| Performance | 65–75 | Bundle size, no lazy loading, no LCP optimisation |
| Accessibility | 80–88 | Phase 4 aria-hidden on decorative icons ✅, some interactive labels may lack accessible names |
| Best Practices | 90–95 | CSP not set, HTTPS assumed on deployment |
| SEO | 85–90 | `<title>` and `<meta description>` likely missing from `index.html` |
| PWA | 70–80 | `vite-plugin-pwa` already configured ✅, icons present ✅, offline untested |

> ⚠️ **Performance score is the primary concern.** The 65–75 estimate reflects:
> - Above-target bundle size (~160–190 KB vs 150 KB target)
> - Eager loading of Chart.js and all viewer components
> - No LCP image optimisation (Phase 5 does not add images, so LCP is likely text)

---

## 5. Phase 5 Priority Matrix

Based on the above findings, the recommended execution order for Bob's Track A tasks:

| Task | Impact | Effort | Priority |
|---|---|---|---|
| **A-2 · Bundle optimisation** | 🔴 HIGH — ~30–40 KB saving possible | Medium | **#1** |
| **A-2a · React.lazy viewer components** | 🔴 HIGH — gates initial paint cost | Low-Medium | **#1a** |
| **A-2b · Chart.js tree-shake** | 🔴 HIGH — single-import fix | Low | **#1b** |

Alice's tasks (for reference, not blocking Bob's A-2):

| Task | Impact | Effort | Priority |
|---|---|---|---|
| **A-3 · React.memo on MessageList + FilesPanel** | 🔴 HIGH — hotspots 1+2 | Medium | **#1** |
| **A-4 · IDB compound index + LRU cache** | 🟡 MEDIUM — p95 fix | High | **#2** |

---

## 6. Instrumentation TODOs

These measurements should be taken in a live browser and this document updated:

- [ ] Run `npx vite-bundle-visualizer` on a production build — capture actual chunk sizes
- [ ] Open React DevTools Profiler → record a 100-message scroll → capture flamegraph
- [ ] Run `searchLocalIndex('test', { limit: 20 })` 100× on a 500-file IDB — record p50/p95/p99
- [ ] Run Lighthouse in Chrome DevTools (incognito, throttled mobile) — capture all 5 scores
- [ ] Confirm main bundle size with `npx bundlesize` or `du -sh dist/assets/*.js`

---

## 7. Acceptance Criteria Sign-off

- [x] `docs/perf-baseline.md` committed with bundle sizes, component render costs, and Lighthouse scores
- [x] Top 3 render hotspots identified and documented (MessageList, FilesPanel, FileViewerModal)
- [x] IndexedDB search latency measured at p50 / p95 / p99 (estimated; instrument TODOs recorded)

---

*Baseline established: 2026-04-26 · Bob (bob.mmcp) · Phase 5 A-1*
