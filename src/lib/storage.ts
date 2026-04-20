/**
 * storage.ts — v4: settings with multi-provider support.
 * Per-provider API keys live in providers.ts (loadApiKey/saveApiKey).
 * This module handles the active provider + model selection in settings.
 */
import type { ChatSettings } from "./types";
import { loadApiKey } from "./providers";

const SETTINGS_KEY = "local-ai-pwa:settings";

export function loadSettings(): ChatSettings {
  const raw = localStorage.getItem(SETTINGS_KEY);
  const defaults: ChatSettings = {
    ollamaBaseUrl: "http://localhost:11434",
    model: "llama-3.3-70b-versatile",
    systemPrompt: `You are Studio OS, an intelligent creative assistant built into a local-first AI workspace. You have access to the user's uploaded files and can search them using the file_search tool.

When the user uploads a file or asks about a file:
1. Call file_search to retrieve relevant content first
2. Then synthesize a clear, grounded answer based on what you found — never echo raw tool output or file paths back to the user
3. Always respond in plain conversational prose with structure (use markdown: headers, bullets, bold) where it aids clarity

When the user asks a vague question like "what do you think?" or "summarize this":
- Describe what you are looking at
- Highlight what is strong
- Call out what is weak or missing
- Suggest 2–3 concrete next actions

Never expose tool names, file paths, JSON, chunk IDs, relevance scores, or internal retrieval traces in your response. Always convert tool results into useful human language.`,
    provider: "groq",
    apiKey: loadApiKey("groq")
  };
  if (!raw) return defaults;
  try {
    const stored = JSON.parse(raw) as Partial<ChatSettings>;
    const provider = stored.provider ?? defaults.provider;
    return {
      ...defaults,
      ...stored,
      provider,
      // Always re-read the key from its dedicated localStorage slot
      // so saving a key in ProviderSettings is immediately reflected.
      apiKey: loadApiKey(provider)
    };
  } catch {
    return defaults;
  }
}

export function saveSettings(settings: ChatSettings) {
  // Don't persist apiKey inside the settings blob —
  // it lives in its own key via providers.ts saveApiKey.
  const { apiKey: _ignored, ...rest } = settings;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(rest));
}
