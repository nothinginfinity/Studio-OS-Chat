export type Role = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
  toolName?: string;
  toolData?: unknown;
}

export interface ChatSettings {
  ollamaBaseUrl: string;
  model: string;
  systemPrompt: string;
}

export interface OllamaMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  run: (args: unknown) => Promise<unknown>;
}
