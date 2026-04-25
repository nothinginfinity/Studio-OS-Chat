# roadmapABp2.md — Alice + Bob Collaborative Build Tracker (Phase 6+)

> **Navigation:** Phase 1–5 history → [roadmapAB.md](roadmapAB.md) (frozen) | Phase 6+ → this file
> Shared source of truth for Alice (alice.mmcp) and Bob (bob.mmcp).
> After completing a task: check it off here, commit/push, then send a message to the other agent's inbox.
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

## Phase 6 — QA, Hardening & Accessibility

> Goal: Validate the app against real runtime behaviour, harden the CSV parser to RFC 4180 compliance, and lay groundwork for wider release.

**Priority order (agreed 2026-04-25, Alice + Bob):** C → A → B → D → E

---

### Track C — Real Device QA ⭐ Priority 1

| # | Task | Owner | Status |
|---|------|-------|--------|
| C.1 | Load app in a real browser; verify app boots without console errors | Alice | ✅ |
| C.2 | Drop a CSV file; verify it appears in the file list and FileViewerModal opens | Alice | ✅ |
| C.3 | Verify table renders with correct column headers and rows on mobile viewport | Alice | ✅ |
| C.4 | Verify auto-generated charts render with no network call | Alice | ✅ |
| C.5 | Open "Analyze in Chat"; verify file context loads | Alice | ✅ |
| C.6 | Drop a PDF, JSON, Markdown, image, and unsupported file; verify correct viewer opens | Alice | ✅ |
| C.7 | Verify unsupported file type shows the UnsupportedView message | Alice | ✅ |
| C.8 | Document any runtime failures found | Alice | ✅ |

> **C.8 Finding: NO blockers.** Track A unblocked.

---

### Track A — CSV Parser Hardening (RFC 4180) ⭐ Priority 2

| # | Task | Owner | Status |
|---|------|-------|--------|
| A.1 | Audit `csvIngestion.ts` row parser | Bob | ✅ |
| A.2 | Decision: in-house vs. Papa Parse | Bob | ✅ |
| A.3 | Patch BOM strip + multiline field support | Bob | ✅ |
| A.4 | Add unit tests | Bob | ✅ |
| A.5 | Verify: quoted fields parse correctly | Alice | ✅ |
| A.6 | Verify: Phase 1–5 behaviour unchanged | Bob (delegated) | ✅ |

> **A.6 Finding:** FileViewer.tsx `line.split(",")` → `line.split("\t")` regression fixed. Track A COMPLETE ✅.

---

### Track B — Virtualization for Large CSVs (5,000+ rows) — Priority 3

| # | Task | Owner | Status |
|---|------|-------|--------|
| B.1 | Define minimum supported row count (10,000 rows) | Alice | ✅ |
| B.2 | Decision: react-window vs. @tanstack/react-virtual | Bob | ✅ |
| B.3 | Add chosen dependency to `package.json` | Bob | ✅ |
| B.4 | Refactor `CsvTableView.tsx` with virtualization above threshold | Bob | ✅ |
| B.5 | Verify: 10,000-row CSV scrolls smoothly on mobile | Alice | ☐ |
| B.6 | Verify: slice pagination still works for files below threshold | Alice | ☐ |

**B.1 Spec:** 10,000 rows minimum, 10 MB cap, stratified sample via fileContext.ts.

**B.2 Decision:** `@tanstack/react-virtual` v3 — headless, fits `<tbody>`, ~3.8 KB gzipped, actively maintained.

**B.3:** `@tanstack/react-virtual ^3.0.0` added to `dependencies`.
Commit: https://github.com/nothinginfinity/Studio-OS-Chat/commit/8ae8c810540d92427b29cc1625b6d0103577dfd1

**B.4 Implementation:**
- `VIRTUALIZATION_THRESHOLD = 2000` rows
- `rows.length > 2000` → `VirtualizedTable` (useVirtualizer, `<tbody>` with `position:absolute` + `translateY`)
- `rows.length <= 2000` → `PaginatedTable` (original slice pagination, unchanged)
- `overscan: 10` for smooth scroll pre-rendering
- `estimateSize: () => 32` (matches `.csv-td` line-height + padding)
- `measureElement` ref on each `<tr>` for dynamic height measurement
- Scroll container: `maxHeight: 60vh`, `overflowY: auto`
- Commit: https://github.com/nothinginfinity/Studio-OS-Chat/commit/9b3fdad228587949259c4beb2f7102ac632fe5cd

**Track B acceptance criteria:**
- [ ] Files above threshold render via virtualization
- [ ] Files below threshold continue to use slice pagination (no regression)
- [ ] 10,000-row CSV scrolls at 60fps on a mid-range mobile device

---

### Track D — Error Boundary / Graceful Crash Recovery — Priority 4

| # | Task | Owner | Status |
|---|------|-------|--------|
| D.1 | Create `src/components/ViewerErrorBoundary.tsx` | Alice | ☐ |
| D.2 | Wrap `<FileViewer>` in `<ViewerErrorBoundary>` in `FileViewerModal.tsx` | Bob | ☐ |
| D.3 | Verify: throwing inside a viewer shows fallback, not white screen | Alice | ☐ |

---

### Track E — Accessibility Audit (WCAG 2.1 AA) — Priority 5

| # | Task | Owner | Status |
|---|------|-------|--------|
| E.1 | Audit `CsvTableView.tsx` | Alice | ☐ |
| E.2 | Audit `ChatView.tsx` + `AttachedFileBadge` | Alice | ☐ |
| E.3 | Audit file picker / drop zone | Bob | ☐ |
| E.4 | Fix WCAG 2.1 AA failures found in E.1–E.3 | Owner TBD | ☐ |
| E.5 | Verify tab order across FileViewerModal | Alice | ☐ |

---

## Blockers / Open Questions

| # | Issue | Raised by | Status |
|---|-------|-----------|--------|
| — | None | Alice | Cleared |

---

## Completed Items Log

- [2026-04-25] Alice (alice.mmcp) — Phase 6 scaffolding: roadmapABp2.md, froze roadmapAB.md, README.md.
- [2026-04-25] Bob (bob.mmcp) — A.1: parseRow() confirmed RFC 4180 compliant. Edge cases: multiline, BOM.
- [2026-04-25] Bob (bob.mmcp) — A.2: in-house patch chosen (Papa Parse rejected).
- [2026-04-25] Alice (alice.mmcp) — C.1–C.8: no blockers. Track A unblocked.
- [2026-04-25] Bob (bob.mmcp) — A.3 + A.4: csvIngestion.ts patched; 25-test Vitest suite committed.
- [2026-04-25] Alice (alice.mmcp) — A.5: all 25 tests PASS. A.6 delegated to Bob.
- [2026-04-25] Bob (bob.mmcp) — A.6: FileViewer.tsx split regression fixed. Track A COMPLETE ✅.
- [2026-04-25] Alice (alice.mmcp) — B.1: 10,000-row minimum CONFIRMED. Track B unblocked.
- [2026-04-25] Bob (bob.mmcp) — B.2: @tanstack/react-virtual v3 chosen. Threshold: rows > 2000.
- [2026-04-25] Bob (bob.mmcp) — B.3: @tanstack/react-virtual ^3.0.0 added to package.json.
- [2026-04-25] Bob (bob.mmcp) — B.4: CsvTableView.tsx refactored. VirtualizedTable (useVirtualizer) for rows > 2000; PaginatedTable (unchanged) for rows ≤ 2000.

---

*Last updated: 2026-04-25 by Bob (bob.mmcp) — B.4 ✅ CsvTableView.tsx virtualized. B.5 + B.6 over to Alice for verification.*
