import { useState, useEffect, useRef, useCallback } from "react";
import type { FileRecord, ChartSpec } from "../lib/types";
import { FileViewer } from "./FileViewer";
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

export function FileViewerModal({ file, onClose, onOpenInChat, onAnalyzeInChat }: Props) {
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Lifted CSV state — populated via FileViewer's onDataReady callback
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [chartSpecs, setChartSpecs] = useState<ChartSpec[]>([]);

  // Reset chart/rows state whenever the viewed file changes
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

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Trap scroll behind modal
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

  const isCsv = file.sourceType === "csv";

  return (
    <div
      className="fvm-backdrop"
      ref={backdropRef}
      onClick={e => { if (e.target === backdropRef.current) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={`File viewer: ${file.name}`}
    >
      <div className="fvm-shell">

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
          <button className="fvm-close-btn" onClick={onClose} aria-label="Close viewer">
            ✕
          </button>
        </div>

        {/* ── Toolbar ── */}
        <div className="fvm-toolbar">
          <button
            className="fvm-tool-btn"
            onClick={handleCopyAsMarkdown}
            title="Copy as Markdown"
          >
            <span className="fvm-tool-icon">{copied ? "✓" : "⌘"}</span>
            <span>{copied ? "Copied!" : "Copy as Markdown"}</span>
          </button>

          {onOpenInChat && (
            <button
              className="fvm-tool-btn"
              onClick={handleOpenInChat}
              title="Open in Chat"
            >
              <span className="fvm-tool-icon">✨</span>
              <span>Open in Chat</span>
            </button>
          )}

          {/* Phase 4: Analyze in Chat — CSV only, LLM opt-in */}
          {isCsv && onAnalyzeInChat && (
            <button
              className="fvm-tool-btn fvm-tool-btn--analyze"
              onClick={handleAnalyzeInChat}
              title="Analyze this file with the LLM"
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
            >
              <span className="fvm-tool-icon">↧</span>
              <span>{exporting ? "Exporting…" : "Export CSV"}</span>
            </button>
          )}
        </div>

        {/* ── Content area ── */}
        <div className="fvm-content">
          <FileViewer file={file} onDataReady={handleDataReady} />
          {isCsv && chartSpecs.length > 0 && (
            <CsvChartPanel specs={chartSpecs} rows={csvRows} />
          )}
        </div>

      </div>
    </div>
  );
}
