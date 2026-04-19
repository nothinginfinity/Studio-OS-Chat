import type { PromptHistoryItem } from "../lib/types";

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

  return (
    <div
      className="action-sheet-backdrop"
      onClick={handleBackdrop}
      role="dialog"
      aria-modal="true"
      aria-label="Prompt actions"
    >
      <div className="action-sheet">
        <div className="action-sheet-handle" />
        <p className="action-sheet-preview">{prompt.promptText.slice(0, 120)}{prompt.promptText.length > 120 ? "…" : ""}</p>
        <div className="action-sheet-actions">
          <button
            className="action-sheet-btn"
            onClick={() => { onReuse(prompt.promptText); onClose(); }}
          >
            ↩ Reuse in current chat
          </button>
          <button
            className="action-sheet-btn"
            onClick={() => { onNewChat(prompt.promptText); onClose(); }}
          >
            ✦ New chat with this
          </button>
          <button
            className="action-sheet-btn"
            onClick={() => { onCopy(prompt.promptText); onClose(); }}
          >
            ⎘ Copy to clipboard
          </button>
          <button
            className="action-sheet-btn"
            onClick={() => { onOpenSession(prompt.sessionId); onClose(); }}
          >
            ↗ Open conversation
          </button>
        </div>
        <button className="action-sheet-cancel" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
