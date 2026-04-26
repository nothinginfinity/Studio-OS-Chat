import { useState } from "react";
import { useFiles } from "../hooks/useFiles";
import { searchLocalIndex } from "../lib/search";
import type { SearchResult, FileRecord, FileRootRecord } from "../lib/types";
import { FilePreviewSheet } from "./FilePreviewSheet";
import { FileViewerModal } from "./FileViewerModal";
import { useLongPress } from "../hooks/useLongPress";
import { StorageQuotaBar } from "./StorageQuotaBar";
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
}: {
  root: FileRootRecord;
  onLongPress: (root: FileRootRecord) => void;
}) {
  const { bind, isPressed, longPressTriggeredRef } = useLongPress({
    onLongPress: () => onLongPress(root),
  });

  function handleClick() {
    if (longPressTriggeredRef.current) return;
    onLongPress(root);
  }

  return (
    <div
      className={[
        "file-root-card",
        "lp-item",
        isPressed ? "lp-item--pressed" : "",
      ].filter(Boolean).join(" ")}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={`Preview ${root.name}`}
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

export function FilesPanel() {
  const { roots, progress, isIndexing, error, addFolder, addFiles, removeRoot, reindexRoot } = useFiles();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeRoot, setActiveRoot] = useState<FileRootRecord | null>(null);
  const [viewerFile, setViewerFile] = useState<FileRecord | null>(null);

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

  function handleNewChatFromFile(_rootId: string, previewText: string, name: string) {
    window.dispatchEvent(new CustomEvent("studio:new-chat-from-file", {
      detail: { previewText, name }
    }));
  }

  function handleAnalyzeInChat(fileId: string) {
    window.dispatchEvent(new CustomEvent("studio:analyze-file", {
      detail: { fileId }
    }));
  }

  function handleOpenInViewer(file: FileRecord) {
    setViewerFile(file);
  }

  function handleViewerOpenInChat(file: FileRecord, contextText: string) {
    window.dispatchEvent(new CustomEvent("studio:new-chat-from-file", {
      detail: { previewText: contextText, name: file.name }
    }));
    setViewerFile(null);
  }

  function handleViewerAnalyzeInChat(file: FileRecord) {
    window.dispatchEvent(new CustomEvent("studio:analyze-file", {
      detail: { fileId: file.id }
    }));
    setViewerFile(null);
  }

  return (
    <div className="files-panel">

      <div className="files-panel-header">
        <h2 className="files-panel-title">Files</h2>
      </div>

      {/* C-3: Storage quota bar */}
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
              <FileRootCard key={root.id} root={root} onLongPress={setActiveRoot} />
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
        onNewChatFromFile={handleNewChatFromFile}
        onAnalyzeInChat={handleAnalyzeInChat}
        onOpenInViewer={handleOpenInViewer}
      />

      {viewerFile && (
        <FileViewerModal
          file={viewerFile}
          onClose={() => setViewerFile(null)}
          onOpenInChat={handleViewerOpenInChat}
          onAnalyzeInChat={handleViewerAnalyzeInChat}
        />
      )}

    </div>
  );
}
