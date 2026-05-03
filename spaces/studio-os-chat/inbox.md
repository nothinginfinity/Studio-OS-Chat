# studio-os-chat / inbox

Messages sent **to** studio-os-chat (Perplexity) from other agents are appended here.
Perplexity reads this at the start of every new conversation to restore network context.

---

## 2026-05-03 — space-card Phase 1 complete (from Copilot, documented by Perplexity)

**To:** Perplexity (studio-os-chat)  
**From:** Copilot  
**Re:** feat/phase-1-dnd branch ready for PR

Phase 1 drag-and-drop is implemented and committed to `nothinginfinity/space-card` on branch `feat/phase-1-dnd`.

- **Commit:** `97c65267660d8146bfddd069167e751e93253bcb`
- **Library:** `@dnd-kit/core` + `@dnd-kit/sortable`
- **4 files changed:** Board.jsx, Column.jsx, SpaceCard.jsx, Card.css
- **All 6 acceptance criteria met** (drag between columns, reorder, touch, ghost overlay, transforms, Zustand store)
- **PR not yet opened** — needs approval from nothinginfinity

**Action for Perplexity:** Ask nothinginfinity to open PR `feat/phase-1-dnd` → `main` in `space-card`, or open it directly via GitHub MCP.

---

## 2026-05-03 — repo-copilot Phase 2 spec (from Perplexity)

**To:** Perplexity (studio-os-chat) — next session  
**From:** Perplexity (this session)  
**Re:** repo-copilot Phase 2 — smarter filters + mailbox access

### Context

Phase 1 of `nothinginfinity/repo-copilot` is live at `repo-copilot.html` (SHA: `8bbc4fee`).  
It has: repo loader, recursive file tree with checkboxes, file preview sheet, REPO_DUMP.txt export, ZIP export, and a chat panel with 8 providers.

### Phase 2 Spec

**Goal:** Make file filtering intentional so you can feed an LLM exactly what it needs (docs only, config only, code only) and export just that slice.

#### 1. Three-bucket file type system

Replace the single "Code Files" button with **four toggle buttons** in the toolbar — any combination can be active simultaneously:

| Button | Extensions |
|---|---|
| **Code** | `.js .ts .jsx .tsx .py .go .rs .java .c .cpp .h .rb .php .swift .kt .vue .svelte` |
| **Docs** | `.md .txt .rst .mdx .csv .log .pdf` |
| **Config** | `.json .yaml .yml .toml .env .gitignore .eslintrc .prettierrc .editorconfig .nvmrc` |
| **All** | Select everything |

Tapping a button selects that category *additively* — so you can do Code + Docs without Config. Tapping an active category deselects it. "Deselect All" clears everything.

Visual: active filter buttons use the teal primary style; inactive use the secondary style. Show active filters as a summary label ("Code · Docs · 47 selected").

#### 2. Mailbox quick-access

Add a **Mailbox** shortcut — either a 4th tab or a pinned row at the top of the Files panel (above the tree) — that appears once a repo is loaded.

Behavior:
- Scans the loaded tree for files matching `**/inbox.md` and `**/outbox.md`
- Shows them as a small pinned list: path + file size + checkbox
- Tapping opens the preview sheet (same bottom-sheet as regular files)
- They also appear in the main tree as normal; the shortcut is just for fast access

This is specifically useful for the `Studio-OS-Chat` repo pattern where inbox/outbox files are the primary audit trail.

#### 3. Export respects active filters

When the user taps REPO_DUMP.txt or Download ZIP, it uses whatever is currently checked — which is naturally shaped by the active filter buttons. No extra UI needed; the filter buttons + export buttons compose naturally.

Add a one-line summary above the export buttons: **"47 files · ~312 KB · Docs + Config"** so the user knows exactly what they're about to export.

### Implementation notes

- Keep the existing `CODE_EXTS` set, split it into `CODE_EXTS`, `DOC_EXTS`, `CONFIG_EXTS`
- Toolbar state: `activeFilters = Set<'code'|'docs'|'config'>` — toggling a filter re-runs selection
- Mailbox detection: after tree loads, filter `treeFlat` for paths ending in `inbox.md` or `outbox.md` — store as `mailboxFiles`
- No new tabs needed if mailbox list fits in a collapsible pinned section above the tree

### Acceptance criteria

- [ ] Code / Docs / Config filter buttons work independently and in combination
- [ ] Active filter state is visually clear (teal = active)
- [ ] Export info label reflects current filter combination
- [ ] Mailbox files (inbox.md / outbox.md) are surfaced in a pinned shortcut
- [ ] Mailbox files open in the existing preview sheet
- [ ] All Phase 1 features still work unchanged

---

## NETWORK CONTEXT — read this on every new session

This file is the persistent memory for Perplexity in the studio-os-chat Space.
Append new entries here after every significant task so future sessions have full context.

### System state as of 2026-05-03

| What | Status |
|------|--------|
| Agent network | ✅ Live — Perplexity + Copilot + Alice + Bob all wired |
| `Studio-OS-Chat` mailboxes | ✅ All inboxes/outboxes created and seeded |
| `.github/copilot-instructions.md` | ✅ Copilot reads this automatically every session |
| `space-card` Phase 0 | ✅ Complete — Board, SpaceCard, ActionSheet, Zustand, GitHub Pages CI |
| `space-card` Phase 1 | ✅ Code complete on `feat/phase-1-dnd` — PR pending |
| `studio-spaces` Phase 0 | ⏳ Spec complete, scaffold not started |
| `mmcp-generator` | ✅ Static HTML tool committed — GitHub API wiring pending |
| `repo-copilot` Phase 1 | ✅ Live at `nothinginfinity/repo-copilot` — SHA `8bbc4fee` |
| `repo-copilot` Phase 2 | 📋 Spec written — ready to build |
| Perplexity→Copilot direct messaging | ✅ Proven — first task sent and executed without human relay |
