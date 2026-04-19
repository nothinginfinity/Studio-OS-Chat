export type Role = "system" | "user" | "assistant" | "tool";
export type MessageStatus = "complete" | "streaming" | "error";

export type SourceType = "file" | "ocr" | "pdf" | "paste" | "chat-export";
export type OCRMode = "screenshot" | "document" | "code" | "receipt";

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
  exportRef?: ChatExportRef;
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
  exportArtifactId?: string;
  exportPath?: string;
  exportedAt?: number;
  exportFormat?: "osmd@1";
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
  /** How this file entered the system */
  sourceType: SourceType;
  /** Set only when sourceType === "ocr" */
  ocrMode?: OCRMode;
  /** Unix ms when ingestion pipeline completed (may differ from indexedAt for async OCR) */
  ingestedAt: number;
  /** For OCR/PDF: id of the original binary FileRecord this was derived from */
  sourceFileId?: string;
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

// ── Artifact store (chat exports) ─────────────────────────────────────────────

export interface ArtifactRecord {
  id: string;
  sessionId: string;
  /** "chat-export" | future types */
  kind: string;
  /** ISO filename-safe slug, e.g. "2026-04-19-my-chat" */
  slug: string;
  createdAt: number;
  /** Serialised JSON blob of the export manifest */
  manifest: string;
  /** Optional GitHub repo URL if pushed */
  repoUrl?: string;
  /** Canonical export format */
  format?: "osmd@1";
  /** Main artifact path for quick lookup */
  primaryPath?: string;
}

// ── OSMD export types ─────────────────────────────────────────────────────────

export interface ChatExportRef {
  artifactId: string;
  slug: string;
  exportPath: string;          // exports/chats/<filename>.osmd
  exportedAt: number;          // unix ms
  format: "osmd@1";
}

export interface OSMDMeta {
  id: string;                  // artifact/session export id
  sessionId: string;
  title: string;
  sessionDate: string;         // ISO
  createdAt: string;           // ISO
  updatedAt: string;           // ISO
  exportedAt: string;          // ISO
  provider?: string;
  model?: string;
  messageCount: number;
  toolCallCount: number;
  fileRefs: string[];
  tags: string[];
  exportPath: string;
  format: "osmd@1";
}

export interface OSMDIndexEntry {
  id: string;
  sessionId: string;
  title: string;
  date: string;                // YYYY-MM-DD
  path: string;
  summary: string | null;
  tags: string[];
  messageCount: number;
  exportedAt: string;
  provider?: string;
  model?: string;
  format: "osmd@1";
}

export interface OSMDIndex {
  version: "osmd-index@1";
  updatedAt: string;
  exports: OSMDIndexEntry[];
}

// ── Perplexity Space records ──────────────────────────────────────────────────

export interface SpaceRecord {
  id: string;
  name: string;
  spaceUrl: string;
  /** Markdown dropped into the Space as context */
  contextMarkdown: string;
  promptTemplates: string[];
  inboundMailboxPath: string;
  outboundMailboxPath: string;
  attachedRepoUrl?: string;
  attachedSessionId?: string;
  createdAt: number;
  updatedAt: number;
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
