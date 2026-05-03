# Copilot Inbox

> **How to use this file:**
> Alice, Bob, MMCLI, and Jared append briefing entries here before a Copilot session.
> Copilot reads this file at the start of every session (via `.github/copilot-instructions.md`).
> Entries are append-only — newest at the bottom. Do not delete old entries.

---

```json
{
  "id": "msg-system-copilot-20260503T091200Z",
  "from": "system",
  "to": "copilot",
  "payload": {
    "subject": "🟢 Copilot agent slot activated — welcome to the network",
    "contentType": "text/plain",
    "content": "Welcome, Copilot.\n\nYou are now the build agent in a four-agent async network. Your full context, protocols, and repo map are in `.github/copilot-instructions.md` — read that first.\n\nHere is a snapshot of where every active repo stands as of 2026-05-03:\n\n## Studio-OS-Chat (nothinginfinity/Studio-OS-Chat)\nPhase 5 complete. The MMCP messaging layer is live. Alice and Bob have been running async tasks via inbox/outbox commits since April 21. CI is green with ChatWindow offline tests disabled. E2E: ingest smoke passing, viewer tests skipped pending fixture work. Stack: React + TypeScript + Vite + Vitest + Playwright.\n\n## space-card (nothinginfinity/space-card)\nPhase 0 shipped. Single `index.html` — landing page → sign-up form → kanban dashboard. Live at https://nothinginfinity.github.io/space-card. Seeded with real repos as Space cards (studio-spaces, mmcp-generator, space-card, studio-brainstorm, studio-os-chat). Long-press → action sheet. Thread expand/collapse. Add Space prompt. Light + dark mode.\n\nNext logical steps for space-card:\n- Real drag-and-drop column reorder (use @dnd-kit or native drag API)\n- Persist board state (localStorage or GitHub API write)\n- Connect to live GitHub repo list via GitHub REST API\n- Space detail view (click card → full Space page)\n\n## studio-spaces (nothinginfinity/studio-spaces)\nSpec complete. Full Spaces-first chat UI — the mini-Perplexity. Docs: ARCHITECTURE.md, SPACE-SCHEMA.md, ROADMAP.md, UI-SPEC.md. Phase 0 target: React + Vite shell, Space CRUD (create/rename/delete/duplicate), left sidebar nav, basic chat window, no AI yet.\n\n## mmcp-generator (nothinginfinity/mmcp-generator)\nLive. Single HTML file tool. Paste a GitHub repo URL → generates full Perplexity Space instructions for Alice, Bob, and MMCLI agents with correct inbox/outbox paths. 36+ repos pre-indexed. One-click copy per agent block.\n\n## studio-brainstorm (nothinginfinity/studio-brainstorm)\nCross-repo ideas + strategy bus. Alice and MMCLI reference it for broader context. No active build tasks."
  },
  "sentAt": "2026-05-03T09:12:00Z",
  "signature": "signed:system:msg-system-copilot-20260503T091200Z"
}
```

---

```json
{
  "id": "msg-jared-copilot-20260503T091200Z",
  "from": "jared",
  "to": "copilot",
  "threadId": "msg-system-copilot-20260503T091200Z",
  "payload": {
    "subject": "Your first brief — priorities and how I want to work with you",
    "contentType": "text/plain",
    "content": "Hey Copilot — Jared here.\n\nWelcome aboard. Here's how I want to work with you:\n\n**My role:** I'm the human in the loop. I make final calls on direction, merge PRs, and handle anything that requires a real account (API keys, billing, external services).\n\n**How to brief you:** I'll append to this inbox before sessions. Alice and Bob will do the same when they have specific build tasks ready. MMCLI handles automation and cross-repo wiring.\n\n**What I need from you:**\n1. Read this inbox before touching anything.\n2. After a session, write a summary to `spaces/copilot/outbox.md` so Alice and Bob stay in sync.\n3. If you hit an architectural decision that could go either way, flag it in your outbox entry — don't silently pick one.\n4. Follow the Nexus design system (tokens are in space-card's index.html and studio-spaces docs). Warm beige + teal. No AI aesthetic.\n5. Conventional commits always. Clean history.\n\n**Immediate priority:**\nNo blocking task right now — this is your onboarding entry. The next task will come from Alice, Bob, or me via this inbox. For now, orient yourself with the repos listed in the system activation message above.\n\n— Jared"
  },
  "sentAt": "2026-05-03T09:12:00Z",
  "signature": "signed:jared:msg-jared-copilot-20260503T091200Z"
}
```

---

<!-- THREAD OPEN: Copilot onboarding — no active task yet. Awaiting first brief from Alice, Bob, or Jared. -->
