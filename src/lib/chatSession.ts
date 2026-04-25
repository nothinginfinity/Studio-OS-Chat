import type { ChatSession } from './types';

/**
 * Options for creating a new chat session.
 * attachedFileId links the session to an ingested FileRecord for LLM analysis.
 * All fields are optional; a plain session is created when omitted.
 */
export interface ChatSessionOptions {
  /** The FileRecord.id to attach to this session. When set, the chat UI should
   *  prepend file context (built by fileContext.ts, task 4.1) before the first
   *  user message is sent to the LLM. */
  attachedFileId?: string;
  /** Optional override for the session title. Defaults to 'New Chat'. */
  title?: string;
}

/**
 * Creates a new in-memory ChatSession object.
 * Does NOT persist to IndexedDB — call db.saveSession() to persist.
 * Does NOT make any LLM call.
 *
 * @param options - Optional configuration including attachedFileId.
 * @returns A fully-initialised ChatSession ready to be stored and rendered.
 */
export function createChatSession(options: ChatSessionOptions = {}): ChatSession & { attachedFileId?: string } {
  const now = Date.now();
  const id = crypto.randomUUID();

  return {
    id,
    title: options.title ?? 'New Chat',
    titleSource: 'auto',
    createdAt: now,
    updatedAt: now,
    messages: [],
    // Phase 4 extension: file attachment
    ...(options.attachedFileId !== undefined
      ? { attachedFileId: options.attachedFileId }
      : {}),
  };
}

/**
 * Returns true if the given session was created with a file attachment.
 * Use this to decide whether to inject file context before the first LLM call.
 */
export function isFileAttachedSession(
  session: ChatSession & { attachedFileId?: string }
): session is ChatSession & { attachedFileId: string } {
  return typeof session.attachedFileId === 'string' && session.attachedFileId.length > 0;
}
