import { useState, useEffect } from "react";
import type { FileRecord } from "../lib/types";
import { listChunksByFile } from "../lib/db";

// ── OCR mode display helpers ──────────────────────────────────────────────────

const MODE_LABELS: Record<string, string> = {
  screenshot: "Screenshot",
  document:   "Document",
  code:       "Code / Terminal",
  receipt:    "Receipt",
};

const MODE_ICONS: Record<string, string> = {
  screenshot: "🖥",
  document:   "📄",
  code:       "💻",
  receipt:    "🧾",
};

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * C-2: OcrImageView — full implementation.
 *
 * Loads OCR-extracted text from IndexedDB chunks and renders it with:
 *  - A mode badge (screenshot / document / code / receipt)
 *  - File name header
 *  - Full extracted text in a scrollable <pre>
 *  - Copy-to-clipboard button
 *  - Empty-state message when no OCR text is found
 *
 * Note: The original image bitmap is not stored in IndexedDB — only the OCR
 * text output is persisted at ingest time. This viewer surfaces that text.
 */
export function OcrImageView({ file }: { file: FileRecord }) {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLoading(true);
    listChunksByFile(file.id)
      .then(chunks => {
        const combined = chunks.map(c => c.text).join("\n");
        setText(combined.trim() || null);
      })
      .catch(() => setText(null))
      .finally(() => setLoading(false));
  }, [file.id]);

  const mode = file.ocrMode ?? null;
  const modeLabel = mode ? (MODE_LABELS[mode] ?? mode) : null;
  const modeIcon  = mode ? (MODE_ICONS[mode]  ?? "🖼")  : "🖼";

  function handleCopy() {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  if (loading) {
    return (
      <div className="fv-loading">
        <span className="fv-spinner">&#9696;</span> Loading OCR text&hellip;
      </div>
    );
  }

  return (
    <div className="ocr-image-view">
      {/* ── Header ── */}
      <div className="ocr-image-view__header">
        <span className="ocr-image-view__icon" aria-hidden="true">{modeIcon}</span>
        <div className="ocr-image-view__meta">
          <p className="ocr-image-view__name">{file.name}</p>
          {modeLabel && (
            <span className="ocr-image-view__badge" role="note" aria-label={`OCR mode: ${modeLabel}`}>
              {modeLabel}
            </span>
          )}
        </div>
        {text && (
          <button
            type="button"
            className="ocr-image-view__copy-btn"
            onClick={handleCopy}
            aria-label="Copy extracted text to clipboard"
          >
            {copied ? "✅ Copied" : "Copy text"}
          </button>
        )}
      </div>

      {/* ── Body ── */}
      {text ? (
        <div className="ocr-image-view__body">
          <pre className="ocr-image-view__pre">{text}</pre>
        </div>
      ) : (
        <div className="ocr-image-view__empty" role="status">
          <span className="ocr-image-view__empty-icon" aria-hidden="true">🔍</span>
          <p className="ocr-image-view__empty-title">No OCR text available</p>
          <p className="ocr-image-view__empty-detail">
            This image was indexed but no extracted text was found.
            Re-index the file to attempt OCR again.
          </p>
        </div>
      )}
    </div>
  );
}
