# Perplexity Spaces — Build & Push Rules

These rules apply to **all Perplexity Spaces** in this network.
Every Space must follow them on every build/push task, without exception.

---

## The Core Problem This Solves

Perplexity has a hard limit of **3 tool calls per turn**. Large files (>400 lines) also exceed
what can safely be written in a single `create_or_update_file` call without truncation or silent failure.
Without explicit rules, Perplexity will:
- Plan a full build in one turn, hit the tool limit mid-way, and push nothing
- Describe what it *would* build without actually building it
- Write slop/excess code trying to fit everything into one shot

---

## Rule 1 — One tool call per meaningful action

Each turn uses **at most 3 tool calls**. Budget them explicitly:

| Slot | Use |
|------|-----|
| 1 | Read (get file, get SHA, check state) |
| 2 | Build or write (generate content, create/update file) |
| 3 | Confirm or next read (verify push landed, read next chunk) |

Never burn all 3 slots on reads. Never attempt a build + push + verify in one turn.

---

## Rule 2 — Chunk files that exceed 400 lines

Any file over ~400 lines must be split across turns:

```
Turn 1: Push lines 1–400   → commit "feat: [name] part 1/3"
Turn 2: Push lines 401–800 → commit "feat: [name] part 2/3"
Turn 3: Push lines 801–end → commit "feat: [name] part 3/3 — complete"
```

- Each chunk is a real, standalone commit — not a placeholder
- The final chunk message includes `— complete` so the user knows it's done
- If a file replaces an existing one, read its SHA in Turn 1 before writing

---

## Rule 3 — Declare the plan before building

Before any multi-turn build, output a **turn plan** like this:

```
📋 Build plan — N turns
Turn 1: [what gets pushed]
Turn 2: [what gets pushed]
...
Ready to start — reply "go" or "start Turn 1"
```

Do not start Turn 1 until the user confirms. This prevents wasted turns.

---

## Rule 4 — End every build turn with a status line

After each push, output exactly:

```
✅ Turn N/N complete — [filename] pushed ([commit SHA short])
   Next: [what Turn N+1 will do] — reply "continue" to proceed
```

This tells the user:
- The push actually landed (not just planned)
- Exactly what comes next
- They control when the next turn fires

---

## Rule 5 — Never describe code without pushing it

If a build task is requested:
- Do not output the code as a chat message unless the user explicitly asks to review first
- Build it → push it → confirm SHA
- If the file is too large for one turn, say so and follow Rule 2

---

## Rule 6 — No slop, no padding

File size limits are a forcing function for code quality:
- If a chunk is approaching 400 lines, audit for:
  - Redundant comments that restate what the code already says
  - Inline styles that belong in a CSS variable
  - Duplicated logic that should be a function
  - Dead code / placeholders
- Tight code ships faster and breaks less.

---

## Rule 7 — Multi-file builds use `push_files`

When a task touches 2–4 files, use `push_files` (multiple files in one commit) instead of
multiple `create_or_update_file` calls. One commit, one tool slot.

Limit: up to 4 files per `push_files` call. More than 4 → split across turns.

---

## Rule 8 — Always read before writing

Before updating any existing file:
1. Call `get_file_contents` to get the current SHA
2. Use that SHA in the `create_or_update_file` call

Skipping this causes a 409 conflict and wastes a turn.

---

## Turn Budget Quick Reference

| Task type | Turns needed |
|---|---|
| Push a new file <400 lines | 1 |
| Update an existing file <400 lines | 1 (read SHA + write = 2 tool calls, fits 1 turn) |
| Push a new file 400–800 lines | 2 |
| Push a new file 800–1200 lines | 3 |
| Push a new file 1200+ lines | Plan first, then N turns of ~400 lines each |
| Multi-file commit (≤4 files, all <400 lines) | 1 (use `push_files`) |
| Read + analyze + push small file | 1 |
| Read + analyze + push large file | 2 (read turn, then write turns) |

---

## How to add these rules to a Space

Paste the following block into the Space's custom instructions:

```
Build & push rules (required):
- Max 3 tool calls per turn. Budget: 1 read, 1 write, 1 confirm.
- Files >400 lines: chunk across turns, ~400 lines per commit.
- Before any multi-turn build: declare turn plan and wait for "go".
- After each push: output "✅ Turn N/N complete — [file] pushed ([SHA])  Next: [X]"
- Never describe code without pushing it. Build → push → confirm SHA.
- No padding/slop. Tight code = fewer turns = faster delivery.
- Multi-file commits (≤4 files): use push_files in one tool slot.
- Always read current SHA before updating an existing file.
```

---

*Created 2026-05-04 by Perplexity (studio-os-chat) on request from nothinginfinity.*
