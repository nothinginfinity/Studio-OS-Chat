/**
 * IngestDropZone.tsx
 *
 * File upload drop zone for OCR + PDF + CSV ingestion.
 * - Drag-and-drop or click-to-browse
 * - Routes to ingestImageAsMarkdown() for images, ingestPdfAsMarkdown() for PDFs,
 *   ingestCsv() for CSVs
 * - PDFs: ingestPdfAsMarkdown() handles its own indexing internally
 * - CSVs: ingestCsv() returns chunkText; wrapped as synthetic .txt and indexed via indexFile()
 * - Images: OCR output wrapped as synthetic .md and indexed via indexFile()
 * - Mode selector for OCR: screenshot / document / code / receipt
 * - Auto-selects "document" mode when a multi-page image (non-PDF) is detected
 * - Shows per-file progress and result status
 *
 * C-4: drag-over feedback — accent border, tinted bg, icon scale spring, drop success flash
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
import "../phase4.css";

type FileStatus = "pending" | "processing" | "done" | "error";

interface FileItem {
  name: string;
  status: FileStatus;
  message?: string;
}

const DEFAULT_ROOT = "default";

export function IngestDropZone() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [dropSuccess, setDropSuccess] = useState(false);
  const [mode, setMode] = useState<OCRMode>("screenshot");
  const inputRef = useRef<HTMLInputElement>(null);
  const dropSuccessTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function updateFile(name: string, patch: Partial<FileItem>) {
    setFiles((prev) =>
      prev.map((f) => (f.name === name ? { ...f, ...patch } : f))
    );
  }

  async function processFile(file: File) {
    const isImage = file.type.startsWith("image/");
    const isPdf =
      file.type === "application/pdf" || file.name.endsWith(".pdf");
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
        const result = await ingestCsv(file);
        if (!result) {
          updateFile(file.name, { status: "error", message: "CSV parsing returned no content" });
          return;
        }
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
        const effectiveMode: OCRMode =
          mode === "screenshot" && file.size > 200_000 ? "document" : mode;
        const result = await ingestImageAsMarkdown(file, DEFAULT_ROOT, effectiveMode);
        if (!result) {
          updateFile(file.name, { status: "error", message: "OCR returned no content" });
          return;
        }
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
      setDropSuccess(true);
      if (dropSuccessTimer.current) clearTimeout(dropSuccessTimer.current);
      dropSuccessTimer.current = setTimeout(() => setDropSuccess(false), 300);
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

  const dropzoneClass = [
    "ingest-dropzone",
    dragging ? "ingest-dropzone--drag" : "",
    dropSuccess ? "ingest-dropzone--drop-success" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className="ingest-zone-wrapper">
      <div className="ingest-mode-row">
        <span className="ingest-mode-label">OCR mode:</span>
        {OCR_MODES.map((m) => (
          <button
            key={m.value}
            className={`ingest-mode-btn${
              mode === m.value ? " ingest-mode-btn--active" : ""
            }`}
            onClick={() => setMode(m.value)}
            aria-pressed={mode === m.value}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div
        className={dropzoneClass}
        data-testid="ingest-dropzone"
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        aria-label={
          dragging
            ? "Drop files now — ready to receive"
            : "Drop files or click to upload"
        }
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
      >
        <span
          className={`ingest-dropzone-icon${
            dragging ? " ingest-dropzone-icon--drag" : ""
          }`}
          aria-hidden="true"
        >📂</span>
        <span className="ingest-dropzone-label">Drop images, PDFs, or CSVs here</span>
        <span className="ingest-dropzone-sub">
          Images → OCR ({mode}) · PDFs → text extraction · CSVs → structured index
        </span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.pdf,.csv,text/csv"
          multiple
          style={{ display: "none" }}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {files.length > 0 && (
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
