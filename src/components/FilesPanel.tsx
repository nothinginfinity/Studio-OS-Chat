import { useState } from "react";
import { useFiles } from "../hooks/useFiles";
import { searchLocalIndex } from "../lib/search";
import type { SearchResult, FileRootRecord } from "../lib/types";
import { FilePreviewSheet } from "./FilePreviewSheet";
import { useLongPress } from "../hooks/useLongPress";
import "../files.css";

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
    onLongPress(root); // tap also opens preview
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
        {root.kind === "directory" ? "📁" : "📄"}&nbsp;&nbsp;{root.name}
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

export function FilesPanel() {
  const { roots, progress, isIndexing, error, addFolder, addFiles, removeRoot, reindexRoot } = useFiles();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeRoot, setActiveRoot] = useState<FileRootRecord | null>(null);

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

  // Task 4.4: dispatch studio:analyze-file so App.tsx can call analyzeFileInChat
  function handleAnalyzeInChat(fileId: string) {
    window.dispatchEvent(new CustomEvent("studio:analyze-file", {
      detail: { fileId }
    }));
  }

  return (
    <div className="files-panel">

      <div className="files-panel-header">
        <h2 className="files-panel-title">Files</h2>
      </div>

      <div className="files-add-row">
        <button className="files-add-btn" onClick={addFolder} disabled={isIndexing}>
          <span className="files-add-btn-icon">📁</span> Add Folder
        </button>
        <button className="files-add-btn" onClick={addFiles} disabled={isIndexing}>
          <span className="files-add-btn-icon">📄</span> Add Files
        </button>
      </div>

      {error && <div className="files-error">{error}</div>}

      {isIndexing && progress && (
        <div className="files-progress">
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
          <div className="files-empty">
            <span className="files-empty-icon">🗂️</span>
            No indexed sources yet.
            Add a folder or files above to get started.
          </div>
        )
      )}

      <form className="files-search-bar" onSubmit={handleSearch}>
        <input
          className="files-search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search indexed files…"
        />
        <button type="submit" className="files-search-btn" disabled={searching || !query.trim()}>
          {searching ? "…" : "Search"}
        </button>
      </form>

      {results.length > 0 && (
        <div className="files-results-list">
          {results.map((r) => (
            <div key={r.chunkId} className="files-snippet-card">
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
      />
    </div>
  );
}
