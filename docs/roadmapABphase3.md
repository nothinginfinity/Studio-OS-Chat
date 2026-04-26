# Studio-OS-Chat — Phase 3 Roadmap
## Wire Everything Up: OCR · Charts · File Viewer · No-LLM Tools

> **Phase 3 goal:** Every tool and lib file already built gets connected to a visible,
> working UI surface. By the end of this phase a user can drop any supported file,
> immediately see it rendered, and get auto-generated charts — all without touching
> an LLM.

---

## Where We Are After Phase 2

The following are **built but not yet wired**:

| Asset | Status | Gap |
|---|---|---|
| `csvIngestion.ts` | ✅ built | Output not surfaced in FileViewerModal |
| `chartTemplates.ts` | ✅ built | Template selector exists, not called on ingest |
| `chartRenderer.ts` | ✅ built | Renderer exists, `CsvChartPanel` is a stub |
| `chartSpecParser.ts` | ✅ built | Parser exists, not hooked into MessageList |
| `CsvChartPanel.tsx` | ⚠️ stub | Renders nothing — no real Chart.js call |
| `CsvTableView.tsx` | ✅ built | Not connected to FileViewerModal dispatch |
| `FileViewer.tsx` | ⚠️ stub | Dispatch logic present but viewers not mounted |
| `FileViewerModal.tsx` | ✅ shell | Toolbar present, body not wired to FileViewer |
| `JsonTreeView.tsx` | ✅ built | Not registered in FileViewer dispatch |
| `MarkdownView.tsx` | ✅ built | Not registered in FileViewer dispatch |
| `ocr.ts` | ✅ built | OCR modes (screenshot/document/code/receipt) exist |
| `IngestDropZone.tsx` | ✅ fixed (FIX-002) | OCR mode selector visible but modes not active |
| `FilesPanel.tsx` | ✅ built | Tap on source row does not open FileViewerModal |

---

## Phase 3 Tracks

Phase 3 is organized into **four tracks** that can be built in parallel once
Track A is done (it provides the wiring foundation the others depend on).

---

### Track A — FileViewer Dispatch (Foundation)
**Prerequisite for all other tracks.**

Connect `FilesPanel` → `FileViewerModal` → `FileViewer` → per-type viewer.

#### A-1 · FilesPanel tap → open FileViewerModal

**File:** `src/components/FilesPanel.tsx`

- Each source row already has an `onPress` / `onClick` handler shell.
- Wire it to open `FileViewerModal` with the tapped `IndexedDocument` as prop.
- Pass `sourceId` and `sourceType` into the modal.

**Acceptance criteria:**
- [ ] Tapping any indexed source row opens the modal
- [ ] Modal receives the correct `sourceId`

---

#### A-2 · FileViewer dispatch by sourceType

**File:** `src/components/FileViewer.tsx`

Current stub has a `switch(sourceType)` with no cases filled in.
Fill in every case:

```ts
switch (doc.sourceType) {
  case 'csv':    return <CsvTableView doc={doc} />
  case 'pdf':    return <PdfView doc={doc} />          // already exists in lib
  case 'image':  return <OcrImageView doc={doc} />     // Track C
  case 'json':   return <JsonTreeView doc={doc} />
  case 'md':
  case 'txt':    return <MarkdownView doc={doc} />
  default:       return <UnsupportedView doc={doc} />  // new, 10-line component
}
```

**New component (5-10 lines):**

`src/components/UnsupportedView.tsx` — shows file icon + "This file type
cannot be previewed yet" + the raw chunk text if available.

**Acceptance criteria:**
- [ ] Each `sourceType` routes to the correct viewer
- [ ] Unknown types show `UnsupportedView` instead of a blank screen

---

#### A-3 · FileViewerModal toolbar wired

**File:** `src/components/FileViewerModal.tsx`

Toolbar actions are rendered but not functional. Wire each one:

| Button | Action |
|---|---|
| **Open in Chat** | Call `createSession({ attachedFileId: doc.id })` then navigate to ChatView |
| **Copy text** | Copy `doc.chunks.join('\n')` to clipboard via `navigator.clipboard.writeText` |
| **Share** | Call `navigator.share({ text: doc.chunks.join('\n'), title: doc.name })` (mobile Web Share API) |
| **Re-index** | Call `reIndexFile(doc.id)` from `useFiles` hook |
| **Remove** | Call `removeSource(doc.id)` from `useFiles` hook, close modal |

**Acceptance criteria:**
- [ ] All five toolbar actions execute without errors
- [ ] "Open in Chat" navigates to a new session with the file context pre-loaded

---

### Track B — CSV Charts (No-LLM Auto Charts)
**Depends on Track A-1 completing (modal must open).**

Wire `chartTemplates.ts` → `chartRenderer.ts` → `CsvChartPanel.tsx` so
charts appear automatically when a CSV is opened.

#### B-1 · Trigger template chart generation on CSV ingest

**File:** `src/lib/csvIngestion.ts`

After parsing and storing `csvMeta`, call `selectTemplates(csvMeta)` from
`chartTemplates.ts` and store the resulting `ChartSpec[]` alongside the
document in IndexedDB under `doc.charts`.

```ts
const specs = selectTemplates(csvMeta)   // already in chartTemplates.ts
await db.sources.update(docId, { charts: specs })
```

**Acceptance criteria:**
- [ ] After CSV ingest, `doc.charts` is populated (1–3 specs depending on column types)
- [ ] No network call is made
- [ ] `source: 'template'` is set on all auto-generated specs

---

#### B-2 · CsvChartPanel renders real charts

**File:** `src/components/CsvChartPanel.tsx`

Currently a stub. Replace with a real Chart.js implementation:

```tsx
// For each ChartSpec in doc.charts:
// 1. Call renderChart(spec, doc.rows) from chartRenderer.ts
// 2. Mount the returned <canvas> or Chart.js component
// 3. Render chart title above each canvas
// 4. Show chart type badge (bar / line / pie / scatter)
```

Use `chart.js` (already in `package.json`) via `react-chartjs-2` wrapper.
Each chart gets its own `<canvas ref>` and a `Chart` instance.

**Chart interactions (mobile-first):**
- Tap a chart → expand to full-screen canvas modal
- Long-press → share as image (`canvas.toBlob()` → `navigator.share`)

**Acceptance criteria:**
- [ ] Opening a CSV with a date + number column shows a line chart
- [ ] Opening a CSV with string + number column shows a bar chart
- [ ] Charts render without any LLM or network call
- [ ] Expanded chart modal works on mobile

---

#### B-3 · CsvChartPanel mounted in FileViewerModal

**File:** `src/components/FileViewerModal.tsx`

Add `<CsvChartPanel doc={doc} />` below the `<CsvTableView>` when
`doc.sourceType === 'csv'` and `doc.charts?.length > 0`.

Add a toggle tab row — **Table | Charts** — so the user can switch views.

**Acceptance criteria:**
- [ ] Tab row appears for CSV files
- [ ] "Charts" tab shows CsvChartPanel
- [ ] "Table" tab shows CsvTableView
- [ ] Default tab is "Table"

---

### Track C — OCR Mode Activation
**Independent — can be built in parallel with B.**

The OCR mode selector (Screenshot / Document / Code / Receipt) is visible
in `IngestDropZone.tsx` but the selected mode is not passed into the OCR
call. This track wires the modes so each one actually affects output.

#### C-1 · Pass OCR mode into ocr.ts

**File:** `src/components/IngestDropZone.tsx`

The active mode is stored in local state (`ocrMode`). Currently the `ingestImage()`
call ignores it. Pass it through:

```ts
await ingestImage(file, { mode: ocrMode })
```

**File:** `src/lib/ocr.ts`

Add `mode` parameter to `ingestImage(file, options)`. Map each mode to the
correct Tesseract / Vision API config:

| Mode | Tesseract PSM | Post-processing |
|---|---|---|
| `screenshot` | PSM 6 (uniform block) | Strip layout artifacts |
| `document` | PSM 3 (auto page layout) | Preserve paragraph breaks |
| `code` | PSM 6 + monospace hint | Preserve indentation, strip soft hyphens |
| `receipt` | PSM 4 (single column) | Extract key:value pairs (merchant, total, date) |

**Acceptance criteria:**
- [ ] Dropping an image in "Code" mode preserves indentation in indexed text
- [ ] Dropping a receipt in "Receipt" mode extracts merchant + total as structured fields
- [ ] Mode selection persists while the drop zone is open (resets on close)

---

#### C-2 · OcrImageView component

**New file:** `src/components/OcrImageView.tsx`

When `FileViewer` dispatches for `sourceType === 'image'`, show:

1. The original image (stored blob URL or base64 from IndexedDB)
2. The extracted OCR text in a scrollable panel below
3. Mode badge showing which OCR mode was used
4. "Re-OCR with different mode" button → mode picker → re-ingest

**Acceptance criteria:**
- [ ] Tapping an image source opens OcrImageView with original image visible
- [ ] OCR text is readable below the image
- [ ] Re-OCR button works and updates the indexed text

---

### Track D — Chart Spec in Chat (LLM → Chart)
**Depends on Track B-2 (chartRenderer must work). Lower priority — build last.**

When an LLM response contains a fenced ` ```chart ` block, parse and render
it as an inline chart inside `MessageList`.

#### D-1 · chartSpecParser hooked into MessageList

**File:** `src/components/MessageList.tsx`

In the message renderer, after Markdown rendering, scan each assistant
message for ` ```chart ` fences. When found:

```ts
const spec = parseChartSpec(fenceContent)   // already in chartSpecParser.ts
if (spec) return <InlineCsvChart spec={spec} rows={attachedDoc?.rows} />
```

**File:** `src/components/InlineCsvChart.tsx` (already exists as stub)

Wire to `renderChart(spec, rows)` from `chartRenderer.ts`.

**Acceptance criteria:**
- [ ] An LLM message containing a valid ` ```chart ` block renders a chart inline
- [ ] Invalid chart JSON shows a friendly parse-error card (not a crash)
- [ ] Works when no file is attached (uses spec data only, no rows needed for simple specs)

---

## Build Order

```
Track A (foundation — do first, unblocks B + C)
  └── A-1 · FilesPanel tap wiring
  └── A-2 · FileViewer dispatch
  └── A-3 · FileViewerModal toolbar

Track B (CSV charts — start after A-1)
  └── B-1 · Chart generation on ingest
  └── B-2 · CsvChartPanel real charts
  └── B-3 · Tab row in FileViewerModal

Track C (OCR modes — independent, parallel with B)
  └── C-1 · Pass mode into ocr.ts
  └── C-2 · OcrImageView

Track D (LLM chart rendering — after B-2)
  └── D-1 · chartSpecParser in MessageList
```

---

## Acceptance Criteria — Phase 3 Complete

- [ ] Tapping any indexed source opens the correct viewer
- [ ] CSV files auto-generate 1–3 charts on ingest, visible in FileViewerModal
- [ ] Charts render with zero LLM calls, zero network calls
- [ ] OCR modes (screenshot / document / code / receipt) produce visibly
      different outputs when tested with appropriate images
- [ ] LLM chart blocks render inline in chat
- [ ] All toolbar actions (open in chat, copy, share, re-index, remove) work
- [ ] No regressions in existing ingest, search, or chat functionality

---

## What Phase 3 Is NOT

- Not UI polish — that is Phase 4
- Not new file types beyond what is already ingested
- Not LLM-assisted chart suggestions — templates only (Track B), LLM rendering is opt-in (Track D)
- Not a charting SaaS — 1–3 auto charts per file, simple types only

---

## Phase 4 Preview (Not Specced Here)

Phase 4 will cover:
- Visual design polish across all screens
- Animation and transition refinements
- Empty states, loading skeletons, and error states
- Typography and spacing consistency pass
- Dark mode audit

---

*Roadmap authored: 2026-04-25 · Alice (alice.mmcp) · Studio-OS-Chat*
