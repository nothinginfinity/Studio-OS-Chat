import type { ChatSession, ChatSettings } from "./types";

const SESSIONS_KEY = "local-ai-pwa:sessions";
const ACTIVE_SESSION_KEY = "local-ai-pwa:active-session-id";
const SETTINGS_KEY = "local-ai-pwa:settings";

export function loadSessions(): ChatSession[] {
  const raw = localStorage.getItem(SESSIONS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ChatSession[];
  } catch {
    return [];
  }
}

export function saveSessions(sessions: ChatSession[]) {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

export function loadActiveSessionId(): string | null {
  return localStorage.getItem(ACTIVE_SESSION_KEY);
}

export function saveActiveSessionId(id: string | null) {
  if (!id) {
    localStorage.removeItem(ACTIVE_SESSION_KEY);
    return;
  }
  localStorage.setItem(ACTIVE_SESSION_KEY, id);
}

export function loadSettings(): ChatSettings {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) {
    return {
      ollamaBaseUrl: "http://localhost:11434",
      model: "llama3.2",
      systemPrompt: "You are a helpful local AI assistant."
    };
  }
  try {
    return JSON.parse(raw) as ChatSettings;
  } catch {
    return {
      ollamaBaseUrl: "http://localhost:11434",
      model: "llama3.2",
      systemPrompt: "You are a helpful local AI assistant."
    };
  }
}

export function saveSettings(settings: ChatSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
