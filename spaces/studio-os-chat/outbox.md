# studio-os-chat / outbox

Messages sent **from** studio-os-chat to other spaces are appended here.

---

<!-- messages appear below this line -->

---

## HANDOFF — repo-copilot Phase 1
**Date:** 2026-05-03  
**From:** studio-os-chat (Perplexity session)  
**To:** next studio-os-chat session  
**Repo:** https://github.com/nothinginfinity/repo-copilot

### Context
Jared is building a mobile-first GitHub repo browser + multi-provider code copilot, optimized for iPhone 16. The repo `repo-copilot` was just created and specced. No Alice/Bob/MMCLI system is set up yet — this message is the handoff mechanism.

### What exists right now
- `README.md` — full product overview, provider list, architecture, phased roadmap
- `docs/ARCHITECTURE.md` — screen model, provider adapter spec, GitHub ingestion flow
- `docs/PRODUCT-SPEC.md` — user, jobs-to-be-done, must-haves, success criteria
- `docs/UI-SPEC.md` — mobile wireframes for Home, Repo, and Chat screens

### What to build next (Phase 1)
Build a single self-contained HTML file: `repo-copilot.html`  
This is a static, no-backend, mobile-first web app with these features in order:

**Step 1 — Repo loader**
- Input field: paste any GitHub URL (github.com/owner/repo, owner/repo, or just repo name with nothinginfinity as default owner)
- Parse owner + repo from input
- Fetch repo metadata via GitHub REST API (no auth needed for public repos)
- Show: repo name, description, default branch, star count, last updated

**Step 2 — File tree**
- Fetch recursive tree: `GET /repos/{owner}/{repo}/git/trees/{branch}?recursive=1`
- Render as collapsible tree
- Checkboxes on each file for selection
- "Select all" / "Deselect all" / "Select code files only" (filter: .js .ts .jsx .tsx .py .md .json .html .css .yaml .yml .sh)
- Show file size in KB next to each file name
- Tap a file to preview its contents inline

**Step 3 — File content fetching**
- For selected files: fetch blob content via `GET /repos/{owner}/{repo}/contents/{path}`
- Decode base64 content
- Store all fetched file contents in memory as `{ path, content, size }` array

**Step 4 — Export: REPO_DUMP.txt**
- Concatenate all selected+fetched files into one text blob
- Format:
  ```
  ===== FILE: src/main.tsx =====
  <contents>

  ===== FILE: package.json =====
  <contents>
  ```
- Trigger browser download as `{repo-name}-dump.txt`

**Step 5 — Export: ZIP**
- Use JSZip CDN: `https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js`
- Zip all selected files preserving folder structure
- Trigger browser download as `{repo-name}.zip`

**Step 6 — Chat panel (Phase 2 but design it now)**
- Tab or slide panel: "Files" | "Chat"
- Provider selector dropdown
- Model field (text input or dropdown per provider)
- API key input (type=password, in-memory only)
- Context selector: "All loaded files" | "Selected files" | "Custom"
- Token estimator (rough: characters ÷ 4)
- Chat transcript area
- Message input + send button
- System prompt: inject all selected file contents as context before user message

### Provider adapter map
Each provider needs: base_url, auth_header, chat_endpoint, request_body_fn, response_extractor_fn

| Provider | Base URL | Notes |
|---|---|---|
| OpenAI | https://api.openai.com/v1 | Bearer token, /chat/completions |
| Groq | https://api.groq.com/openai/v1 | OpenAI-compatible |
| xAI | https://api.x.ai/v1 | OpenAI-compatible, model: grok-3 |
| Cerebras | https://api.cerebras.ai/v1 | OpenAI-compatible |
| Fireworks | https://api.fireworks.ai/inference/v1 | OpenAI-compatible |
| Mistral | https://api.mistral.ai/v1 | OpenAI-compatible |
| DeepSeek | https://api.deepseek.com/v1 | OpenAI-compatible |
| Gemini | https://generativelanguage.googleapis.com/v1beta | Different schema — needs separate adapter |

### Design direction
- Nexus design system (warm beige light / dark charcoal dark)
- Fonts: Satoshi (Fontshare) body, no display font needed — this is a tool
- Accent: Hydra Teal (#01696f)
- Dense layout — this is a developer tool, not a landing page
- Mobile first: 375px, thumb-reachable actions, bottom nav or tabs
- Dark mode default (code tools feel better dark)
- No localStorage — in-memory state only
- No backend required for Phase 1

### Constraints (iPhone-specific)
- No Ollama (not mobile compatible)
- Must work in Safari on iOS
- No drag-and-drop (use tap + checkbox for selection)
- Bottom sheet for file preview, not sidebar
- Minimum 44px tap targets everywhere
- Avoid hover-only UI patterns

### File to create
`repo-copilot.html` — single file, all CSS and JS inline, CDN libraries only

### Push target
Branch: `main`  
Repo: `nothinginfinity/repo-copilot`  
File path: `repo-copilot.html`

### How to continue in a new session
1. Open Perplexity → studio-os-chat space
2. Say: "Continue building repo-copilot — check the outbox for the Phase 1 handoff"
3. Reference this repo: https://github.com/nothinginfinity/repo-copilot
4. Start with Step 1 (repo loader) and work through to Step 6

---
