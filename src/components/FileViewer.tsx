import { useState, useEffect } from "react";
import type { FileRecord } from "../lib/types";
import { listChunksByFile } from "../lib/db";
import { CsvTableView } from "./CsvTableView";

const PAGE_SIZE = 100;

interface Props {
  file: FileRecord;
}

// ── Minimal stubs for non-CSV viewers (Phase 5 will fill these) ───────────────

function PdfView({ text }: { text: string }) {
  return (
    <div className="fv-text-view">
      <pre className="fv-pre">{text}</pre>
    </div>
  );
}

function ImageView({ file }: { file: FileRecord }) {
  return (
    <div className="fv-unsupported">
      <span className="fv-unsupported-icon">🖼</span>
      <p>Image viewer coming in Phase 5.</p>
      <p className="fv-unsupported-name">{file.name}</p>
    </div>
  );
}

function PlainTextView({ text }: { text: string }) {
  return (
    <div className="fv-text-view">
      <pre className="fv-pre">{text}</pre>
    </div>
  );
}

function UnsupportedView({ file }: { file: FileRecord }) {
  return (
    <div className="fv-unsupported">
      <span className="fv-unsupported-icon">📄</span>
      <p>This file type is not yet supported in the viewer.</p>
      <p className="fv-unsupported-name">{file.name}</p>
    </div>
  );
}

// ── FileViewer: dispatches by sourceType ──────────────────────────────────────

export function FileViewer({ file }: Props) {
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [textContent, setTextContent] = useState<string>("");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setPage(0);

    (async () => {
      try {
        const chunks = await listChunksByFile(file.id);
        const allText = chunks.map(c => c.text).join("\n");

        if (file.sourceType === "csv" && file.csvMeta) {
          // Parse stored chunk text back into row objects
          const lines = allText.split("\n").filter(l => l.trim() !== "");
          if (lines.length === 0) { setRows([]); setHeaders([]); return; }
          const cols = file.csvMeta.columns.map(c => c.name);
          setHeaders(cols);
          const parsed = lines.map(line => {
            const vals = line.split(",");
            const row: Record<string, string> = {};
            cols.forEach((col, i) => { row[col] = vals[i] ?? ""; });
            return row;
          });
          setRows(parsed);
        } else {
          setTextContent(allText);
        }
      } catch (e) {
        setError("Failed to load file content.");
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [file.id]);

  if (loading) {
    return (
      <div className="fv-loading">
        <span className="fv-spinner">&#9696;</span> Loading&hellip;
      </div>
    );
  }

  if (error) {
    return <div className="fv-error">{error}</div>;
  }

  switch (file.sourceType) {
    case "csv":
      return (
        <CsvTableView
          rows={rows}
          headers={headers}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
          csvMeta={file.csvMeta}
        />
      );
    case "pdf":
      return <PdfView text={textContent} />;
    case "ocr":
    case "file":
      return file.ext && ["png", "jpg", "jpeg", "gif", "webp", "bmp"].includes(file.ext.toLowerCase())
        ? <ImageView file={file} />
        : <PlainTextView text={textContent} />;
    case "paste":
    case "chat-export":
      return <PlainTextView text={textContent} />;
    default:
      return <UnsupportedView file={file} />;
  }
}
