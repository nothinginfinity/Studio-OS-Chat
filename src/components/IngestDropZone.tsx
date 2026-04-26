/**
 * IngestDropZone.tsx
 *
 * File upload drop zone for OCR + PDF + CSV ingestion.
 * - Drag-and-drop or click-to-browse
 * - Routes to ingestImageAsMarkdown() for images, ingestPdfAsMarkdown() for PDFs,
 *   ingestCsv() for CSVs
 * - PDFs: ingestPdfAsMarkdown() handles its own indexing internally — do NOT call indexFile() again
 * - CSVs: ingestCsv() returns chunkText; we wrap it as a synthetic .txt and index via indexFile()
 * - Images: OCR output is wrapped as a synthetic .md file and indexed via indexFile()
 * - Mode selector for OCR: screenshot / document / code / receipt
 * - Auto-selects "document" mode when a multi-page image (non-PDF) is detected
 * - Shows per-file progress and result status
 *
 * FIX-002-F1: added .csv,text/csv to <input accept>
 * FIX-002-F2: added isCsv branch in processFile() routing to csvIngestion
 * FIX-002-F3: updated drop zone label/subtitle to include CSV
 */
import { useState, useRef, useCallback } from "react";
import { ingestImageAsMarkdown } from "../lib/ocr";
import { ingestPdfAsMarkdown } from "../lib/pdfIngestion";
import { ingestCsv } from "../lib/csvIngestion";
import { indexFile } from "../lib/fileIndex";
import type { OCRMode } from "../lib/types";

type FileStatus = "pending" | "processing" | "done" | "error";

interface FileItem {
  name: string;
  status: FileStatus;
  message?: string;
}

// Fallback rootId — replace with active session/root context when wiring to useChat
const DEFAULT_ROOT = "default";

export function IngestDropZone() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [mode, setMode] = useState<OCRMode>("screenshot");
  const inputRef = useRef<HTMLInputElement>(null);

  function updateFile(name: string, patch: Partial<FileItem>) {
    setFiles((prev) =>
      prev.map((f) => (f.name === name ? { ...f, ...patch } : f))
    );
  }

  async function processFile(file: File) {
    const isImage = file.type.startsWith("image/");
    const isPdf =
      file.type === "application/pdf" || file.name.endsWith(".pdf");
    // FIX-002-F2: detect CSV by MIME type or extension
    const isCsv =
      file.type === "text/csv" ||
      file.type === "application/csv" ||
      file.name.toLowerCase().endsWith(".csv");

    if (!isImage && !isPdf && !isCsv) {
      updateFile(file.name, { status: "error", message: "Unsupported type" });
      return;
    }

    updateFile(file.name, { status: "processing" });
    try {
      if (isPdf) {
        // ingestPdfAsMarkdown writes its own FileRecord, chunks, and term
        // entries to IndexedDB. Do NOT call indexFile() here — that would
        // create a second, duplicate entry under a different fileId.
        const result = await ingestPdfAsMarkdown(file, DEFAULT_ROOT);
        if (!result) {
          updateFile(file.name, { status: "error", message: "PDF extraction returned no content" });
          return;
        }

        updateFile(file.name, {
          status: "done",
          message: `Indexed — ${result.pageCount} page${
            result.pageCount !== 1 ? "s" : ""
          } ✓`,
        });
      } else if (isCsv) {
        // FIX-002-F2: route CSV through the Phase 6 ingestion pipeline
        const result = await ingestCsv(file);
        if (!result) {
          updateFile(file.name, { status: "error", message: "CSV parsing returned no content" });
          return;
        }

        // Wrap the tab-separated chunk text as a synthetic .txt so indexFile
        // can chunk + store it with real searchable text content
        const textBlob = new Blob([result.chunkText], { type: "text/plain" });
        const syntheticFile = new File([textBlob], file.name + ".txt", {
          type: "text/plain",
          lastModified: Date.now(),
        });
        await indexFile(syntheticFile, DEFAULT_ROOT, file.name + ".txt");

        updateFile(file.name, {
          status: "done",
          message: `CSV indexed — ${result.csvMeta.rowCount} rows, ${result.csvMeta.columns.length} columns ✓`,
        });
      } else {
        // Auto-select "document" mode for images that look like document scans
        // (large files >200 KB are likely scanned pages, not UI screenshots)
        const effectiveMode: OCRMode =
          mode === "screenshot" && file.size > 200_000 ? "document" : mode;

        const result = await ingestImageAsMarkdown(file, DEFAULT_ROOT, effectiveMode);
        if (!result) {
          updateFile(file.name, { status: "error", message: "OCR returned no content" });
          return;
        }

        // Wrap the markdown text as a synthetic File so indexFile can chunk + store it
        const markdownBlob = new Blob([result.markdown], { type: "text/plain" });
        const syntheticFile = new File([markdownBlob], file.name + ".md", {
          type: "text/plain",
          lastModified: Date.now(),
        });
        await indexFile(syntheticFile, DEFAULT_ROOT, file.name + ".md");

        updateFile(file.name, {
          status: "done",
          message: `OCR done — ${result.wordCount} words ✓`,
        });
      }
    } catch (err) {
      updateFile(file.name, {
        status: "error",
        message: err instanceof Error ? err.message : "Failed",
      });
    }
  }

  async function handleFiles(list: FileList | null) {
    if (!list) return;
    const incoming: FileItem[] = Array.from(list).map((f) => ({
      name: f.name,
      status: "pending" as FileStatus,
    }));
    setFiles((prev) => [...incoming, ...prev]);
    for (const file of Array.from(list)) {
      await processFile(file);
    }
  }

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [mode]
  );

  const statusIcon = (s: FileStatus) => {
    if (s === "pending") return "⏳";
    if (s === "processing") return "⚙️";
    if (s === "done") return "✅";
    return "❌";
  };

  const OCR_MODES: { value: OCRMode; label: string }[] = [
    { value: "screenshot", label: "Screenshot" },
    { value: "document", label: "Document" },
    { value: "code", label: "Code" },
    { value: "receipt", label: "Receipt" },
  ];

  return (
    <div className="ingest-zone-wrapper">
      {/* Mode selector — only relevant for images */}
      <div className="ingest-mode-row">
        <span className="ingest-mode-label">OCR mode:</span>
        {OCR_MODES.map((m) => (
          <button
            key={m.value}
            className={`ingest-mode-btn${
              mode === m.value ? " ingest-mode-btn--active" : ""
            }`}
            onClick={() => setMode(m.value)}
            // E.3-F4: aria-pressed exposes selected state to AT — 4.1.2 Name, Role, Value
            aria-pressed={mode === m.value}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Drop zone */}
      <div
        className={`ingest-dropzone${
          dragging ? " ingest-dropzone--drag" : ""
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        // E.3-F2: Dynamic aria-label exposes drag-active state to AT — 4.1.2 Name, Role, Value
        aria-label={
          dragging
            ? "Drop files now — ready to receive"
            : "Drop files or click to upload"
        }
        tabIndex={0}
        onKeyDown={(e) => {
          // E.3-F1: Space key triggers upload (ARIA APG button pattern requires Enter + Space)
          // preventDefault on Space prevents unintended page scroll
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
      >
        <span className="ingest-dropzone-icon">📂</span>
        {/* FIX-002-F3: updated label to include CSV */}
        <span className="ingest-dropzone-label">Drop images, PDFs, or CSVs here</span>
        <span className="ingest-dropzone-sub">
          Images → OCR ({mode}) · PDFs → text extraction · CSVs → structured index
        </span>
        {/* FIX-002-F1: added .csv,text/csv to accept */}
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.pdf,.csv,text/csv"
          multiple
          style={{ display: "none" }}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {/* File status list */}
      {files.length > 0 && (
        // E.3-F3: role="log" + aria-live="polite" announces status updates to AT — 4.1.3 Status Messages
        <ul
          className="ingest-file-list"
          role="log"
          aria-live="polite"
          aria-label="File processing status"
        >
          {files.map((f) => (
            <li
              key={f.name}
              className={`ingest-file-item ingest-file-item--${f.status}`}
            >
              {/* E.3-F5: aria-hidden removes emoji from AT read order — status conveyed by f.message text — 1.3.1 */}
              <span className="ingest-file-icon" aria-hidden="true">{statusIcon(f.status)}</span>
              <span className="ingest-file-name">{f.name}</span>
              {f.message && (
                <span className="ingest-file-msg">{f.message}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
