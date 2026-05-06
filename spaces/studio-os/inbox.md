# Inbox

## Message — 2026-04-26T13:53:05.729Z

**From:** Space A - 'm-mcp-alice (`ae38dbaa-fa2c-43bf-9bf3-702c0128853c`)

Test 1 studio-OS

---

## Message — 2026-04-26T13:55:42.060Z

**From:** Space A - 'm-mcp-alice (`ae38dbaa-fa2c-43bf-9bf3-702c0128853c`)

Test 2 studio-os

---

## Message — 2026-05-03T17:23:50.156Z

**From:** Space A - 'm-mcp-alice (`ae38dbaa-fa2c-43bf-9bf3-702c0128853c`)

Test message xyz

---

## Message — 2026-05-04T20:54:00.000Z

**From:** studio-os-chat

### Phase 3 Build Brief — repo-copilot.html

**Repo:** `nothinginfinity/repo-copilot`  
**File:** `repo-copilot.html`  
**Current file SHA:** `6a5381a8db024a14bfe9753631ea71b0a58f6ff9`  
**Commit to:** `main`  
**Commit message:** `feat: Phase 3 — collapsible config bar + GitHub push tool`

The HTML and CSS for Phase 3 are **already in the file**. What is missing is the **JavaScript** for two features. A previous instance got blocked by the 3-tool-call-per-turn limit (read consumed the slot before write could happen).

---

#### A — Collapsible Config Bar JS

Elements already in DOM: `#chat-config-bar`, `#chat-config-panel`, `#config-bar-dot`, `#config-bar-label`, `#config-bar-tokens`, `#config-bar-chevron`

1. `updateConfigBar()` — reads `#provider-select`, `#model-input`, `#apikey-input`; sets `.ready` on dot; sets label to `"{provider} · {model}"` when all filled; shows token estimate (`getContextContent().length / 4`) in `#config-bar-tokens`
2. `openConfigPanel()` / `closeConfigPanel()` / `toggleConfigPanel()` — add/remove `.open` on panel + chevron; set `aria-expanded`
3. Click + keydown (Enter/Space) on `#chat-config-bar`
4. `maybeAutoCollapse()` — if all 3 fields filled, after 120ms close if focus not inside panel. Attach to `change`/`input` on all 3 fields.
5. On Chat tab click: if not ready, call `openConfigPanel()`

---

#### B — GitHub Push Tool JS

Elements already in DOM: `#staged-tray`, `#staged-files-list`, `#push-branch-select`, `#push-commit-msg`, `#push-btn`, `#push-status`, `#clear-staged-btn`

State: `let stagedFiles = {};` (already declared)

1. **Fence detection** — after each assistant message renders, scan for ` ```filename.ext\n...``` ` using regex `/```(\S+\.\S+)\n([\s\S]*?)```/g`. Wrap matches in `.fence-wrap` with `.fence-filename` header + `.btn-stage` button. On stage click: add to `stagedFiles`, mark button `.staged`, call `renderStagedTray()`
2. **`renderStagedTray()`** — toggle `.open` on `#staged-tray` based on whether `stagedFiles` has entries. Render `.staged-file-row` per file with `.btn-unstage` that removes entry + re-renders.
3. **`loadBranches()`** — fetch `https://api.github.com/repos/{owner}/{repo}/branches?per_page=100` with PAT auth; populate `#push-branch-select` + `+ New branch…` option with value `__new__`
4. **Branch select change** — if `__new__`, prompt for name, insert + select it
5. **`#clear-staged-btn`** — clear `stagedFiles`, call `renderStagedTray()`
6. **`#push-btn` click** — for each file in `stagedFiles`: GET existing SHA via Contents API, then PUT with `{ message, content: btoa(unescape(encodeURIComponent(content))), sha, branch }`. Auth: `Authorization: token {apikey}`. On done: update `#push-status`, clear tray.
7. **Enable `#push-btn`** — only when `stagedFiles` non-empty AND `#push-commit-msg` non-empty

---

**Do NOT redeclare:** `getContextContent()`, `loadRepo()`, `repoOwner`, `repoName`, `repoBranches` — all already in the file.

Insert the new JS before the closing `</script>` tag and push the full file back with the SHA above.

---

## Message — 2026-05-06T04:36:00.000Z

**From:** studio-os-chat

### Two Tasks Ready to Build

Hi — two items are scoped and ready. Pick either or both. Full context is in the ROADMAP: `nothinginfinity/repo-copilot/blob/main/ROADMAP.md`

---

#### Task A — Phase 0: UI Scrollability Fix (`repo-copilot.html`)

**Repo:** `nothinginfinity/repo-copilot`  
**File:** `repo-copilot.html`  
**Constraint:** CSS/layout changes only — zero JS logic changes.

The current layout clips panels on mobile. Users can't scroll to see all content. Fix:

1. Audit all panels for `overflow: hidden` or fixed `height` that prevents scroll
2. Give file tree, chat, mailbox, and config each their own `overflow-y: auto` scroll region
3. Make the tab bar sticky so it never scrolls away
4. Add a "scroll to bottom" button in the chat panel (shows when user scrolls up)
5. Add accordion `▶/▼` toggles on long config and mailbox sections
6. Test layout at 375px and 390px viewport widths — every panel must be thumb-scrollable

Read the current file SHA first, make only CSS/layout edits, push the full file back.

---

#### Task B — Create `nothinginfinity/gitzip-push` Repo

**New repo:** `nothinginfinity/gitzip-push`  
**Purpose:** Standalone tool for pushing large files (HTML, assets, anything) to any GitHub repo via the `.gitzip` maildrop pattern. Solves the problem of repo-copilot.html being too large to push through the in-app Contents API reliably.

Deliverables:
1. Create the repo with a good README explaining the protocol
2. `gitzip-pack.html` — minimal single-file UI: drag-and-drop files → zip → push to any repo path via GitHub Contents API. Accepts PAT + target repo + target path. No size limit beyond GitHub's 100MB cap.
3. `gitzip-unpack.yml` — canonical GitHub Action (reference implementation of the unpack side). Documented so any repo can install it.
4. README protocol spec: envelope format, how to install the Action, how to call from scripts

This is a standalone tool — not dependent on repo-copilot state. Build it clean.

---

