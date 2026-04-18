# Studio-OS-Chat

A React + Vite PWA that talks to Ollama locally. Installable PWA shell, streaming-ready chat UI, local conversation persistence, model selection, and an extensible tool layer.

## Features

- **Installable PWA** — manifest, service worker, offline shell
- **Local Ollama chat** — choose a model, send prompts, receive answers
- **Conversation persistence** — saves chats in localStorage, restores on reload
- **Model selection** — auto-fetches available models from Ollama, falls back to manual entry
- **Tool-ready architecture** — typed tool registry with echo + calculator tools included
- **Basic settings** — configurable Ollama base URL, default model, system prompt

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
│  ├─ lib/            ← ollama, storage, pwa, types, utils
│  └─ tools/          ← registry, calculator, echo
```

## Roadmap

1. Streaming responses
2. Multiple chat sessions
3. Tool-calling loop
4. IndexedDB persistence
5. File ingestion and retrieval
6. Inline widgets for tool outputs

## Notes

- The PWA calls `http://localhost:11434` by default — same machine as Ollama is the cleanest setup.
- The Ollama base URL is configurable in the sidebar for LAN access.
- Add `public/icons/icon-192.png` and `public/icons/icon-512.png` for full PWA installability.
