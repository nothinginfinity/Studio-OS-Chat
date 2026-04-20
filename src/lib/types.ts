export type Role = "system" | "user" | "assistant" | "tool";
export type MessageStatus = "complete" | "streaming" | "error";

export type SourceType = "file" | "ocr" | "pdf" | "paste" | "chat-export";
export type OCRMode = "screenshot" | "document" | "code" | "receipt";

export type PromptScore = 1 | 2 | 3 | 4 | 5;
export type UsageSource = "provider" | "estimated" | "unknown";

export type PromptRelationType =
  | "previous"
  | "next"
  | "revision"
  | "variant"
  | "derived_from";

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
  // prompt asset metadata (additive, backward-compatible)
  provider?: string;
  model?: string;
  inputTokenCount?: number;
  inputTokenEstimate?: number;
  outputTokenCount?: number;
  outputTokenEstimate?: number;
  usageSource?: UsageSource;
  latencyMs?: number;
  promptAssetId?: string;
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
  provider: string;
  apiKey: string;
}

// ── System Prompt Library ─────────────────────────────────────────────────────

export interface SystemPromptRecord {
  id: string;
  name: string;
  content: string;
  isPinned: boolean;
  createdAt: number;
  updatedAt: number;
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
  // prompt asset metadata (additive, backward-compatible)
  provider?: string;
  model?: string;
  inputTokenCount?: number;
  inputTokenEstimate?: number;
  outputTokenCount?: number;
  outputTokenEstimate?: number;
  usageSource?: UsageSource;
  latencyMs?: number;
  promptAssetId?: string;
}

// ── Prompt asset types ────────────────────────────────────────────────────────

export interface PromptAssetRecord {
  id: string;
  sourceMessageId: string;
  sessionId: string;
  responseMessageId?: string;
  promptText: string;
  createdAt: number;
  updatedAt: number;
  promotedAt: number;
  starred: boolean;
  pinned: boolean;
  archived: boolean;
  rating?: PromptScore;
  tags: string[];
  notes?: string;
  provider?: string;
  model?: string;
  inputTokenCount?: number;
  inputTokenEstimate?: number;
  outputTokenCount?: number;
  outputTokenEstimate?: number;
  usageSource: UsageSource;
  latencyMs?: number;
  outcomeLabel?: "useful" | "funny" | "failed" | "draft" | "reference";
}

export interface PromptRelationRecord {
  id: string;
  fromPromptAssetId: string;
  toPromptAssetId: string;
  type: PromptRelationType;
  createdAt: number;
}

export interface PromptHistoryItem {
  messageId: string;
  sessionId: string;
  promptText: string;
  createdAt: number;
  sessionTitle: string;
  provider?: string;
  model?: string;
  assetId?: string;
  starred?: boolean;
  pinned?: boolean;
  rating?: PromptScore;
}

export interface PromptLibraryFilters {
  query: string;
  tags: string[];
  starredOnly: boolean;
  pinnedOnly: boolean;
  sortBy: "recent" | "oldest" | "rating";
}

export interface PromotePromptInput {
  sourceMessageId: string;
  sessionId: string;
  promptText: string;
  responseMessageId?: string;
  provider?: string;
  model?: string;
  inputTokenEstimate?: number;
  outputTokenEstimate?: number;
  inputTokenCount?: number;
  outputTokenCount?: number;
  usageSource?: UsageSource;
  latencyMs?: number;
  starred?: boolean;
  pinned?: boolean;
  rating?: PromptScore;
  tags?: string[];
  notes?: string;
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
  sourceType: SourceType;
  ocrMode?: OCRMode;
  ingestedAt: number;
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
  kind: string;
  slug: string;
  createdAt: number;
  manifest: string;
  repoUrl?: string;
  format?: "osmd@1";
  primaryPath?: string;
}

// ── OSMD export types ─────────────────────────────────────────────────────────

export interface ChatExportRef {
  artifactId: string;
  slug: string;
  exportPath: string;
  exportedAt: number;
  format: "osmd@1";
}

export interface OSMDMeta {
  id: string;
  sessionId: string;
  title: string;
  sessionDate: string;
  createdAt: string;
  updatedAt: string;
  exportedAt: string;
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
  date: string;
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
