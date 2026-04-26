import { useState, useEffect, useRef, useCallback } from "react";
import type { FileRecord, ChartSpec } from "../lib/types";
import { FileViewer } from "./FileViewer";
import { ViewerErrorBoundary } from "./ViewerErrorBoundary";
import { CsvChartPanel } from "./CsvChartPanel";
import { listChunksByFile } from "../lib/db";

interface Props {
  file: FileRecord | null;
  onClose: () => void;
  /** Legacy: open file content as raw text in a plain chat session. */
  onOpenInChat?: (file: FileRecord, contextText: string) => void;
  /** Phase 4: open an LLM-backed analysis session attached to this file.
   *  Only shown for CSV files. The caller creates the session via
   *  createChatSession({ attachedFileId: file.id }) and navigates to chat. */
  onAnalyzeInChat?: (file: FileRecord) => void;
  /** A-3: called when user taps Re-index */
  onReindex?: (fileId: string) => void;
  /** A-3: called when user taps Remove */
  onRemove?: (fileId: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric",
  });
}

/** Returns all focusable elements inside a container, in DOM order. */
function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
      'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter(el => !el.closest('[aria-hidden="true"]'));
}

export function FileViewerModal({ file, onClose, onOpenInChat, onAnalyzeInChat, onReindex, onRemove }: Props) {
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [shared, setShared] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const triggerRef = useRef<Element | null>(null);

  useEffect(() => {
    triggerRef.current = document.activeElement;
    closeBtnRef.current?.focus();
    return () => {
      if (triggerRef.current && "focus" in triggerRef.current) {
        (triggerRef.current as HTMLElement).focus();
      }
    };
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab" || !shellRef.current) return;
      const focusable = getFocusable(shellRef.current);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [chartSpecs, setChartSpecs] = useState<ChartSpec[]>([]);

  useEffect(() => {
    setCsvRows([]);
    setChartSpecs([]);
  }, [file?.id]);

  const handleDataReady = useCallback(
    (rows: Record<string, string>[], specs: ChartSpec[]) => {
      setCsvRows(rows);
      setChartSpecs(specs);
    },
    [],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  if (!file) return null;

  // ── Toolbar actions ─────────────────────────────────────────────────────────

  async function handleCopyAsMarkdown() {
    try {
      const chunks = await listChunksByFile(file!.id);
      let md = `# ${file!.name}\n\n`;
      if (file!.sourceType === "csv" && file!.csvMeta) {
        const cols = file!.csvMeta.columns.map(c => c.name);
        md += `| ${cols.join(" | ")} |\n`;
        md += `| ${cols.map(() => "---").join(" | ")} |\n`;
        const lines = chunks.map(c => c.text).join("\n").split("\n").filter(l => l.trim());
        lines.slice(0, 200).forEach(line => {
          const vals = line.split(",");
          md += `| ${cols.map((_, i) => (vals[i] ?? "").trim()).join(" | ")} |\n`;
        });
        if (lines.length > 200) md += `\n_…${lines.length - 200} more rows omitted_\n`;
      } else {
        md += chunks.map(c => c.text).join("\n");
      }
      await navigator.clipboard.writeText(md);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  }

  async function handleExportCsv() {
    if (file!.sourceType !== "csv" || !file!.csvMeta) return;
    setExporting(true);
    try {
      const chunks = await listChunksByFile(file!.id);
      const cols = file!.csvMeta.columns.map(c => c.name);
      const header = cols.map(c => `"${c.replace(/"/g, '""')}"`).join(",");
      const bodyLines = chunks.map(c => c.text).join("\n").split("\n").filter(l => l.trim());
      const csv = [header, ...bodyLines].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file!.name.replace(/\.csv$/i, "") + "_export.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // download failed silently
    } finally {
      setExporting(false);
    }
  }

  async function handleOpenInChat() {
    if (!onOpenInChat) return;
    const chunks = await listChunksByFile(file!.id);
    const context = chunks.slice(0, 20).map(c => c.text).join("\n");
    onOpenInChat(file!, context);
    onClose();
  }

  function handleAnalyzeInChat() {
    if (!onAnalyzeInChat) return;
    onAnalyzeInChat(file!);
    onClose();
  }

  // A-3: Share — Web Share API
  async function handleShare() {
    try {
      const chunks = await listChunksByFile(file!.id);
      const text = chunks.map(c => c.text).join("\n");
      await navigator.share({ text, title: file!.name });
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch {
      // share cancelled or unavailable — silent
    }
  }

  // A-3: Re-index
  function handleReindex() {
    if (!onReindex) return;
    onReindex(file!.id);
    onClose();
  }

  // A-3: Remove
  function handleRemove() {
    if (!onRemove) return;
    onRemove(file!.id);
    onClose();
  }

  const isCsv = file.sourceType === "csv";
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <div
      className="fvm-backdrop"
      ref={backdropRef}
      onClick={e => { if (e.target === backdropRef.current) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={`File viewer: ${file.name}`}
    >
      <div className="fvm-shell" ref={shellRef}>

        {/* ── Header bar ── */}
        <div className="fvm-header">
          <div className="fvm-header-left">
            <span className="fvm-file-icon">{isCsv ? "📊" : "📄"}</span>
            <div className="fvm-title-group">
              <span className="fvm-filename">{file.name}</span>
              <span className="fvm-filemeta">
                {formatBytes(file.size)}
                {file.ingestedAt ? ` · ${formatDate(file.ingestedAt)}` : ""}
                {isCsv && file.csvMeta
                  ? ` · ${file.csvMeta.rowCount.toLocaleString()} rows · ${file.csvMeta.columns.length} cols`
                  : ""}
              </span>
            </div>
          </div>
          <button
            ref={closeBtnRef}
            className="fvm-close-btn"
            onClick={onClose}
            aria-label="Close viewer"
            type="button"
          >
            ✕
          </button>
        </div>

        {/* ── Toolbar ── */}
        <div className="fvm-toolbar">
          <button
            className="fvm-tool-btn"
            onClick={handleCopyAsMarkdown}
            title="Copy as Markdown"
            type="button"
          >
            <span className="fvm-tool-icon">{copied ? "✓" : "⌘"}</span>
            <span>{copied ? "Copied!" : "Copy as Markdown"}</span>
          </button>

          {/* A-3: Share via Web Share API */}
          {canShare && (
            <button
              className="fvm-tool-btn"
              onClick={handleShare}
              title="Share"
              type="button"
            >
              <span className="fvm-tool-icon">{shared ? "✓" : "↥"}</span>
              <span>{shared ? "Shared!" : "Share"}</span>
            </button>
          )}

          {onOpenInChat && (
            <button
              className="fvm-tool-btn"
              onClick={handleOpenInChat}
              title="Open in Chat"
              type="button"
            >
              <span className="fvm-tool-icon">✨</span>
              <span>Open in Chat</span>
            </button>
          )}

          {isCsv && onAnalyzeInChat && (
            <button
              className="fvm-tool-btn fvm-tool-btn--analyze"
              onClick={handleAnalyzeInChat}
              title="Analyze this file with the LLM"
              type="button"
            >
              <span className="fvm-tool-icon">🔬</span>
              <span>Analyze in Chat</span>
            </button>
          )}

          {isCsv && (
            <button
              className="fvm-tool-btn"
              onClick={handleExportCsv}
              disabled={exporting}
              title="Export CSV"
              type="button"
            >
              <span className="fvm-tool-icon">↧</span>
              <span>{exporting ? "Exporting…" : "Export CSV"}</span>
            </button>
          )}

          {/* A-3: Re-index */}
          {onReindex && (
            <button
              className="fvm-tool-btn"
              onClick={handleReindex}
              title="Re-index this file"
              type="button"
            >
              <span className="fvm-tool-icon">↻</span>
              <span>Re-index</span>
            </button>
          )}

          {/* A-3: Remove */}
          {onRemove && (
            <button
              className="fvm-tool-btn fvm-tool-btn--destructive"
              onClick={handleRemove}
              title="Remove this file"
              type="button"
            >
              <span className="fvm-tool-icon">🗑️</span>
              <span>Remove</span>
            </button>
          )}
        </div>

        {/* ── Content area ── */}
        <div className="fvm-content">
          <ViewerErrorBoundary>
            <FileViewer file={file} onDataReady={handleDataReady} />
          </ViewerErrorBoundary>
          {isCsv && chartSpecs.length > 0 && (
            <CsvChartPanel specs={chartSpecs} rows={csvRows} />
          )}
        </div>

      </div>
    </div>
  );
}
