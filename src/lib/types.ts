export type Role = "system" | "user" | "assistant" | "tool";
export type MessageStatus = "complete" | "streaming" | "error";

export interface ToolCall {
  id?: string;
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

// ── Chat (in-memory / React state) ───────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
  status?: MessageStatus;
  toolName?: string;
  toolData?: unknown;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

export interface ChatSession {
  id: string;
  title: string;
  titleSource: "auto" | "manual";
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

export interface ChatSettings {
  ollamaBaseUrl: string;
  model: string;
  systemPrompt: string;
  /** Active provider id — e.g. "groq", "openai", "ollama" */
  provider: string;
  /** API key for the active provider (not used for Ollama) */
  apiKey: string;
}

// ── IndexedDB records ─────────────────────────────────────────────────────────

export interface SessionRecord {
  id: string;
  title: string;
  titleSource: "auto" | "manual";
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

export interface MessageRecord {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "tool";
  content: string;
  createdAt: number;
  status?: MessageStatus;
  toolName?: string;
  toolData?: unknown;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

export interface FileRootRecord {
  id: string;
  name: string;
  kind: "directory" | "files";
  addedAt: number;
  lastIndexedAt: number | null;
}

export interface FileRecord {
  id: string;
  rootId: string;
  path: string;
  name: string;
  ext: string;
  size: number;
  modifiedAt: number;
  contentHash: string;
  indexedAt: number;
}

export interface ChunkRecord {
  id: string;
  fileId: string;
  ordinal: number;
  text: string;
  textLower: string;
  tokenCount: number;
}

export interface TermRecord {
  term: string;
  chunkId: string;
  tf: number;
}

export interface SearchResult {
  fileId: string;
  filePath: string;
  chunkId: string;
  snippet: string;
  score: number;
  ordinal: number;
}

// ── Ollama transport ──────────────────────────────────────────────────────────

export interface OllamaToolSpec {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface OllamaMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  run: (args: unknown) => Promise<unknown>;
}
