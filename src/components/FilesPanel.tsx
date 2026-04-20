import { useState } from "react";
import { useFiles } from "../hooks/useFiles";
import { searchLocalIndex } from "../lib/search";
import type { SearchResult, FileRootRecord } from "../lib/types";
import { FileActionSheet } from "./FileActionSheet";
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
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

// ── Single file root card with long-press ──────────────────────────────

function FileRootCard({
  root,
  onTap,
  onLongPress,
}: {
  root: FileRootRecord;
  onTap: (root: FileRootRecord) => void;
  onLongPress: (root: FileRootRecord) => void;
}) {
  const { bind, isPressed, longPressTriggeredRef } = useLongPress({
    onLongPress: () => onLongPress(root),
  });

  function handleClick() {
    if (longPressTriggeredRef.current) return;
    onTap(root);
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
      aria-label={`Actions for ${root.name}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") handleClick();
      }}
      {...bind}
    >
      <div className="file-root-card-name">
        {root.kind === "directory" ? "📁" : "📄"}  {root.name}
      </div>
      <div className="file-root-card-meta">
        <span className="file-root-card-kind">
          {root.kind === "directory" ? "Folder" : "Files"}
        </span>
        <span className="file-root-card-time">
          {relativeTime(root.lastIndexedAt)}
        </span>
      </div>
      {!root.lastIndexedAt && (
        <div className="file-root-card-hint">Hold to manage …</div>
      )}
    </div>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────

export function FilesPanel() {
  const {
    roots,
    progress,
    isIndexing,
    error,
    addFolder,
    addFiles,
    removeRoot,
    reindexRoot,
  } = useFiles();

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

  function handleCopyName(name: string) {
    navigator.clipboard.writeText(name).catch(() => {});
  }

  return (
    <div className="files-panel">

      {/* Header */}
      <div className="files-panel-header">
        <h2 className="files-panel-title">Files</h2>
      </div>

      {/* Add source buttons */}
      <div className="files-add-row">
        <button
          className="files-add-btn"
          onClick={addFolder}
          disabled={isIndexing}
        >
          <span className="files-add-btn-icon">📁</span> Add Folder
        </button>
        <button
          className="files-add-btn"
          onClick={addFiles}
          disabled={isIndexing}
        >
          <span className="files-add-btn-icon">📄</span> Add Files
        </button>
      </div>

      {/* Error */}
      {error && <div className="files-error">{error}</div>}

      {/* Progress */}
      {isIndexing && progress && (
        <div className="files-progress">
          <div className="files-progress-bar">
            <div
              className="files-progress-fill"
              style={{
                width: progress.total
                  ? `${Math.round((progress.done / progress.total) * 100)}%`
                  : "0%",
              }}
            />
          </div>
          <span className="files-progress-label">
            {progress.done} / {progress.total} {progress.currentFile}
          </span>
        </div>
      )}

      {/* Indexed sources */}
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
                onTap={setActiveRoot}
                onLongPress={setActiveRoot}
              />
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

      {/* Search */}
      <form className="files-search-bar" onSubmit={handleSearch}>
        <input
          className="files-search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search indexed files…"
        />
        <button
          type="submit"
          className="files-search-btn"
          disabled={searching || !query.trim()}
        >
          {searching ? "…" : "Search"}
        </button>
      </form>

      {/* Results */}
      {results.length > 0 && (
        <div className="files-results-list">
          {results.map((r) => (
            <div key={r.chunkId} className="files-snippet-card">
              <div className="files-snippet-path">{r.filePath}</div>
              <div className="files-snippet-score">score {r.score.toFixed(3)}</div>
              <pre className="files-snippet-text">{r.snippet}</pre>
            </div>
          ))}
        </div>
      )}

      {/* File Action Sheet */}
      <FileActionSheet
        root={activeRoot}
        onClose={() => setActiveRoot(null)}
        onReindex={reindexRoot}
        onCopyName={handleCopyName}
        onRemove={removeRoot}
      />
    </div>
  );
}
