import type { OllamaMessage } from "./types";

interface ChatRequest {
  baseUrl: string;
  model: string;
  messages: OllamaMessage[];
}

interface OllamaChatResponse {
  message?: {
    role: string;
    content: string;
  };
}

export async function chatWithOllama({
  baseUrl,
  model,
  messages
}: ChatRequest): Promise<string> {
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: false })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ollama error: ${response.status} ${text}`);
  }

  const data = (await response.json()) as OllamaChatResponse;
  return data.message?.content ?? "";
}

export async function listOllamaModels(baseUrl: string): Promise<string[]> {
  const response = await fetch(`${baseUrl}/api/tags`);
  if (!response.ok) {
    throw new Error(`Failed to load models: ${response.status}`);
  }
  const data = await response.json();
  const models = Array.isArray(data.models) ? data.models : [];
  return models
    .map((m: any) => m.name)
    .filter((name: unknown): name is string => typeof name === "string");
}
