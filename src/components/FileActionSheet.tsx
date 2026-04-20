import { ActionSheetBase } from "./ActionSheetBase";
import type { FileRootRecord } from "../lib/types";

function relativeTime(ts: number | null): string {
  if (!ts) return "Not indexed yet";
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
  root: FileRootRecord | null;
  onClose: () => void;
  onReindex: (rootId: string) => void;
  onCopyName: (name: string) => void;
  onRemove: (rootId: string) => void;
}

export function FileActionSheet({
  root,
  onClose,
  onReindex,
  onCopyName,
  onRemove,
}: Props) {
  if (!root) return null;

  return (
    <ActionSheetBase onBackdropClick={onClose} ariaLabel="File source actions" zIndex={1100}>
      <div className="action-sheet-handle" />

      <div className="action-sheet-detail">
        <div className="action-sheet-detail-meta">
          <span className="action-sheet-detail-badge">
            {root.kind === "directory" ? "Folder" : "Files"}
          </span>
          <span className="action-sheet-detail-time">
            {relativeTime(root.lastIndexedAt)}
          </span>
        </div>
        <div className="action-sheet-detail-title">{root.name}</div>
      </div>

      <div className="action-sheet-divider" />

      <div className="action-sheet-actions">
        <button
          className="action-sheet-btn"
          onClick={() => { onReindex(root.id); onClose(); }}
        >
          <span className="action-sheet-btn-icon">↻</span>
          <span className="action-sheet-btn-label">
            <strong>Re-index</strong>
            <span className="action-sheet-btn-hint">Refresh this source</span>
          </span>
        </button>

        <button
          className="action-sheet-btn"
          onClick={() => { onCopyName(root.name); onClose(); }}
        >
          <span className="action-sheet-btn-icon">⎘</span>
          <span className="action-sheet-btn-label">
            <strong>Copy source name</strong>
            <span className="action-sheet-btn-hint">{root.name}</span>
          </span>
        </button>

        <button
          className="action-sheet-btn action-sheet-btn--destructive"
          onClick={() => { onRemove(root.id); onClose(); }}
        >
          <span className="action-sheet-btn-icon">🗑</span>
          <span className="action-sheet-btn-label">
            <strong>Remove source</strong>
            <span className="action-sheet-btn-hint">Remove from indexed sources</span>
          </span>
        </button>
      </div>

      <button className="action-sheet-cancel" onClick={onClose}>Cancel</button>
    </ActionSheetBase>
  );
}
