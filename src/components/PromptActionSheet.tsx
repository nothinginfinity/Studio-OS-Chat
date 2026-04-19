import { createPortal } from "react-dom";
import type { PromptHistoryItem } from "../lib/types";

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

interface Props {
  prompt: PromptHistoryItem | null;
  onClose: () => void;
  onReuse: (text: string) => void;
  onNewChat: (text: string) => void;
  onCopy: (text: string) => void;
  onOpenSession: (sessionId: string) => void;
}

export function PromptActionSheet({
  prompt,
  onClose,
  onReuse,
  onNewChat,
  onCopy,
  onOpenSession,
}: Props) {
  if (!prompt) return null;

  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  return createPortal(
    <div
      className="action-sheet-backdrop"
      onClick={handleBackdrop}
      role="dialog"
      aria-modal="true"
      aria-label="Prompt actions"
    >
      <div className="action-sheet">
        <div className="action-sheet-handle" />

        {/* Full prompt detail */}
        <div className="action-sheet-detail">
          <div className="action-sheet-detail-meta">
            <span className="action-sheet-detail-session">{prompt.sessionTitle}</span>
            <span className="action-sheet-detail-time">{relativeTime(prompt.createdAt)}</span>
            {prompt.model && (
              <span className="action-sheet-detail-model">{prompt.model}</span>
            )}
          </div>
          <p className="action-sheet-detail-text">{prompt.promptText}</p>
        </div>

        <div className="action-sheet-divider" />

        {/* Actions */}
        <div className="action-sheet-actions">
          <button
            className="action-sheet-btn"
            onClick={() => { onReuse(prompt.promptText); onClose(); }}
          >
            <span className="action-sheet-btn-icon">↩</span>
            <span className="action-sheet-btn-label">
              <strong>Reuse in current chat</strong>
              <span className="action-sheet-btn-hint">Paste into composer</span>
            </span>
          </button>
          <button
            className="action-sheet-btn"
            onClick={() => { onNewChat(prompt.promptText); onClose(); }}
          >
            <span className="action-sheet-btn-icon">✦</span>
            <span className="action-sheet-btn-label">
              <strong>New chat with this</strong>
              <span className="action-sheet-btn-hint">Start a fresh conversation</span>
            </span>
          </button>
          <button
            className="action-sheet-btn"
            onClick={() => { onCopy(prompt.promptText); onClose(); }}
          >
            <span className="action-sheet-btn-icon">⎘</span>
            <span className="action-sheet-btn-label">
              <strong>Copy to clipboard</strong>
              <span className="action-sheet-btn-hint">Copy full prompt text</span>
            </span>
          </button>
          <button
            className="action-sheet-btn"
            onClick={() => { onOpenSession(prompt.sessionId); onClose(); }}
          >
            <span className="action-sheet-btn-icon">↗</span>
            <span className="action-sheet-btn-label">
              <strong>Open conversation</strong>
              <span className="action-sheet-btn-hint">{prompt.sessionTitle}</span>
            </span>
          </button>
        </div>

        <button className="action-sheet-cancel" onClick={onClose}>Cancel</button>
      </div>
    </div>,
    document.body
  );
}
