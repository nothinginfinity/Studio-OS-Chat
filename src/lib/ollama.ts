import type { OllamaMessage, OllamaToolSpec, ToolDefinition } from "./types";

interface ChatRequest {
  baseUrl: string;
  model: string;
  messages: OllamaMessage[];
  tools?: OllamaToolSpec[];
}

interface RawToolCall {
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

export interface OllamaChatResponse {
  message?: {
    role: string;
    content: string;
    tool_calls?: RawToolCall[];
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
    onToolCalls?: (toolCalls: RawToolCall[]) => void;
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

  // Accumulate across all chunks instead of keeping only the last payload
  let accumulatedText = "";
  const accumulatedToolCalls: RawToolCall[] = [];

  function processLine(line: string) {
    const trimmed = line.trim();
    if (!trimmed) return;

    let payload: OllamaChatResponse & { done?: boolean };
    try {
      payload = JSON.parse(trimmed) as OllamaChatResponse & { done?: boolean };
    } catch {
      return; // skip malformed lines
    }

    const delta = payload.message?.content ?? "";
    if (delta) {
      accumulatedText += delta;
      handlers.onTextDelta(delta);
    }

    const toolCalls = payload.message?.tool_calls;
    if (toolCalls?.length) {
      accumulatedToolCalls.push(...toolCalls);
      handlers.onToolCalls?.(toolCalls);
    }
  }

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      processLine(line);
    }
  }

  // Flush any trailing buffered line that did not end with \n
  if (buffer.trim()) {
    processLine(buffer);
  }

  // Return synthesized response built from accumulations, not the final stats chunk
  return {
    message: {
      role: "assistant",
      content: accumulatedText,
      tool_calls: accumulatedToolCalls.length ? accumulatedToolCalls : undefined
    }
  };
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
