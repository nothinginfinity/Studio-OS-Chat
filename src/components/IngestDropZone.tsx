/**
 * IngestDropZone.tsx
 *
 * File upload drop zone for OCR + PDF ingestion.
 * - Drag-and-drop or click-to-browse
 * - Routes to ingestImageAsMarkdown() for images, ingestPdfAsMarkdown() for PDFs
 * - Mode selector for OCR: screenshot / document / code / receipt
 * - Shows per-file progress and result status
 */
import { useState, useRef, useCallback } from "react";
import { ingestImageAsMarkdown } from "../lib/ocr";
import { ingestPdfAsMarkdown } from "../lib/pdfIngestion";
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

    if (!isImage && !isPdf) {
      updateFile(file.name, { status: "error", message: "Unsupported type" });
      return;
    }

    updateFile(file.name, { status: "processing" });
    try {
      if (isPdf) {
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
      } else {
        const result = await ingestImageAsMarkdown(file, DEFAULT_ROOT, mode);
        if (!result) {
          updateFile(file.name, { status: "error", message: "OCR returned no content" });
          return;
        }
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
        aria-label="Drop files or click to upload"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
      >
        <span className="ingest-dropzone-icon">📂</span>
        <span className="ingest-dropzone-label">Drop images or PDFs here</span>
        <span className="ingest-dropzone-sub">
          Images → OCR ({mode}) · PDFs → text extraction
        </span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.pdf"
          multiple
          style={{ display: "none" }}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {/* File status list */}
      {files.length > 0 && (
        <ul className="ingest-file-list">
          {files.map((f) => (
            <li
              key={f.name}
              className={`ingest-file-item ingest-file-item--${f.status}`}
            >
              <span className="ingest-file-icon">{statusIcon(f.status)}</span>
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
