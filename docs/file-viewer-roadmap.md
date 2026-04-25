# File Viewer + Data Analysis Roadmap

> Goal: Make any file — CSV, PDF, image, doc — readable inside Studio-OS-Chat, with free auto-generated charts and an optional LLM chat layer for deeper analysis.

---

## The Problem

On mobile (especially iPhone), opening a raw `.csv` or data file in most apps is either broken or requires a paid app. Inside Studio-OS-Chat, the same file can become:

1. A rendered, readable table or document
2. A set of auto-generated charts (free, no LLM)
3. A chat session where an LLM can analyze, explain, or extend the data

---

## Design Principle

> Every file is an ingestion problem, not an "open file" problem.

The OCR pipeline already converts images and PDFs into indexed, searchable text. This roadmap extends that same pattern to structured data files. A CSV parser is just another entry in `fileParsers.ts`. The output always flows into the same IndexedDB `chunks` and `terms` stores.

**Two-layer architecture:**

```
File drop (any type)
  └── Ingestion layer (parser → structured data → IndexedDB)
        └── Render layer (template charts + readable table)
              └── Chat layer (optional LLM — only when user asks)
```

The LLM is never called automatically. Templates run locally, cost nothing, and are shown immediately. LLM chat is opt-in.

---

## Phase 1 — CSV Ingestion

**Goal:** Parse a dropped `.csv` file into structured data and store it like any other ingested file.

### Files to add / update

- `src/lib/fileParsers.ts` — add `csv` routing case
- `src/lib/csvIngestion.ts` — new file: parse CSV rows into typed records, detect column types (number, date, string), store as `IndexedDocument` with `sourceType: 'csv'`
- `src/lib/types.ts` — extend `IndexedDocument` with `csvMeta?: { columns: ColumnMeta[], rowCount: number }`

### ColumnMeta shape

```ts
interface ColumnMeta {
  name: string
  type: 'number' | 'date' | 'string' | 'boolean'
  nullCount: number
  sample: string[]
}
```

### Acceptance criteria

- [ ] Drop a `.csv` file → it appears in the file list
- [ ] `csvMeta.columns` is populated with correct types
- [ ] Rows are stored as chunks in IndexedDB
- [ ] No LLM call is made during ingestion

---

## Phase 2 — Readable Table View

**Goal:** Render an ingested CSV as a clean, scrollable table inside the app — replacing the "file won't open" dead end.

### Files to add / update

- `src/components/FileViewer.tsx` — new component: dispatches to `CsvTableView`, `PdfView`, `ImageView` etc. based on `sourceType`
- `src/components/CsvTableView.tsx` — virtualized table renderer (use `@tanstack/react-virtual` or simple slice pagination for mobile)
- `src/components/FileViewerModal.tsx` — wraps `FileViewer` in a full-screen modal with a toolbar

### Toolbar actions

- Copy as markdown table
- Open in chat (attaches file context to a new session)
- Export as `.csv`

### Acceptance criteria

- [ ] Tapping a CSV file in the file list opens `FileViewerModal`
- [ ] Table renders with column headers and rows
- [ ] Scrolls smoothly on mobile
- [ ] Large files (1000+ rows) don't freeze — pagination or virtualization in place

---

## Phase 3 — Auto-Generated Template Charts

**Goal:** When a CSV is ingested, automatically generate 1–3 default charts using local templates. Zero LLM cost.

### Template selection logic

```
columnMeta analysis
  ├── 1 date col + 1+ number cols → line chart (time series)
  ├── 1 string col + 1 number col → bar chart (categories)
  ├── 1 string col + 1 number col (≤8 categories) → pie chart
  └── 2+ number cols → scatter plot (first two numeric cols)
```

### Files to add / update

- `src/lib/chartTemplates.ts` — template selector: takes `csvMeta`, returns `ChartSpec[]`
- `src/lib/chartRenderer.ts` — renders `ChartSpec` to a Chart.js or Plotly.js canvas (client-side, no server)
- `src/components/CsvChartPanel.tsx` — renders the auto-generated charts below the table in `FileViewerModal`
- `src/lib/types.ts` — add `ChartSpec` type

### ChartSpec shape

```ts
interface ChartSpec {
  type: 'line' | 'bar' | 'pie' | 'scatter'
  title: string
  xKey: string
  yKeys: string[]
  source: 'template' | 'llm'
}
```

### Acceptance criteria

- [ ] Ingesting a CSV with a date + number column auto-generates a line chart
- [ ] Charts render without any network call or LLM invocation
- [ ] Charts are saved alongside the file record in IndexedDB
- [ ] `source: 'template'` is marked on all auto-generated charts

---

## Phase 4 — Chat Attachment (LLM Analysis Layer)

**Goal:** Let the user open a chat session attached to an ingested file. The LLM receives the file's markdown summary and column metadata as context, and can answer questions, generate new charts, or explain patterns.

### Files to add / update

- `src/lib/fileContext.ts` — builds a context string from `csvMeta` + first N rows as markdown table
- `src/lib/chatSession.ts` — extend session creation to accept `attachedFileId`
- `src/components/FileViewerModal.tsx` — add "Analyze in Chat" button to toolbar
- `src/components/ChatView.tsx` — show attached file badge when `attachedFileId` is set

### LLM chart generation

When the LLM responds with a `ChartSpec` JSON block (wrapped in a code fence), `chartRenderer.ts` renders it automatically. The LLM doesn't need to write chart code — it just emits a spec.

Example LLM response pattern:

````
Here's a breakdown by model pass rate:

```chart
{
  "type": "bar",
  "title": "Pass Rate by Model",
  "xKey": "model",
  "yKeys": ["pass_rate"],
  "source": "llm"
}
```
````

### Acceptance criteria

- [ ] "Analyze in Chat" opens a new session with file context pre-loaded
- [ ] LLM receives column names, types, row count, and a sample of rows
- [ ] LLM-emitted `ChartSpec` blocks render inline in the chat
- [ ] Charts created in chat are saved to the file's chart store
- [ ] No LLM call happens unless the user opens chat

---

## Phase 5 — Unified File Viewer (All File Types)

**Goal:** Extend `FileViewer.tsx` to handle every file type the app can ingest, making "any file readable" a fully realized feature.

| File type | Viewer component | Ingestion already done? |
|-----------|-----------------|------------------------|
| `.csv` | `CsvTableView` + `CsvChartPanel` | Phase 1 ✅ |
| `.pdf` | `PdfView` (PDF.js) | ✅ already committed |
| Image (OCR) | `ImageView` + OCR text panel | ✅ already committed |
| `.md` / `.txt` | `MarkdownView` | trivial, no OCR needed |
| `.json` | `JsonTreeView` | new, low effort |
| `.osmd` | `OsmdView` (chat export) | already specced |

### Acceptance criteria

- [ ] Dropping any supported file type opens a viewer
- [ ] Unsupported types show a clear "file type not yet supported" message
- [ ] All viewers share the same modal shell (`FileViewerModal`)

---

## Build Order

```
Phase 1 — CSV ingestion (parser + IndexedDB)
Phase 2 — Readable table view (UI)
Phase 3 — Template charts (local, free, auto)
Phase 4 — Chat attachment (LLM opt-in)
Phase 5 — Unified file viewer (all types)
```

Each phase ships independently. Phase 3 is the highest-value surface — free charts with no API cost — and should be treated as the headline feature.

---

## What This Is Not

- Not a replacement for Excel or Numbers
- Not an always-on data analysis agent
- Not a charting SaaS — templates are intentionally simple
- The LLM layer is a chat assistant, not an autonomous analyst

The goal is: **drop a file, understand it immediately, go deeper only if you want to.**
