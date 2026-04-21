# Studio-OS-Chat

A React + Vite PWA that talks to Ollama locally. Installable PWA shell, streaming-ready chat UI, local conversation persistence, model selection, and an extensible tool layer.

## Features

- **Installable PWA** — manifest, service worker, offline shell
- **Local Ollama chat** — choose a model, send prompts, receive answers
- **Conversation persistence** — saves chats in localStorage, restores on reload
- **Model selection** — auto-fetches available models from Ollama, falls back to manual entry
- **Tool-ready architecture** — typed tool registry with echo + calculator tools included
- **Basic settings** — configurable Ollama base URL, default model, system prompt
- **OCR geometry engine boundary** — single integration seam for deterministic post-OCR document reconstruction

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start Ollama in a separate terminal
ollama serve
ollama pull llama3.2

# 3. Run the dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Project Structure

```
local-ai-pwa/
├─ index.html
├─ package.json
├─ tsconfig.json
├─ vite.config.ts
├─ public/
│  ├─ manifest.webmanifest
│  ├─ sw.js
│  ├─ offline.html
│  └─ icons/          ← add icon-192.png and icon-512.png here
├─ src/
│  ├─ main.tsx
│  ├─ App.tsx
│  ├─ styles.css
│  ├─ components/     ← ChatWindow, MessageList, MessageComposer, ModelSelector, Sidebar, ToolResultCard
│  ├─ hooks/          ← useChat, usePersistentState
│  ├─ lib/
│  │  ├─ ollama, storage, pwa, types, utils
│  │  └─ postOcrGeometry/   ← OCR engine integration boundary (see below)
│  └─ tools/          ← registry, calculator, echo
```

## OCR Geometry Engine Integration

All deterministic post-OCR processing is isolated behind a single boundary at `src/lib/postOcrGeometry/`. **Nothing outside this folder imports engine internals directly.**

### Boundary files

| File | Purpose |
|---|---|
| `types.ts` | `PostOcrDocument`, `PostOcrBlock`, `PostOcrProcessedDocument`, `PostOcrRunner` |
| `engineAdapter.ts` | The **only** file that imports from `post-ocr-geometry-engine` |
| `runner.ts` | `DefaultPostOcrRunner` — delegates to `engineAdapter` |
| `getRunner.ts` | Factory: `getPostOcrRunner()` |
| `normalizedResult.ts` | App-level types: `NormalizedOcrResult`, `NormalizedOcrBlock`, `ConfidenceLevel` |
| `normalize.ts` | `normalizeOcrResult()` — maps engine output to app model |

### Activating the real engine

The engine adapter is currently in **placeholder mode** — it compiles and runs without the npm package installed. To activate the real engine:

```bash
npm install post-ocr-geometry-engine
```

Then in `src/lib/postOcrGeometry/engineAdapter.ts`:
1. Uncomment the real import block
2. Change the last line: `return runWithPlaceholder(doc)` → `return runWithEngine(doc)`
3. Delete the placeholder function and this comment

No other files need to change.

### Recommended: run in a Web Worker

For smooth performance on mobile, run OCR processing off the main thread:

```ts
// src/workers/ocrWorker.ts
import { runGeometryEngine } from "../lib/postOcrGeometry/engineAdapter";

self.onmessage = async (e) => {
  const result = await runGeometryEngine(e.data);
  self.postMessage(result);
};
```

Vite handles worker bundling automatically:

```ts
const worker = new Worker(
  new URL('../workers/ocrWorker.ts', import.meta.url),
  { type: 'module' }
);
```

---

## Mobile / iPhone Compatibility

This app is **mobile-first** and designed to run on iPhone (Safari / iOS PWA).

| Layer | iPhone ready | Notes |
|---|---|---|
| Core app (React + Vite PWA) | ✅ | Installable via Safari Add to Home Screen |
| `postOcrGeometry` types + normalize | ✅ | Pure TypeScript — zero runtime cost |
| `engineAdapter` placeholder | ✅ | Runs in Safari today |
| `engineAdapter` real engine (when wired) | ✅ | Core pipeline is browser-safe — no Node APIs |
| `crypto.randomUUID()` | ✅ | Safari 15.4+ (iOS 15+) — no polyfill needed |
| Engine test helpers (`loadFixture.ts`) | ⚠️ | Uses `node:fs` — test-only, never bundled to client |
| Tesseract.js OCR input | ✅ | Official browser/worker build available |

**The engine's core pipeline (`fromTesseractTSV`, `buildDocument`, `scoreBlocks`) uses zero Node.js APIs.** It is pure TypeScript data transformation and bundles cleanly for Safari.

The Web Worker pattern above is strongly recommended for iPhone — it keeps OCR processing off the main thread so the UI stays responsive during document reconstruction.

---

## Roadmap

1. Streaming responses
2. Multiple chat sessions
3. Tool-calling loop
4. IndexedDB persistence
5. File ingestion and retrieval
6. Inline widgets for tool outputs
7. OCR Web Worker integration
8. Activate real `post-ocr-geometry-engine` adapter

## Notes

- The PWA calls `http://localhost:11434` by default — same machine as Ollama is the cleanest setup.
- The Ollama base URL is configurable in the sidebar for LAN access.
- Add `public/icons/icon-192.png` and `public/icons/icon-512.png` for full PWA installability.
- `crypto.randomUUID()` is used instead of `nanoid` — no extra dependency needed, supported on all modern iOS versions.
