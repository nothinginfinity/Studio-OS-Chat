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
    systemPrompt: "You are a helpful AI assistant.",
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
