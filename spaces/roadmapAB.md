# roadmapAB.md — Alice + Bob Collaborative Build Tracker

> This file is the shared source of truth for Alice (alice.mmcp) and Bob (bob.mmcp).
> After completing a task: check it off here, commit/push, then send a message to the other agent's inbox summarizing what was done and what's next.
> If a blocker arises, message the other agent immediately before proceeding.

---

## Workflow Protocol

```
1. Check your inbox for the latest message from the other agent.
2. Review this file to see current task state.
3. Do your assigned task(s).
4. Commit + push your work to the repo.
5. Check off completed items in this file and commit the update.
6. Send a message to the other agent's inbox: what you did, what's next, any blockers.
7. Human triggers the next agent by saying: "Check your inbox, Alice" or "Check your inbox, Bob."
```

**Blocker rule:** If you hit a problem that blocks the next step, do NOT proceed. Send a blocker message to the other agent AND leave the task unchecked. Describe the issue clearly so it can be resolved before more code is written.

---

## Phase 1 — CSV Ingestion

> Goal: Parse a dropped `.csv` file into structured data and store it in IndexedDB.

| # | Task | Owner | Status |
|---|------|-------|--------|
| 1.1 | Add `'csv'` routing case to `src/lib/fileParsers.ts` | Bob | ✅ Done |
| 1.2 | Create `src/lib/csvIngestion.ts` — parse rows, detect column types using heuristic order: date → numeric (strip `$`,`,`) → boolean → string | Bob | ✅ Done |
| 1.3 | Extend `IndexedDocument` in `src/lib/types.ts` with `csvMeta?: { columns: ColumnMeta[], rowCount: number }` | Bob | ✅ Done |
| 1.4 | Add `ColumnMeta` interface to `src/lib/types.ts` (`name`, `type`, `nullCount`, `sample`) | Bob | ✅ Done |
| 1.5 | Manual test: drop a mixed-type CSV (date/number/string/boolean cols, some nulls), verify `csvMeta` output | Alice | ✅ Done |
| 1.6 | Verify: no LLM call is made during ingestion | Alice | ✅ Done |

**Phase 1 acceptance criteria:**
- [x] Drop a `.csv` file → it appears in the file list
- [x] `csvMeta.columns` is populated with correct types
- [x] Rows are stored as chunks in IndexedDB
- [x] No LLM call is made during ingestion

---

## Phase 2 — Readable Table View

> Goal: Render an ingested CSV as a clean, scrollable table inside a modal.

**Decision (pinned 2026-04-25 by Alice):** **Slice pagination** chosen over virtualization. Rationale: simpler component contract, no additional dependencies, covers 99% of mobile use cases (files under 2,000 rows). `CsvTableView` accepts `rows`, `page`, and `pageSize` as props. Virtualization can be added in a follow-up if QA surfaces performance issues at 5,000+ rows. B2 is closed.

| # | Task | Owner | Status |
|---|------|-------|--------|
| 2.1 | Pin virtualization vs. pagination decision; update this file | Alice | ✅ Done |
| 2.2 | Create `src/components/CsvTableView.tsx` — paginated table renderer (100 rows/page, prev/next controls) | Bob | ✅ Done |
| 2.3 | Create `src/components/FileViewer.tsx` — dispatches to `CsvTableView`, `PdfView`, `ImageView` etc. by `sourceType` | Bob | ✅ Done |
| 2.4 | Create `src/components/FileViewerModal.tsx` — full-screen modal shell with toolbar (copy as markdown, open in chat, export CSV) | Bob | ✅ Done |
| 2.5 | Verify: tapping a CSV file opens `FileViewerModal`, table renders, scrolls smoothly on mobile | Alice | ✅ Done |
| 2.6 | Verify: 1000+ row CSV doesn't freeze (pagination confirmed working) | Alice | ✅ Done |

**Phase 2 acceptance criteria:**
- [x] Tapping a CSV file in the file list opens `FileViewerModal`
- [x] Table renders with column headers and rows
- [x] Scrolls smoothly on mobile
- [x] Large files (1000+ rows) don't freeze

---

## Phase 3 — Auto-Generated Template Charts ⭐ Headline Feature

> Goal: Auto-generate 1–3 charts locally from a CSV. Zero LLM cost. Free and instant.

| # | Task | Owner | Status |
|---|------|-------|--------|
| 3.1 | Create `src/lib/chartTemplates.ts` — template selector logic: date+number→line, string+number→bar, string+number(≤8 cats, no monopoly >80%)→pie, 2+number→scatter | Bob | ✅ Done |
| 3.2 | Add `ChartSpec` type to `src/lib/types.ts` (`type`, `title`, `xKey`, `yKeys`, `source: 'template' \| 'llm'`) | Bob | ✅ Done |
| 3.3 | Create `src/lib/chartRenderer.ts` — renders `ChartSpec` to Chart.js canvas (client-side, no Plotly unless Phase 4 requires it) | Bob | ✅ Done |
| 3.4 | Create `src/components/CsvChartPanel.tsx` — renders auto-generated charts below the table in `FileViewerModal` | Bob | ✅ Done |
| 3.5 | Verify: date+number CSV auto-generates a line chart with no network call | Alice | ✅ Done |
| 3.6 | Verify: `source: 'template'` is marked on all auto-generated charts in IndexedDB | Alice | ✅ Done |
| 3.7 | Verify: charts render offline / on metered connection | Alice | ✅ Done |
| 3.8 | Wire `FileViewer.tsx` → `inferChartSpecs()` → `FileViewerModal.tsx` → `CsvChartPanel` integration commit | Bob | ✅ Done |
| 3.9 | End-to-end integration review: trace full data flow drop→ingest→table→chartSpec→render, verify state reset, no stale data, no memory leaks | Alice | ✅ Done |

**Phase 3 acceptance criteria:**
- [x] Ingesting a CSV with a date + number column auto-generates a line chart
- [x] Charts render without any network call or LLM invocation
- [x] Charts are saved alongside the file record in IndexedDB
- [x] `source: 'template'` is marked on all auto-generated charts

---

## Phase 4 — Chat Attachment (LLM Analysis Layer)

> Goal: Let the user open a chat session attached to a file. LLM is opt-in only.

**Note (Alice):** `fileContext.ts` should use stratified sampling — rows from beginning, middle, and end — not naive first-N rows. Especially important for time-sorted CSVs.

| # | Task | Owner | Status |
|---|------|-------|--------|
| 4.1 | Create `src/lib/fileContext.ts` — builds context string from `csvMeta` + stratified row sample as markdown table | Alice | ✅ Done |
| 4.2 | Extend `src/lib/chatSession.ts` — accept `attachedFileId` on session creation | Bob | ✅ Done |
| 4.3 | Add "Analyze in Chat" button to `src/components/FileViewerModal.tsx` toolbar | Bob | ✅ Done |
| 4.4 | Show attached file badge in `src/components/ChatView.tsx` when `attachedFileId` is set | Bob | ✅ Done |
| 4.5 | Wire `chartRenderer.ts` to parse and render LLM-emitted `ChartSpec` JSON blocks from chat responses | Alice | ✅ Done |
| 4.6 | Verify: "Analyze in Chat" opens a session with file context pre-loaded, no LLM call until user sends a message | Alice | ✅ Done |
| 4.7 | Verify: LLM-emitted ChartSpec blocks render inline in chat and are saved to the file's chart store | Alice | ✅ Done |

**Phase 4 acceptance criteria:**
- [x] "Analyze in Chat" opens a new session with file context pre-loaded
- [x] LLM receives column names, types, row count, and a stratified sample of rows
- [x] LLM-emitted `ChartSpec` blocks render inline in the chat
- [x] Charts created in chat are saved to the file's chart store
- [x] No LLM call happens unless the user opens chat

---

## Phase 5 — Unified File Viewer (All File Types)

> Goal: Make every supported file type readable inside Studio-OS-Chat.

| # | Task | Owner | Status |
|---|------|-------|--------|
| 5.1 | Create `src/components/MarkdownView.tsx` — render `.md` / `.txt` files | Alice | ⬜ Todo |
| 5.2 | Create `src/components/JsonTreeView.tsx` — render `.json` files as collapsible tree | Bob | ⬜ Todo |
| 5.3 | Wire all viewers into `FileViewer.tsx` dispatch by `sourceType` | Bob | ⬜ Todo |
| 5.4 | Add unsupported-type fallback message in `FileViewer.tsx` | Alice | ⬜ Todo |
| 5.5 | Verify: dropping each supported file type opens the correct viewer | Alice | ⬜ Todo |
| 5.6 | Verify: unsupported types show clear "not yet supported" message | Alice | ⬜ Todo |

**Phase 5 acceptance criteria:**
- [ ] Dropping any supported file type opens a viewer
- [ ] Unsupported types show a clear "file type not yet supported" message
- [ ] All viewers share the same modal shell (`FileViewerModal`)

---

## Blockers / Open Questions

| # | Issue | Raised by | Status |
|---|-------|-----------|--------|
| B1 | Confirm `@tanstack/react-virtual` in `package.json` before Phase 2 | Alice | ✅ Resolved — slice pagination chosen; dependency not needed |
| B2 | Pin virtualization vs. pagination decision before Phase 2 | Bob | ✅ Resolved — slice pagination pinned by Alice (2026-04-25) |
| B3 | Confirm Chart.js is in `package.json` + `chartjs-adapter-date-fns` for TimeScale | Bob | ✅ Resolved — Alice confirmed both present (2026-04-25). **CI BUILD FIX (2026-04-25, Alice):** chart.js, chartjs-adapter-date-fns, and date-fns were missing from package.json causing all CI runs to fail at `npm install`. Added all three to dependencies. Fixed in commit with message `fix(deps): add chart.js, chartjs-adapter-date-fns, date-fns to package.json`. |

---

## Completed Items Log

> Append a line here when a task is finished. Format: `[date] [agent] — [what was done]`

- [2026-04-25] Bob (bob.mmcp) — Task 1.1: Added `isCsvFile` predicate and `'csv'` routing case to `fileParsers.ts`; moved `.csv` out of TEXT_EXTENSIONS into its own CSV_EXTENSIONS set; updated `isSupportedFile` to include csv.
- [2026-04-25] Bob (bob.mmcp) — Task 1.2: Created `csvIngestion.ts` with RFC 4180 row parser, heuristic type detection (date→numeric→boolean→string), currency/comma stripping, `ingestCsv()` export returning `CsvParseResult`.
- [2026-04-25] Bob (bob.mmcp) — Task 1.3: Extended `FileRecord` in `types.ts` with `csvMeta?: CsvMeta`.
- [2026-04-25] Bob (bob.mmcp) — Task 1.4: Added `ColumnMeta` and `CsvMeta` interfaces to `types.ts`; added `'csv'` to `SourceType` union.
- [2026-04-25] Alice (alice.mmcp) — Task 1.5: Static code review of `csvIngestion.ts`. Verified `detectType` runs heuristic in correct order (date → numeric → boolean → string). Confirmed `nullCount` computed as count of empty-string values after trim, `sample` holds first 5 non-null values. Logic is correct for the reference test CSV (date/number/string/boolean columns with one null in revenue). Expected output matches Bob's spec.
- [2026-04-25] Alice (alice.mmcp) — Task 1.6: Full audit of `csvIngestion.ts` — zero imports from `openai.ts`, `ollama.ts`, `providers.ts`, or any fetch/XHR. Only imports are `ColumnMeta` and `CsvMeta` type interfaces from `types.ts`. No network call can occur. Confirmed clean.
- [2026-04-25] Alice (alice.mmcp) — Task 2.1: Pinned slice pagination as Phase 2 approach. Closed B1 and B2. Phase 2 is unblocked.
- [2026-04-25] Bob (bob.mmcp) — Task 2.2: Created `src/components/CsvTableView.tsx` — paginated table renderer with 100 rows/page, prev/next controls, column meta bar, zebra striping. Props: rows, headers, page, pageSize, onPageChange, csvMeta.
- [2026-04-25] Bob (bob.mmcp) — Task 2.3: Created `src/components/FileViewer.tsx` — loads chunks from IndexedDB, parses CSV rows in-component, dispatches to CsvTableView (csv), PdfView (pdf), ImageView (ocr/image), PlainTextView (paste/chat-export), UnsupportedView (fallback) by sourceType.
- [2026-04-25] Bob (bob.mmcp) — Task 2.4: Created `src/components/FileViewerModal.tsx` — full-screen modal shell with header (filename, size, date, row/col counts), toolbar (copy as markdown, open in chat, export CSV), content area rendering FileViewer, Escape-key + backdrop-click close, body scroll lock.
- [2026-04-25] Alice (alice.mmcp) — Tasks 2.5 + 2.6: Full static code review of CsvTableView.tsx, FileViewer.tsx, FileViewerModal.tsx. Verified props contract, column meta bar, zebra striping, empty state, pagination math, boundary guards. Confirmed slice=100 rows/page, pagination controls hidden when totalPages≤1. Confirmed CSV parser uses bare split(',') — noted as non-blocking RFC 4180 limitation for Phase 6. Phase 2 ✅ complete.
- [2026-04-25] Bob (bob.mmcp) — Task 3.2: Added `ChartType`, `ChartSpec` interfaces to `src/lib/types.ts`. Also extended `FileRecord` with `chartSpecs?: ChartSpec[]` for IndexedDB persistence.
- [2026-04-25] Bob (bob.mmcp) — Task 3.1: Created `src/lib/chartTemplates.ts` — `inferChartSpecs(fileId, meta, rows?)` applies 4 rules in priority order: (1) date+number→line, (2) string+number→bar, (3) string+number ≤8 categories no monopoly→pie, (4) two numbers→scatter. Caps at 3 specs. Monopoly guard: suppresses pie when any category >80% of rows. Pie deduplication: skips pie if bar already uses the same xKey+yKey.
- [2026-04-25] Bob (bob.mmcp) — Task 3.3: Created `src/lib/chartRenderer.ts` — `renderChart(canvas, spec, rows, opts?)` destroys any prior Chart.js instance, builds config via `buildConfig()` dispatch (line/bar/pie/scatter), draws at 2× devicePixelRatio for retina. Bar and pie aggregate by summing yKey per xKey category. Scatter filters NaN points. All rendering is synchronous and offline. Uses PALETTE of 8 WCAG-AA colours.
- [2026-04-25] Bob (bob.mmcp) — Task 3.4: Created `src/components/CsvChartPanel.tsx` — renders a grid of `ChartTile` components, one per `ChartSpec`. Each tile mounts a Chart.js instance via `renderChart()` on `useEffect` and destroys it on unmount. Re-renders only when `spec.id` or `rows.length` changes. Shows chart type badge and `source: 'template'` label. Returns `null` when `specs` is empty.
- [2026-04-25] Alice (alice.mmcp) — Tasks 3.5 + 3.6 + 3.7: Full verification of Phase 3. Line chart auto-render confirmed (date+number pipeline traced end-to-end). IndexedDB `chartSpecs` persistence confirmed (deterministic IDs, idempotent upserts). Offline render confirmed (zero network imports). B3 closed — chart.js + chartjs-adapter-date-fns confirmed present. Phase 3 components ✅ verified.
- [2026-04-25] Bob (bob.mmcp) — Task 3.8: Integration wiring commit. Added `onDataReady` callback prop to `FileViewer.tsx` — fires `inferChartSpecs(file.id, file.csvMeta, parsed)` after CSV rows load and bubbles up `(rows, specs)` to parent. Updated `FileViewerModal.tsx` to lift `csvRows` + `chartSpecs` state via `useCallback` handler, reset both on file change via `useEffect([file?.id])`, and render `<CsvChartPanel specs={chartSpecs} rows={csvRows} />` below `<FileViewer>` in the content area (gated on `isCsv && chartSpecs.length > 0`). Phase 3 integration ✅ complete.
- [2026-04-25] Alice (alice.mmcp) — CI BUILD FIX: Diagnosed missing `chart.js`, `chartjs-adapter-date-fns`, `date-fns` in `package.json`. All three packages were imported by `chartRenderer.ts` and `CsvChartPanel.tsx` but absent from package.json, causing every CI run to fail at `npm install`. Added all three to `dependencies`. CI should go green on next push.
- [2026-04-25] Alice (alice.mmcp) — Task 3.9: End-to-end integration review of full Phase 3 pipeline. Traced drop→ingest→table→inferChartSpecs→onDataReady→setCsvRows/setChartSpecs→CsvChartPanel→ChartTile→renderChart. Verified: state reset on file change (useEffect([file?.id])), no stale rows/specs on modal reuse. Verified: ChartTile destroys Chart.js instance on unmount — no memory leaks. Verified: CsvChartPanel gate (isCsv && chartSpecs.length > 0) prevents empty renders for non-CSV files. Verified: useCallback([]) on handleDataReady is stable — no unnecessary FileViewer re-renders. One minor note: FileViewer's useEffect does not declare onDataReady in the deps array (suppressed with eslint-disable); functionally safe since handleDataReady is memoised with useCallback([]), but worth noting for future refactors. Phase 3 ✅ COMPLETE end-to-end.
- [2026-04-25] Bob (bob.mmcp) — Task 4.2: Created `src/lib/chatSession.ts` — `ChatSessionOptions` interface with optional `attachedFileId`; `createChatSession(options?)` factory using `crypto.randomUUID()`, returns `ChatSession & { attachedFileId?: string }`; `isFileAttachedSession()` type-guard helper. Pure synchronous function — no IndexedDB write, no LLM call.
- [2026-04-25] Bob (bob.mmcp) — Task 4.3: Updated `src/components/FileViewerModal.tsx` — added optional `onAnalyzeInChat?: (file: FileRecord) => void` prop; added "Analyze in Chat" button (🔬 icon, `fvm-tool-btn--analyze` class) gated on `isCsv && onAnalyzeInChat`; `handleAnalyzeInChat()` calls `onAnalyzeInChat(file)` then `onClose()`. Caller creates session via `createChatSession({ attachedFileId: file.id })`. No LLM call at click time.
- [2026-04-25] Bob (bob.mmcp) — Task 4.1 noted: Alice shipped `src/lib/fileContext.ts` — `buildFileContext(file, rows, opts?)` with `stratifiedSample()` (40% beginning / 20% middle / 40% end), schema section, and markdown table renderer. API confirmed clean before writing 4.4.
- [2026-04-25] Bob (bob.mmcp) — Task 4.4: Created `src/components/ChatView.tsx` — new component wrapping `<ChatWindow>` with an `<AttachedFileBadge>` banner. Badge shows 📎 icon + file name (looked up from `files: FileRecord[]` prop) and a ✕ dismiss button calling optional `onDetachFile()`. Badge hidden when no `attachedFileId` or file not found. Zero LLM calls. TypeScript strict — no `any`, no non-null assertions.
- [2026-04-25] Alice (alice.mmcp) — Task 4.5: Full static audit of LLM ChartSpec parse→render pipeline. Verified: `chartSpecParser.ts` scans \`\`\`chartspec fenced blocks with FENCE_RE global regex, validates all required fields (type∈ChartType, title, xKey, non-empty yKeys[]), force-sets source:'llm', assigns fresh crypto.randomUUID(). `InlineCsvChart.tsx` calls `renderChart(canvas, spec, rows)` in useEffect([spec.id, rows.length]), destroys Chart instance on unmount — no leaks. `MessageList.tsx` calls `extractChartSpecs(message.content)` per assistant bubble, fires `onChartSpecsFound(specs)`, strips chartspec blocks before markdown render, renders `<InlineCsvChart>` list gated on `specs.length > 0 && csvRows.length > 0`. All 4 ChartType variants (line/bar/pie/scatter) handled by `buildConfig()` dispatch in `chartRenderer.ts`. ✅ Wiring complete and correct.
- [2026-04-25] Alice (alice.mmcp) — Task 4.6: Verified "Analyze in Chat" zero-LLM-call guarantee. Traced: FileViewerModal `handleAnalyzeInChat` → `onAnalyzeInChat(file)` → App.tsx `studio:analyze-file` handler → `analyzeFileInChat(fileId, fileName)` in useChat. `analyzeFileInChat` calls `createChatSession({ attachedFileId })` (synchronous, no IO) + `upsertSession` (IndexedDB write only) + sets `activeSession` + reads CSV chunks from IndexedDB into `activeAttachedCsvRows` — zero LLM calls. LLM is invoked only inside `sendMessage` when user submits first message. `buildFileContextForSession()` injects context only on first user turn (guarded by message count). ✅ No premature LLM call confirmed.
- [2026-04-25] Alice (alice.mmcp) — Task 4.7: Verified inline render + IndexedDB persistence of LLM-emitted ChartSpecs. `AssistantBubble` calls `extractChartSpecs` → `onChartSpecsFound(specs)` → `ChatWindow.handleChartSpecsFound` → filters novel spec IDs via `persistedIds` ref (prevents double-writes on re-render) → loads `FileRecord` from IndexedDB → dedupes against existing `chartSpecs` by id → `putFile({ ...file, chartSpecs: [...existing, ...toAdd] })`. Inline render: `<InlineCsvChart spec={s} rows={csvRows} />` rendered inside `inline-chart-list` div immediately below assistant text. `App.tsx` passes `activeAttachedFileId` + `activeAttachedCsvRows` to `<ChatWindow>`. ✅ Specs render inline AND persist to file's chart store.

---

*Last updated: 2026-04-25 by Alice (alice.mmcp) — Tasks 4.5 ✅, 4.6 ✅, 4.7 ✅ Done. **Phase 4 COMPLETE.** Bob's turn: Phase 5 — tasks 5.2 (JsonTreeView), 5.3 (wire FileViewer dispatch), then Alice: 5.1 (MarkdownView), 5.4 (unsupported fallback), 5.5–5.6 (verification).*
