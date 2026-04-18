import type { OllamaMessage, OllamaToolSpec, ToolDefinition } from "./types";

interface ChatRequest {
  baseUrl: string;
  model: string;
  messages: OllamaMessage[];
  tools?: OllamaToolSpec[];
}

interface OllamaChatResponse {
  message?: {
    role: string;
    content: string;
    tool_calls?: Array<{
      function: {
        name: string;
        arguments: Record<string, unknown>;
      };
    }>;
  };
}

export function buildOllamaTools(tools: ToolDefinition[]): OllamaToolSpec[] {
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema
    }
  }));
}

export async function chatWithOllamaOnce({
  baseUrl,
  model,
  messages,
  tools
}: ChatRequest): Promise<OllamaChatResponse> {
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: false, tools })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ollama error: ${response.status} ${text}`);
  }

  return (await response.json()) as OllamaChatResponse;
}

export async function chatWithOllamaStream(
  { baseUrl, model, messages, tools }: ChatRequest,
  handlers: {
    onTextDelta: (chunk: string) => void;
    onToolCalls?: (
      toolCalls: Array<{
        function: {
          name: string;
          arguments: Record<string, unknown>;
        };
      }>
    ) => void;
  }
): Promise<OllamaChatResponse> {
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, tools, stream: true })
  });

  if (!response.ok || !response.body) {
    const text = await response.text();
    throw new Error(`Ollama error: ${response.status} ${text}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalPayload: OllamaChatResponse = {};

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const payload = JSON.parse(trimmed) as OllamaChatResponse & { done?: boolean };
      finalPayload = payload;

      const delta = payload.message?.content ?? "";
      if (delta) handlers.onTextDelta(delta);

      const toolCalls = payload.message?.tool_calls;
      if (toolCalls?.length) {
        handlers.onToolCalls?.(toolCalls);
      }
    }
  }

  return finalPayload;
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
