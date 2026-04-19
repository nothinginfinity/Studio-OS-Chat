import { usePromptHistory, type SortOrder } from "../hooks/usePromptHistory";

interface Props {
  active: boolean;
  onOpenSession: (sessionId: string) => void;
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

export function PromptHistory({ active, onOpenSession }: Props) {
  const { prompts, loading, query, setQuery, sortOrder, setSortOrder, refresh } =
    usePromptHistory(active);

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
          <button
            key={p.messageId}
            className="prompt-card"
            onClick={() => onOpenSession(p.sessionId)}
            role="listitem"
            aria-label={`Open conversation: ${p.sessionTitle}`}
          >
            <div className="prompt-card-content">{p.content}</div>
            <div className="prompt-card-meta">
              <span className="prompt-card-session">{p.sessionTitle}</span>
              <span className="prompt-card-time">{relativeTime(p.createdAt)}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
