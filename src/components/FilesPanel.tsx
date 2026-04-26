import { useState, useCallback } from "react";
import { useFiles } from "../hooks/useFiles";
import { searchLocalIndex } from "../lib/search";
import type { SearchResult, FileRecord, FileRootRecord } from "../lib/types";
import { FilePreviewSheet } from "./FilePreviewSheet";
import { FileViewerModal } from "./FileViewerModal";
import type { IndexedDocument } from "./FileViewerModal";
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
    // Single click → open in FileViewerModal
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

/** Adapter: converts a FileRecord to the IndexedDocument shape FileViewerModal expects */
function fileRecordToIndexedDoc(file: FileRecord): IndexedDocument {
  return {
    id: file.id,
    name: file.name,
    sourceType: file.type as IndexedDocument['sourceType'],
    content: (file as unknown as Record<string, unknown>).content,
    chartSpecs: file.chartSpecs,
  };
}

export function FilesPanel() {
  const { roots, files, progress, isIndexing, error, addFolder, addFiles, removeRoot, reindexRoot } = useFiles();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeRoot, setActiveRoot] = useState<FileRootRecord | null>(null);
  // selectedDocId drives FileViewerModal — null means closed
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
    setViewerFileMap(prev => ({ ...prev, [file.id]: file }));
    setSelectedDocId(file.id);
  }

  /**
   * Called when a FileRootCard is single-clicked.
   * Finds the first FileRecord belonging to that root and opens it in the viewer.
   * Falls back to a synthetic IndexedDocument from the root record if no files
   * are indexed yet (so the modal still opens and shows a loading/empty state).
   */
  const handleRootCardClick = useCallback((root: FileRootRecord) => {
    // Look for the first file belonging to this root
    const firstFile = (files ?? []).find((f: FileRecord) => f.rootId === root.id);
    if (firstFile) {
      handleOpenInViewer(firstFile);
    } else {
      // No files yet — create a synthetic doc so the modal opens
      const syntheticId = `root-${root.id}`;
      const syntheticFile: FileRecord = {
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
      handleOpenInViewer(syntheticFile);
    }
  }, [files]);

  /** loadDocument satisfies FileViewerModal's async loader contract */
  const loadDocument = useCallback(async (id: string): Promise<IndexedDocument> => {
    const file = viewerFileMap[id];
    if (!file) throw new Error(`File ${id} not found in panel cache`);
    return fileRecordToIndexedDoc(file);
  }, [viewerFileMap]);

  function handleViewerOpenInChat(doc: IndexedDocument) {
    const file = viewerFileMap[doc.id];
    if (file) {
      window.dispatchEvent(new CustomEvent("studio:new-chat-from-file", {
        detail: { previewText: String(doc.content ?? ''), name: doc.name }
      }));
    }
    setSelectedDocId(null);
  }

  function handleViewerReIndex(id: string) {
    const file = viewerFileMap[id];
    if (file) {
      window.dispatchEvent(new CustomEvent("studio:analyze-file", {
        detail: { fileId: id }
      }));
    }
    setSelectedDocId(null);
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
          placeholder="Search indexed files\u2026"
          aria-label="Search indexed files"
        />
        <button type="submit" className="files-search-btn" disabled={searching || !query.trim()}>
          {searching ? "\u2026" : "Search"}
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

      {/* FileViewerModal is always mounted but renders null when selectedDocId is null.
          selectedDocId is set when a file-root-card is single-clicked, which satisfies
          the modal's useEffect guard and triggers setOpen(true). */}
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
