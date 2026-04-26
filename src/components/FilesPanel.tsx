import { useState, useCallback } from "react";
import { useFiles } from "../hooks/useFiles";
import { searchLocalIndex } from "../lib/search";
import { listChunksByFile, listFilesByRoot } from "../lib/db";
import { parseRow } from "../lib/csvIngestion";
import type { SearchResult, FileRecord, FileRootRecord } from "../lib/types";
import { FilePreviewSheet } from "./FilePreviewSheet";
import { FileViewerModal } from "./FileViewerModal";
import type { IndexedDocument } from "./FileViewerModal";
import { useLongPress } from "../hooks/useLongPress";
import { StorageQuotaBar } from "./StorageQuotaBar";
import { IngestDropZone } from "./IngestDropZone";
import "../files.css";
import "../phase4.css";

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

function FileRootCard({
  root,
  onLongPress,
  onOpenInViewer,
}: {
  root: FileRootRecord;
  onLongPress: (root: FileRootRecord) => void;
  onOpenInViewer: (root: FileRootRecord) => void;
}) {
  const { bind, isPressed, longPressTriggeredRef } = useLongPress({
    onLongPress: () => onLongPress(root),
  });

  function handleClick() {
    if (longPressTriggeredRef.current) return;
    onOpenInViewer(root);
  }

  return (
    <div
      data-testid="file-root-card"
      className={[
        "file-root-card",
        "lp-item",
        isPressed ? "lp-item--pressed" : "",
      ].filter(Boolean).join(" ")}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={`Open ${root.name} in file viewer`}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleClick(); }}
      {...bind}
    >
      <div className="file-root-card-name">
        <span aria-hidden="true">{root.kind === "directory" ? "📁" : "📄"}</span>
        &nbsp;&nbsp;{root.name}
      </div>
      <div className="file-root-card-meta">
        <span className="file-root-card-kind">
          {root.kind === "directory" ? "Folder" : "Files"}
        </span>
        <span className="file-root-card-time">{relativeTime(root.lastIndexedAt)}</span>
      </div>
    </div>
  );
}

function FilesPanelEmptyState({ onAddFiles }: { onAddFiles: () => void }) {
  return (
    <div className="files-empty-state" role="region" aria-label="No files indexed">
      <span className="files-empty-state-icon" aria-hidden="true">🗂️</span>
      <h3 className="files-empty-state-heading">No files yet</h3>
      <p className="files-empty-state-subtext">
        Drop a CSV, image, PDF, or Markdown file to get started.
      </p>
      <button
        className="files-empty-state-cta"
        onClick={onAddFiles}
        aria-label="Add a file to get started"
      >
        <span aria-hidden="true">➕</span> Add a file
      </button>
    </div>
  );
}

/**
 * chunkTextToTableRows — parses chunk text stored by ingestCsv() back into
 * rows and headers for the FileViewerModal table/chart tabs.
 *
 * ingestCsv() stores chunkText as TSV (tab-separated). This function detects
 * that and splits on tabs. For legacy chunks stored as comma-CSV it falls back
 * to parseRow() (RFC 4180 parser from csvIngestion.ts).
 *
 * FIX-003: replaced the previous ad-hoc split-on-comma parser with this
 * TSV-aware version that delegates to the canonical parseRow() for CSV.
 */
function chunkTextToTableRows(text: string): { rows: Record<string, string>[]; headers: string[] } {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(Boolean);
  if (!lines.length) return { rows: [], headers: [] };

  const isTsv = lines[0].includes("\t");

  const splitLine = (line: string): string[] =>
    isTsv ? line.split("\t") : parseRow(line);

  const headers = splitLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const values = splitLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });
    return row;
  });

  return { rows, headers };
}

/** Adapter: converts a FileRecord to the IndexedDocument shape FileViewerModal expects */
function fileRecordToIndexedDoc(file: FileRecord): IndexedDocument {
  return {
    id: file.id,
    name: file.name,
    sourceType: (file.sourceType ?? 'unknown') as IndexedDocument['sourceType'],
    content: (file as unknown as Record<string, unknown>).content,
    chartSpecs: file.chartSpecs,
  };
}

export function FilesPanel() {
  const { roots, progress, isIndexing, error, addFolder, addFiles, removeRoot, reindexRoot, refreshRoots } = useFiles();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeRoot, setActiveRoot] = useState<FileRootRecord | null>(null);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [viewerFileMap, setViewerFileMap] = useState<Record<string, FileRecord>>({});

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    try {
      const hits = await searchLocalIndex(query, { limit: 10 });
      setResults(hits);
    } finally {
      setSearching(false);
    }
  }

  function handleOpenInViewer(file: FileRecord) {
    setViewerFileMap(prev => ({ ...prev, [file.id]: file }));
    setSelectedDocId(file.id);
  }

  const handleRootCardClick = useCallback(async (root: FileRootRecord) => {
    let file: FileRecord | undefined;
    try {
      const filesForRoot = await listFilesByRoot(root.id);
      file = filesForRoot[0];
    } catch {
      // DB query failed — fall through to synthetic stub
    }

    if (file) {
      handleOpenInViewer(file);
    } else {
      const syntheticId = `root-${root.id}`;
      const stub: FileRecord = {
        id: syntheticId,
        rootId: root.id,
        path: root.name,
        name: root.name,
        ext: '',
        size: 0,
        modifiedAt: root.addedAt,
        contentHash: '',
        indexedAt: 0,
        sourceType: 'csv',
        ingestedAt: root.addedAt,
      };
      handleOpenInViewer(stub);
    }
  }, []);

  /**
   * loadDocument — hydrates rows + headers from stored chunks.
   * Uses the TSV-aware chunkTextToTableRows() so CSV data round-trips correctly.
   */
  const loadDocument = useCallback(async (id: string): Promise<IndexedDocument> => {
    const file = viewerFileMap[id];
    if (!file) throw new Error(`File ${id} not found — try re-indexing`);
    const chunks = await listChunksByFile(id);
    const content = chunks.map((chunk) => chunk.text).join("\n");
    const parsed = chunkTextToTableRows(content);
    return {
      ...fileRecordToIndexedDoc(file),
      content,
      rows: parsed.rows,
      headers: parsed.headers,
    };
  }, [viewerFileMap]);

  function handleViewerOpenInChat(doc: IndexedDocument) {
    window.dispatchEvent(new CustomEvent("studio:new-chat-from-file", {
      detail: { previewText: String(doc.content ?? ''), name: doc.name }
    }));
    setSelectedDocId(null);
  }

  function handleViewerReIndex(id: string) {
    window.dispatchEvent(new CustomEvent("studio:analyze-file", {
      detail: { fileId: id }
    }));
  }

  return (
    <div className="files-panel">

      <div className="files-panel-header">
        <h2 className="files-panel-title">Files</h2>
      </div>

      <StorageQuotaBar />

      <div className="files-add-row">
        <button className="files-add-btn" onClick={addFolder} disabled={isIndexing}>
          <span className="files-add-btn-icon" aria-hidden="true">📁</span> Add Folder
        </button>
        <button className="files-add-btn" onClick={addFiles} disabled={isIndexing}>
          <span className="files-add-btn-icon" aria-hidden="true">📄</span> Add Files
        </button>
      </div>

      {error && <div className="files-error" role="alert">{error}</div>}

      {isIndexing && progress && (
        <div className="files-progress" role="status" aria-label="Indexing progress">
          <div className="files-progress-bar">
            <div
              className="files-progress-fill"
              style={{ width: progress.total ? `${Math.round((progress.done / progress.total) * 100)}%` : "0%" }}
            />
          </div>
          <span className="files-progress-label">
            {progress.done} / {progress.total} {progress.currentFile}
          </span>
        </div>
      )}

      {roots.length > 0 ? (
        <div>
          <div className="files-sources-header">
            <span className="files-sources-title">Indexed Sources</span>
            <span className="files-sources-count">{roots.length}</span>
          </div>
          <div className="files-sources-list">
            {roots.map((root) => (
              <FileRootCard
                key={root.id}
                root={root}
                onLongPress={setActiveRoot}
                onOpenInViewer={handleRootCardClick}
              />
            ))}
          </div>
        </div>
      ) : (
        !isIndexing && (
          <FilesPanelEmptyState onAddFiles={addFiles} />
        )
      )}

      <form className="files-search-bar" onSubmit={handleSearch}>
        <input
          className="files-search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search indexed files…"
          aria-label="Search indexed files"
        />
        <button type="submit" className="files-search-btn" disabled={searching || !query.trim()}>
          {searching ? "…" : "Search"}
        </button>
      </form>

      {results.length > 0 && (
        <div className="files-results-list" role="list" aria-label="Search results">
          {results.map((r) => (
            <div key={r.chunkId} className="files-snippet-card" role="listitem">
              <div className="files-snippet-path">{r.filePath}</div>
              <div className="files-snippet-score">score {r.score.toFixed(3)}</div>
              <pre className="files-snippet-text">{r.snippet}</pre>
            </div>
          ))}
        </div>
      )}

      <FilePreviewSheet
        root={activeRoot}
        onClose={() => setActiveRoot(null)}
        onReindex={reindexRoot}
        onRemove={removeRoot}
        onNewChatFromFile={(_rootId, previewText, name) => {
          window.dispatchEvent(new CustomEvent("studio:new-chat-from-file", {
            detail: { previewText, name }
          }));
        }}
        onAnalyzeInChat={(fileId) => {
          window.dispatchEvent(new CustomEvent("studio:analyze-file", {
            detail: { fileId }
          }));
        }}
        onOpenInViewer={handleOpenInViewer}
      />

      <div className="sidebar-section-divider" />
      <IngestDropZone onIndexed={refreshRoots} />

      <FileViewerModal
        docId={selectedDocId}
        loadDocument={loadDocument}
        onClose={() => setSelectedDocId(null)}
        onOpenInChat={handleViewerOpenInChat}
        onReIndex={handleViewerReIndex}
      />

    </div>
  );
}
