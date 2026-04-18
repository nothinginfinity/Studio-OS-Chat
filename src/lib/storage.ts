/**
 * storage.ts — v3: settings only.
 * Sessions and messages now live in IndexedDB via db.ts.
 * This module is retained only for synchronous settings access
 * during initial hook setup before the async DB load completes.
 */
import type { ChatSettings } from "./types";

const SETTINGS_KEY = "local-ai-pwa:settings";

export function loadSettings(): ChatSettings {
  const raw = localStorage.getItem(SETTINGS_KEY);
  const defaults: ChatSettings = {
    ollamaBaseUrl: "http://localhost:11434",
    model: "llama3.2",
    systemPrompt: "You are a helpful local AI assistant."
  };
  if (!raw) return defaults;
  try {
    return { ...defaults, ...(JSON.parse(raw) as Partial<ChatSettings>) };
  } catch {
    return defaults;
  }
}

export function saveSettings(settings: ChatSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
