import { useState, useEffect } from "react";
import type { FileRecord, ChartSpec } from "../lib/types";
import { listChunksByFile } from "../lib/db";
import { CsvTableView } from "./CsvTableView";
import { JsonTreeView } from "./JsonTreeView";
import { MarkdownView } from "./MarkdownView";
import { OcrImageView } from "./OcrImageView";
import { inferChartSpecs } from "../lib/chartTemplates";

const PAGE_SIZE = 100;

interface Props {
  file: FileRecord;
  /** Called once CSV rows + inferred chart specs are ready. */
  onDataReady?: (rows: Record<string, string>[], specs: ChartSpec[]) => void;
}

// ── Viewer sub-components ─────────────────────────────────────────────────────

function PdfView({ text }: { text: string }) {
  return (
    <div className="fv-text-view">
      <pre className="fv-pre">{text}</pre>
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

// A-2: Richer unsupported-type fallback
const SUPPORTED_EXTENSIONS = [
  "csv", "pdf", "json",
  "md", "txt",
  "png", "jpg", "jpeg", "gif", "webp", "bmp",
];

function UnsupportedView({ file }: { file: FileRecord }) {
  const ext = file.ext?.toLowerCase() ?? "";
  const extLabel = ext ? `.${ext}` : "unknown";
  return (
    <div className="fv-unsupported">
      <span className="fv-unsupported-icon">🚫</span>
      <p className="fv-unsupported-title">File type not supported</p>
      <p className="fv-unsupported-name">{file.name}</p>
      <p className="fv-unsupported-detail">
        <strong>{extLabel}</strong> files cannot be previewed in this viewer.
      </p>
      <p className="fv-unsupported-hint">
        Supported types:{" "}
        {SUPPORTED_EXTENSIONS.map(e => (
          <code key={e} className="fv-unsupported-ext">.{e}</code>
        ))}
      </p>
    </div>
  );
}

// ── FileViewer: dispatches by sourceType + ext ────────────────────────────────

export function FileViewer({ file, onDataReady }: Props) {
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
          const lines = allText.split("\n").filter(l => l.trim() !== "");
          if (lines.length === 0) {
            setRows([]);
            setHeaders([]);
            onDataReady?.([], []);
            return;
          }
          const cols = file.csvMeta.columns.map(c => c.name);
          setHeaders(cols);
          // A.6 fix: chunkText is tab-separated (csvIngestion.ts uses \t)
          const parsed = lines.map(line => {
            const vals = line.split("\t");
            const row: Record<string, string> = {};
            cols.forEach((col, i) => { row[col] = vals[i] ?? ""; });
            return row;
          });
          setRows(parsed);

          const specs = inferChartSpecs(file.id, file.csvMeta, parsed);
          onDataReady?.(parsed, specs);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const ext = file.ext?.toLowerCase() ?? "";

  // A-2: Full dispatch by sourceType
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
    case "file": {
      if (["png", "jpg", "jpeg", "gif", "webp", "bmp"].includes(ext)) {
        // A-2: dispatch to OcrImageView (full impl in C-2)
        return <OcrImageView file={file} />;
      }
      if (ext === "json") {
        return <JsonTreeView raw={textContent} />;
      }
      if (ext === "md" || ext === "txt") {
        return <MarkdownView text={textContent} />;
      }
      return <PlainTextView text={textContent} />;
    }

    case "paste":
    case "chat-export":
      return <PlainTextView text={textContent} />;

    default:
      return <UnsupportedView file={file} />;
  }
}
