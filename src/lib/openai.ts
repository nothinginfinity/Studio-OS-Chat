/**
 * openai.ts — OpenAI-compatible /v1/chat/completions client.
 * Works with Groq, OpenAI, Gemini (OpenAI compat), xAI, Mistral,
 * DeepSeek, Cerebras, Fireworks, SambaNova.
 * Anthropic uses a different API shape — handled separately.
 */

import type { OllamaMessage, ToolCall, ToolDefinition } from "./types";

export interface OpenAIStreamCallbacks {
  onTextDelta: (chunk: string) => void;
  onToolCalls?: (calls: ToolCall[]) => void;
}

export interface OpenAIStreamParams {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: OllamaMessage[];
  tools?: ToolDefinition[];
}

function buildTools(tools: ToolDefinition[]) {
  return tools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema
    }
  }));
}

function buildMessages(messages: OllamaMessage[]) {
  return messages.map((m) => {
    const base: Record<string, unknown> = { role: m.role, content: m.content };
    if (m.tool_calls) base.tool_calls = m.tool_calls.map((tc) => ({
      id: tc.id ?? "call_0",
      type: "function",
      function: { name: tc.function.name, arguments: JSON.stringify(tc.function.arguments) }
    }));
    if (m.tool_call_id) base.tool_call_id = m.tool_call_id;
    if (m.tool_name) base.name = m.tool_name;
    return base;
  });
}

/** Streaming chat — yields text deltas and accumulates tool calls */
export async function chatWithOpenAIStream(
  params: OpenAIStreamParams,
  callbacks: OpenAIStreamCallbacks
): Promise<{ content: string; toolCalls: ToolCall[] }> {
  const { baseUrl, apiKey, model, messages, tools } = params;

  const body: Record<string, unknown> = {
    model,
    messages: buildMessages(messages),
    stream: true
  };
  if (tools && tools.length > 0) {
    body.tools = buildTools(tools);
    body.tool_choice = "auto";
  }

  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${err}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let fullContent = "";
  const toolCallMap: Map<number, { id: string; name: string; argsRaw: string }> = new Map();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    for (const line of chunk.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") break;
      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta;
        if (!delta) continue;

        // Text delta
        if (delta.content) {
          fullContent += delta.content;
          callbacks.onTextDelta(delta.content);
        }

        // Tool call deltas (streamed in chunks)
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx: number = tc.index ?? 0;
            if (!toolCallMap.has(idx)) {
              toolCallMap.set(idx, { id: tc.id ?? `call_${idx}`, name: "", argsRaw: "" });
            }
            const entry = toolCallMap.get(idx)!;
            if (tc.function?.name) entry.name += tc.function.name;
            if (tc.function?.arguments) entry.argsRaw += tc.function.arguments;
          }
        }
      } catch {
        // ignore malformed lines
      }
    }
  }

  const toolCalls: ToolCall[] = [];
  for (const [, entry] of toolCallMap) {
    let args: Record<string, unknown> = {};
    try { args = JSON.parse(entry.argsRaw); } catch { args = {}; }
    toolCalls.push({ id: entry.id, function: { name: entry.name, arguments: args } });
  }

  if (toolCalls.length > 0) callbacks.onToolCalls?.(toolCalls);

  return { content: fullContent, toolCalls };
}

/** Single non-streaming call for tool follow-ups */
export async function chatWithOpenAIOnce(
  params: OpenAIStreamParams
): Promise<{ content: string }> {
  const { baseUrl, apiKey, model, messages, tools } = params;

  const body: Record<string, unknown> = {
    model,
    messages: buildMessages(messages)
  };
  if (tools && tools.length > 0) {
    body.tools = buildTools(tools);
    body.tool_choice = "auto";
  }

  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${err}`);
  }

  const json = await res.json();
  return { content: json.choices?.[0]?.message?.content ?? "" };
}
