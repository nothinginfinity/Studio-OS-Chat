/**
 * providers.ts — All supported LLM providers.
 * Keys are stored in localStorage, never sent to any backend.
 * All OpenAI-compatible providers use /v1/chat/completions with streaming + tool calls.
 */

export interface Provider {
  id: string;
  name: string;
  icon: string;
  models: string[];
  defaultModel: string;
  baseUrl: string;
  keyPrefix: string;
  keyPlaceholder: string;
}

export const PROVIDERS: Provider[] = [
  {
    id: "groq",
    name: "Groq",
    icon: "⚡",
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768", "gemma2-9b-it"],
    defaultModel: "llama-3.3-70b-versatile",
    baseUrl: "https://api.groq.com/openai",
    keyPrefix: "gsk_",
    keyPlaceholder: "gsk_..."
  },
  {
    id: "openai",
    name: "OpenAI",
    icon: "🤖",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "o1", "o1-mini"],
    defaultModel: "gpt-4o",
    baseUrl: "https://api.openai.com",
    keyPrefix: "sk-",
    keyPlaceholder: "sk-..."
  },
  {
    id: "anthropic",
    name: "Anthropic",
    icon: "🧠",
    models: ["claude-sonnet-4-5", "claude-haiku-4-5", "claude-opus-4-5"],
    defaultModel: "claude-sonnet-4-5",
    baseUrl: "https://api.anthropic.com",
    keyPrefix: "sk-ant-",
    keyPlaceholder: "sk-ant-..."
  },
  {
    id: "gemini",
    name: "Gemini",
    icon: "💎",
    models: ["gemini-2.0-flash", "gemini-2.0-pro", "gemini-1.5-flash", "gemini-1.5-pro"],
    defaultModel: "gemini-2.0-flash",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    keyPrefix: "AIza",
    keyPlaceholder: "AIza..."
  },
  {
    id: "xai",
    name: "xAI",
    icon: "𝕏",
    models: ["grok-3", "grok-3-mini", "grok-2"],
    defaultModel: "grok-3-mini",
    baseUrl: "https://api.x.ai",
    keyPrefix: "xai-",
    keyPlaceholder: "xai-..."
  },
  {
    id: "mistral",
    name: "Mistral",
    icon: "🌊",
    models: ["mistral-small-latest", "mistral-large-latest", "codestral-latest"],
    defaultModel: "mistral-small-latest",
    baseUrl: "https://api.mistral.ai",
    keyPrefix: "",
    keyPlaceholder: "Your Mistral API key"
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    icon: "🐋",
    models: ["deepseek-chat", "deepseek-reasoner"],
    defaultModel: "deepseek-chat",
    baseUrl: "https://api.deepseek.com",
    keyPrefix: "sk-",
    keyPlaceholder: "sk-..."
  },
  {
    id: "cerebras",
    name: "Cerebras",
    icon: "🧩",
    models: ["llama3.1-70b", "llama3.1-8b"],
    defaultModel: "llama3.1-70b",
    baseUrl: "https://api.cerebras.ai",
    keyPrefix: "csk-",
    keyPlaceholder: "csk-..."
  },
  {
    id: "fireworks",
    name: "Fireworks",
    icon: "🎆",
    models: ["accounts/fireworks/models/llama-v3p3-70b-instruct", "accounts/fireworks/models/mixtral-8x7b-instruct"],
    defaultModel: "accounts/fireworks/models/llama-v3p3-70b-instruct",
    baseUrl: "https://api.fireworks.ai/inference",
    keyPrefix: "fw-",
    keyPlaceholder: "fw-..."
  },
  {
    id: "sambanova",
    name: "SambaNova",
    icon: "🔥",
    models: ["Meta-Llama-3.1-405B-Instruct", "Meta-Llama-3.1-70B-Instruct"],
    defaultModel: "Meta-Llama-3.1-70B-Instruct",
    baseUrl: "https://api.sambanova.ai",
    keyPrefix: "",
    keyPlaceholder: "Your SambaNova API key"
  },
  {
    id: "ollama",
    name: "Ollama (Local)",
    icon: "🦙",
    models: [],
    defaultModel: "llama3.2",
    baseUrl: "http://localhost:11434",
    keyPrefix: "",
    keyPlaceholder: "No key needed"
  }
];

export function getProvider(id: string): Provider | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

/** localStorage key for a provider's API key */
export function providerKeyStorageKey(providerId: string): string {
  return `studio-os-chat:apikey:${providerId}`;
}

export function loadApiKey(providerId: string): string {
  return localStorage.getItem(providerKeyStorageKey(providerId)) ?? "";
}

export function saveApiKey(providerId: string, key: string): void {
  if (key.trim()) {
    localStorage.setItem(providerKeyStorageKey(providerId), key.trim());
  } else {
    localStorage.removeItem(providerKeyStorageKey(providerId));
  }
}

export function deleteApiKey(providerId: string): void {
  localStorage.removeItem(providerKeyStorageKey(providerId));
}
