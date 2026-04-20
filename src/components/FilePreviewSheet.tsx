import { useEffect, useState } from "react";
import { ActionSheetBase } from "./ActionSheetBase";
import { listFilesByRoot, listChunksByFile } from "../lib/db";
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
  return days < 7 ? `${days}d ago` : new Date(ts).toLocaleDateString();
}

const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

interface Props {
  root: FileRootRecord | null;
  onClose: () => void;
  onReindex: (rootId: string) => void;
  onRemove: (rootId: string) => void;
  onNewChatFromFile: (rootId: string, previewText: string, name: string) => void;
}

export function FilePreviewSheet({ root, onClose, onReindex, onRemove, onNewChatFromFile }: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const [fileCount, setFileCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!root) { setPreview(null); setFileCount(0); return; }
    setLoading(true);
    setExpanded(false);
    (async () => {
      try {
        const files = await listFilesByRoot(root.id);
        setFileCount(files.length);
        if (files.length === 0) { setPreview(null); return; }
        const chunks = await listChunksByFile(files[0].id);
        const text = chunks.slice(0, 3).map(c => c.text).join("\n\n").trim();
        setPreview(text || null);
      } catch {
        setPreview(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [root?.id]);

  if (!root) return null;

  const displayText = preview
    ? (expanded ? preview : preview.slice(0, 420) + (preview.length > 420 ? "…" : ""))
    : null;

  function handleCopy() {
    if (!preview) return;
    navigator.clipboard.writeText(preview).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }).catch(() => {});
  }

  function handleShare() {
    if (!preview || !canShare) return;
    navigator.share({ title: root!.name, text: preview }).catch(() => {});
  }

  function handleSummarize() {
    onNewChatFromFile(root!.id, preview ?? "", root!.name);
    onClose();
  }

  return (
    <ActionSheetBase onBackdropClick={onClose} ariaLabel="File source preview" zIndex={1100}>
      <div className="action-sheet-handle" />

      {/* ── Header ── */}
      <div className="action-sheet-detail">
        <div className="action-sheet-detail-meta">
          <span className="action-sheet-detail-badge">
            {root.kind === "directory" ? "Folder" : "Files"}
          </span>
          {fileCount > 0 && (
            <span className="action-sheet-detail-badge fps-badge-neutral">
              {fileCount} file{fileCount !== 1 ? "s" : ""}
            </span>
          )}
          <span className="action-sheet-detail-time">{relativeTime(root.lastIndexedAt)}</span>
        </div>
        <div className="action-sheet-detail-title">{root.name}</div>
      </div>

      {/* ── Content preview pane ── */}
      {loading && (
        <div className="fps-preview fps-preview--loading">
          <span className="fps-preview-spinner">&#9696;</span> Loading preview&hellip;
        </div>
      )}

      {!loading && displayText && (
        <div className="fps-preview">
          <div className="fps-preview-label">Preview</div>
          <pre className="fps-preview-text">{displayText}</pre>
          {preview && preview.length > 420 && (
            <button
              className="fps-preview-expand"
              onClick={() => setExpanded(e => !e)}
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      )}

      {!loading && !displayText && root.lastIndexedAt && (
        <div className="fps-preview fps-preview--empty">
          No text content available for preview.
        </div>
      )}

      {!loading && !root.lastIndexedAt && (
        <div className="fps-preview fps-preview--empty">
          Not yet indexed &mdash; re-index to generate a preview.
        </div>
      )}

      <div className="action-sheet-divider" />

      {/* ── Actions ── */}
      <div className="action-sheet-actions">

        {preview && (
          <button className="action-sheet-btn" onClick={handleSummarize}>
            <span className="action-sheet-btn-icon">✨</span>
            <span className="action-sheet-btn-label">
              <strong>Summarize in new chat</strong>
              <span className="action-sheet-btn-hint">Send file context to a fresh chat</span>
            </span>
          </button>
        )}

        {preview && (
          <button className="action-sheet-btn" onClick={handleCopy}>
            <span className="action-sheet-btn-icon">{copied ? "✓" : "⌘"}</span>
            <span className="action-sheet-btn-label">
              <strong>{copied ? "Copied!" : "Copy text"}</strong>
              <span className="action-sheet-btn-hint">Copy preview text to clipboard</span>
            </span>
          </button>
        )}

        {preview && canShare && (
          <button className="action-sheet-btn" onClick={handleShare}>
            <span className="action-sheet-btn-icon">↥</span>
            <span className="action-sheet-btn-label">
              <strong>Share</strong>
              <span className="action-sheet-btn-hint">Share file content via system sheet</span>
            </span>
          </button>
        )}

        <button
          className="action-sheet-btn"
          onClick={() => { onReindex(root.id); onClose(); }}
        >
          <span className="action-sheet-btn-icon">↻</span>
          <span className="action-sheet-btn-label">
            <strong>Re-index</strong>
            <span className="action-sheet-btn-hint">Refresh indexed content</span>
          </span>
        </button>

        <button
          className="action-sheet-btn action-sheet-btn--destructive"
          onClick={() => { onRemove(root.id); onClose(); }}
        >
          <span className="action-sheet-btn-icon">🗑️</span>
          <span className="action-sheet-btn-label">
            <strong>Remove source</strong>
            <span className="action-sheet-btn-hint">Delete from indexed sources</span>
          </span>
        </button>

      </div>

      <button className="action-sheet-cancel" onClick={onClose}>Cancel</button>
    </ActionSheetBase>
  );
}
