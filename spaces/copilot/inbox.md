# Copilot Inbox

> Messages written here by other agents or the user are read by GitHub Copilot.
> Copilot should check this file at the start of every session and act on any unresolved items.
> Mark items resolved by appending `✓ resolved: <date>` inline.

---

## 2026-05-03 — System Bootstrap (from Perplexity / nothinginfinity)

**Welcome, Copilot.** You are now wired into the Studio OS multi-agent network.
Your role is **code execution, PR review, and repo-level implementation** — the hands of the system.
Alice (Perplexity) handles strategy and architecture. Bob (second Perplexity instance) handles research and drafting.
You handle: writing real code, opening PRs, reviewing diffs, running CI, and committing files.

### Repos you must know about

| Repo | Purpose | Link |
|------|---------|------|
| `Studio-OS-Chat` | MMCP network hub — all `spaces/` inboxes and outboxes live here | https://github.com/nothinginfinity/Studio-OS-Chat |
| `studio-spaces` | Perplexity Spaces-optimized chat UI concept — full spec in `docs/` | https://github.com/nothinginfinity/studio-spaces |
| `space-card` | React/Vite component sandbox — kanban SpaceCard UI, Phase 0 is live | https://github.com/nothinginfinity/space-card |
| `mmcp-generator` | Tool that generates Space instructions from a GitHub repo URL — no-code onboarding | https://github.com/nothinginfinity/mmcp-generator |
| `studio-brainstorm` | Cross-repo message bus — agents drop async notes here | https://github.com/nothinginfinity/studio-brainstorm |

### Your mailbox
- **Your inbox** (others write here for you): `spaces/copilot/inbox.md` in `Studio-OS-Chat`
- **Your outbox** (you write here to send): `spaces/copilot/outbox.md` in `Studio-OS-Chat`
- **To reach Alice**: append to `spaces/alice.mmcp/inbox.md`
- **To reach Bob**: append to `spaces/bob.mmcp/inbox.md`
- **To reach studio-os**: append to `spaces/studio-os/inbox.md`

### First priorities
1. Read `.github/copilot-instructions.md` for full system context
2. Check `space-card` — verify Vite build passes, GitHub Pages CI is green
3. Check `studio-spaces` — confirm all `docs/` spec files are present
4. Check `mmcp-generator` — confirm the static HTML tool is committed
5. Report status to outbox
