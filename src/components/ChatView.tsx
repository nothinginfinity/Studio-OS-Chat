/**
 * ChatView.tsx — Task 4.4
 *
 * Wraps <ChatWindow> and injects an "attached file" badge banner
 * above the message composer when the current session has an
 * attachedFileId set (created via createChatSession({ attachedFileId })).
 *
 * Props contract:
 *   session        — the active ChatSession (extended with optional attachedFileId)
 *   files          — the full list of FileRecord objects (for name look-up)
 *   onDetachFile?  — optional callback when user dismisses the badge
 *   ...rest        — all ChatWindow props forwarded as-is
 *
 * No LLM call is made here. Badge is purely presentational.
 */

import type { ChatMessage, FileRecord, ChatSession } from '../lib/types';
import { ChatWindow } from './ChatWindow';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SessionWithAttachment = ChatSession & { attachedFileId?: string };

interface ChatViewProps {
  session: SessionWithAttachment;
  files: FileRecord[];
  messages: ChatMessage[];
  onSend: (text: string) => Promise<void>;
  isLoading: boolean;
  error: string;
  draftText: string;
  onDraftChange: (text: string) => void;
  /** Called when the user taps ✕ on the file badge to detach the file. */
  onDetachFile?: () => void;
}

// ---------------------------------------------------------------------------
// AttachedFileBadge — internal sub-component
// ---------------------------------------------------------------------------

interface BadgeProps {
  fileName: string;
  onDismiss?: () => void;
}

function AttachedFileBadge({ fileName, onDismiss }: BadgeProps) {
  return (
    <div className="attached-file-badge" role="status" aria-label={`Attached file: ${fileName}`}>
      <span className="attached-file-badge__icon" aria-hidden="true">📎</span>
      <span className="attached-file-badge__name">{fileName}</span>
      {onDismiss !== undefined && (
        <button
          className="attached-file-badge__dismiss"
          onClick={onDismiss}
          aria-label="Detach file"
          type="button"
        >
          ✕
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChatView — public export
// ---------------------------------------------------------------------------

export function ChatView({
  session,
  files,
  messages,
  onSend,
  isLoading,
  error,
  draftText,
  onDraftChange,
  onDetachFile,
}: ChatViewProps) {
  // Resolve the attached file record (undefined if no attachment or file not found)
  const attachedFile: FileRecord | undefined =
    session.attachedFileId !== undefined
      ? files.find((f) => f.id === session.attachedFileId)
      : undefined;

  return (
    <div className="chat-view">
      {attachedFile !== undefined && (
        <AttachedFileBadge
          fileName={attachedFile.name}
          onDismiss={onDetachFile}
        />
      )}
      <ChatWindow
        messages={messages}
        onSend={onSend}
        isLoading={isLoading}
        error={error}
        sessionId={session.id}
        draftText={draftText}
        onDraftChange={onDraftChange}
      />
    </div>
  );
}
