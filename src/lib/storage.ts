import type { ChatMessage, ChatSettings } from "./types";

const CHAT_KEY = "local-ai-pwa:messages";
const SETTINGS_KEY = "local-ai-pwa:settings";

export function loadMessages(): ChatMessage[] {
  const raw = localStorage.getItem(CHAT_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ChatMessage[];
  } catch {
    return [];
  }
}

export function saveMessages(messages: ChatMessage[]) {
  localStorage.setItem(CHAT_KEY, JSON.stringify(messages));
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
