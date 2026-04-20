import { useState } from "react";
import { useFiles } from "../hooks/useFiles";
import { searchLocalIndex } from "../lib/search";
import type { SearchResult, FileRootRecord } from "../lib/types";
import { FileActionSheet } from "./FileActionSheet";
import { useLongPress } from "../hooks/useLongPress";

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

function FileRootRow({
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
        "prompt-history-item",
        "lp-item",
        isPressed ? "lp-item--pressed" : "",
      ].filter(Boolean).join(" ")}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={`Open source actions: ${root.name}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") handleClick();
      }}
      {...bind}
    >
      <div className="prompt-history-item-text">{root.name}</div>
      <div className="prompt-history-item-meta">
        <span className="prompt-history-item-session">
          {root.kind === "directory" ? "Folder" : "Files"}
        </span>
        <span className="prompt-history-item-time">
          {relativeTime(root.lastIndexedAt)}
        </span>
      </div>
    </div>
  );
}

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

  function handleTapRoot(root: FileRootRecord) {
    setActiveRoot(root);
  }

  function handleCopyName(name: string) {
    navigator.clipboard.writeText(name).catch(() => {});
  }

  return (
    <div className="files-panel">
      <h2>Files</h2>

      <div className="files-actions">
        <button onClick={addFolder} disabled={isIndexing}>
          📁 Add Folder
        </button>
        <button onClick={addFiles} disabled={isIndexing}>
          📄 Add Files
        </button>
      </div>

      {error && <div className="files-error">{error}</div>}

      {isIndexing && progress && (
        <div className="files-progress">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width: progress.total
                  ? `${Math.round((progress.done / progress.total) * 100)}%`
                  : "0%"
              }}
            />
          </div>
          <span className="progress-label">
            {progress.done}/{progress.total} — {progress.currentFile}
          </span>
        </div>
      )}

      {roots.length > 0 && (
        <div className="file-roots">
          <div className="sheet-header" style={{ paddingLeft: 0, paddingRight: 0 }}>
            <h3 className="sheet-title">Indexed Sources</h3>
          </div>
          <div className="sheet-list" style={{ paddingLeft: 0, paddingRight: 0, paddingBottom: 12 }}>
            {roots.map((root) => (
              <FileRootRow
                key={root.id}
                root={root}
                onTap={handleTapRoot}
                onLongPress={setActiveRoot}
              />
            ))}
          </div>
        </div>
      )}

      <form className="files-search" onSubmit={handleSearch}>
        <input
          className="prompt-search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search indexed files…"
        />
        <button type="submit" disabled={searching}>
          {searching ? "…" : "Search"}
        </button>
      </form>

      {results.length > 0 && (
        <div className="search-results">
          {results.map((r) => (
            <div key={r.chunkId} className="snippet-card">
              <div className="snippet-path">{r.filePath}</div>
              <div className="snippet-score">score: {r.score.toFixed(3)}</div>
              <pre className="snippet-text">{r.snippet}</pre>
            </div>
          ))}
        </div>
      )}

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
