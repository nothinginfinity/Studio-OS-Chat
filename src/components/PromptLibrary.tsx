import { useState } from "react";
import { usePromptAssets } from "../hooks/usePromptAssets";
import type { PromptAssetRecord, PromptHistoryItem } from "../lib/types";

interface Props {
  active: boolean;
  onInsertPrompt?: (content: string) => void;
}

function relativeTime(ts: number): string {
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

type LibraryTab = "pinned" | "starred" | "search";

export function PromptLibrary({ active, onInsertPrompt }: Props) {
  const { starred, pinned, searchResults, searching, loading, star, pin, search, refresh } =
    usePromptAssets(active);
  const [tab, setTab] = useState<LibraryTab>("pinned");
  const [searchQuery, setSearchQuery] = useState("");

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setSearchQuery(q);
    search(q);
    if (q.trim()) setTab("search");
    else setTab("pinned");
  }

  return (
    <div className="prompt-library">
      <div className="prompt-library-search-row">
        <input
          className="prompt-history-search"
          type="search"
          placeholder="Search saved prompts…"
          value={searchQuery}
          onChange={handleSearchChange}
          aria-label="Search prompt library"
        />
        <button
          className="prompt-history-refresh"
          onClick={refresh}
          aria-label="Refresh library"
          title="Refresh"
          disabled={loading}
        >
          ↻
        </button>
      </div>

      <div className="prompt-sort-toggle">
        {(["pinned", "starred", "search"] as LibraryTab[]).map((t) => (
          <button
            key={t}
            className={`prompt-sort-btn${
              tab === t ? " prompt-sort-btn--active" : ""
            }`}
            onClick={() => setTab(t)}
            aria-pressed={tab === t}
          >
            {t === "pinned" ? "📌 Pinned" : t === "starred" ? "★ Starred" : "🔍 Results"}
          </button>
        ))}
      </div>

      <div className="prompt-history-list" role="list">
        {(loading || searching) && (
          (tab === "pinned" ? pinned : tab === "starred" ? starred : searchResults).length === 0
        ) && (
          <div className="prompt-history-empty">Loading…</div>
        )}

        {/* Pinned / Starred tabs — PromptAssetRecord[] */}
        {!loading && tab !== "search" && (() => {
          const list: PromptAssetRecord[] = tab === "pinned" ? pinned : starred;
          if (list.length === 0) return (
            <div className="prompt-history-empty">
              {tab === "pinned"
                ? "No pinned prompts yet."
                : "No starred prompts yet."}
            </div>
          );
          return list.map((asset) => (
            <div key={asset.id} className="prompt-card" role="listitem">
              <div className="prompt-card-content">{asset.promptText.slice(0, 160)}</div>
              <div className="prompt-card-meta">
                <span className="prompt-card-time">{relativeTime(asset.createdAt)}</span>
                {asset.tags?.length ? (
                  <span className="prompt-card-tags">{asset.tags.join(", ")}</span>
                ) : null}
              </div>
              <div className="prompt-card-actions">
                {onInsertPrompt && (
                  <button
                    className="prompt-card-btn"
                    onClick={() => onInsertPrompt(asset.promptText)}
                    aria-label="Insert into composer"
                  >
                    Insert
                  </button>
                )}
                <button
                  className={`prompt-card-btn${asset.starred ? " prompt-card-btn--active" : ""}`}
                  onClick={() => star(asset.id, !asset.starred)}
                  aria-label={asset.starred ? "Unstar" : "Star"}
                >
                  {asset.starred ? "★" : "☆"}
                </button>
                <button
                  className={`prompt-card-btn${asset.pinned ? " prompt-card-btn--active" : ""}`}
                  onClick={() => pin(asset.id, !asset.pinned)}
                  aria-label={asset.pinned ? "Unpin" : "Pin"}
                >
                  {asset.pinned ? "📌" : "📎"}
                </button>
              </div>
            </div>
          ));
        })()}

        {/* Search tab — PromptHistoryItem[] */}
        {!searching && tab === "search" && (() => {
          const list: PromptHistoryItem[] = searchResults;
          if (list.length === 0) return (
            <div className="prompt-history-empty">No results.</div>
          );
          return list.map((item) => (
            <div key={item.messageId} className="prompt-card" role="listitem">
              <div className="prompt-card-content">{item.promptText.slice(0, 160)}</div>
              <div className="prompt-card-meta">
                <span className="prompt-card-session">{item.sessionTitle}</span>
                <span className="prompt-card-time">{relativeTime(item.createdAt)}</span>
              </div>
              <div className="prompt-card-actions">
                {onInsertPrompt && (
                  <button
                    className="prompt-card-btn"
                    onClick={() => onInsertPrompt(item.promptText)}
                    aria-label="Insert into composer"
                  >
                    Insert
                  </button>
                )}
              </div>
            </div>
          ));
        })()}
      </div>
    </div>
  );
}
