import { useState } from "react";
import { useFiles } from "../hooks/useFiles";
import { searchLocalIndex } from "../lib/search";
import type { SearchResult } from "../lib/types";

export function FilesPanel() {
  const { roots, progress, isIndexing, error, addFolder, addFiles } = useFiles();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

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
          <h3>Indexed Sources</h3>
          {roots.map((root) => (
            <div key={root.id} className="file-root-row">
              <span className="root-icon">{root.kind === "directory" ? "📁" : "📄"}</span>
              <span className="root-name">{root.name}</span>
              {root.lastIndexedAt && (
                <span className="root-meta">
                  {new Date(root.lastIndexedAt).toLocaleTimeString()}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <form className="files-search" onSubmit={handleSearch}>
        <input
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
    </div>
  );
}
