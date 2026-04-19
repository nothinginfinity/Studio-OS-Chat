import { ActionSheetBase } from "./ActionSheetBase";
import type { ChatSession } from "../lib/types";

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
  session: ChatSession | null;
  onClose: () => void;
  onOpen: (sessionId: string) => void;
  onRename: (sessionId: string) => void;
  onExport: (sessionId: string) => void;
  onCopyExportPath: (path: string) => void;
  onDelete: (sessionId: string) => void;
}

export function ChatActionSheet({
  session,
  onClose,
  onOpen,
  onRename,
  onExport,
  onCopyExportPath,
  onDelete,
}: Props) {
  if (!session) return null;

  const exported = !!session.exportRef;
  const msgCount = session.messages.length;

  return (
    <ActionSheetBase onBackdropClick={onClose} ariaLabel="Chat actions" zIndex={1100}>
      <div className="action-sheet-handle" />

      {/* Session detail header */}
      <div className="action-sheet-detail">
        <div className="action-sheet-detail-meta">
          {exported && (
            <span className="action-sheet-detail-badge">Exported</span>
          )}
          <span className="action-sheet-detail-time">
            {relativeTime(session.updatedAt)}
          </span>
          <span className="action-sheet-detail-time">
            {msgCount} {msgCount === 1 ? "message" : "messages"}
          </span>
        </div>
        <div className="action-sheet-detail-title">{session.title}</div>
        {exported && session.exportRef?.exportPath && (
          <div className="action-sheet-export-path">
            {session.exportRef.exportPath}
          </div>
        )}
      </div>

      <div className="action-sheet-divider" />

      <div className="action-sheet-actions">
        <button
          className="action-sheet-btn"
          onClick={() => { onOpen(session.id); onClose(); }}
        >
          <span className="action-sheet-btn-icon">💬</span>
          <span className="action-sheet-btn-label">
            <strong>Open chat</strong>
            <span className="action-sheet-btn-hint">Switch to this conversation</span>
          </span>
        </button>

        <button
          className="action-sheet-btn"
          onClick={() => { onRename(session.id); onClose(); }}
        >
          <span className="action-sheet-btn-icon">✏️</span>
          <span className="action-sheet-btn-label">
            <strong>Rename</strong>
            <span className="action-sheet-btn-hint">Edit conversation title</span>
          </span>
        </button>

        <button
          className="action-sheet-btn"
          onClick={() => { onExport(session.id); onClose(); }}
        >
          <span className="action-sheet-btn-icon">⬆️</span>
          <span className="action-sheet-btn-label">
            <strong>Export chat</strong>
            <span className="action-sheet-btn-hint">Save as .osmd to GitHub</span>
          </span>
        </button>

        {exported && session.exportRef?.exportPath && (
          <button
            className="action-sheet-btn"
            onClick={() => {
              onCopyExportPath(session.exportRef!.exportPath);
              onClose();
            }}
          >
            <span className="action-sheet-btn-icon">⎘</span>
            <span className="action-sheet-btn-label">
              <strong>Copy export path</strong>
              <span className="action-sheet-btn-hint">{session.exportRef.exportPath}</span>
            </span>
          </button>
        )}

        <button
          className="action-sheet-btn action-sheet-btn--destructive"
          onClick={() => { onDelete(session.id); onClose(); }}
        >
          <span className="action-sheet-btn-icon">🗑</span>
          <span className="action-sheet-btn-label">
            <strong>Delete chat</strong>
            <span className="action-sheet-btn-hint">Remove this conversation</span>
          </span>
        </button>
      </div>

      <button className="action-sheet-cancel" onClick={onClose}>Cancel</button>
    </ActionSheetBase>
  );
}
