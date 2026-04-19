import { usePromptHistory, type SortOrder } from "../hooks/usePromptHistory";
import type { PromptAssetRecord } from "../lib/prompts";

interface Props {
  active: boolean;
  onOpenSession: (sessionId: string) => void;
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

export function PromptHistory({ active, onOpenSession, onInsertPrompt }: Props) {
  const { prompts, loading, query, setQuery, sortOrder, setSortOrder, refresh, promote } =
    usePromptHistory(active);

  async function handlePromote(content: string, sessionId: string) {
    await promote({
      content,
      title: content.slice(0, 72),
      sessionId,
      tags: [],
      starred: false,
      pinned: false,
    });
  }

  return (
    <div className="prompt-history">
      {/* Search bar */}
      <div className="prompt-history-search-row">
        <input
          className="prompt-history-search"
          type="search"
          placeholder="Search prompts…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search prompt history"
        />
        <button
          className="prompt-history-refresh"
          onClick={refresh}
          aria-label="Refresh prompt history"
          title="Refresh"
        >
          ↻
        </button>
      </div>

      {/* Sort toggle + count */}
      <div className="prompt-history-sort-row">
        <span className="prompt-history-count">
          {loading
            ? "Loading…"
            : `${prompts.length} prompt${prompts.length !== 1 ? "s" : ""}`}
        </span>
        <div className="prompt-sort-toggle">
          {(["newest", "oldest"] as SortOrder[]).map((o) => (
            <button
              key={o}
              className={`prompt-sort-btn${
                sortOrder === o ? " prompt-sort-btn--active" : ""
              }`}
              onClick={() => setSortOrder(o)}
              aria-pressed={sortOrder === o}
            >
              {o === "newest" ? "Newest" : "Oldest"}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable prompt list */}
      <div className="prompt-history-list" role="list">
        {loading && prompts.length === 0 && (
          <div className="prompt-history-empty">Loading…</div>
        )}
        {!loading && prompts.length === 0 && (
          <div className="prompt-history-empty">
            {query
              ? "No prompts match your search."
              : "No prompts yet. Start a chat!"}
          </div>
        )}
        {prompts.map((p) => (
          <div key={p.messageId} className="prompt-card" role="listitem">
            <div className="prompt-card-content">{p.content}</div>
            <div className="prompt-card-meta">
              <span className="prompt-card-session">{p.sessionTitle}</span>
              <span className="prompt-card-time">{relativeTime(p.createdAt)}</span>
            </div>
            <div className="prompt-card-actions">
              <button
                className="prompt-card-btn"
                onClick={() => onOpenSession(p.sessionId)}
                aria-label={`Open conversation: ${p.sessionTitle}`}
              >
                Open
              </button>
              {onInsertPrompt && (
                <button
                  className="prompt-card-btn"
                  onClick={() => onInsertPrompt(p.content)}
                  aria-label="Insert prompt into composer"
                >
                  Insert
                </button>
              )}
              <button
                className="prompt-card-btn prompt-card-btn--save"
                onClick={() => handlePromote(p.content, p.sessionId)}
                aria-label="Save to prompt library"
                title="Save to library"
              >
                ★ Save
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
