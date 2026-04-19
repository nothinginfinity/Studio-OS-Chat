import { usePromptHistory, type SortOrder } from "../hooks/usePromptHistory";
import type { PromotePromptInput } from "../lib/types";

interface Props {
  active: boolean;
  onOpenSession: (sessionId: string) => void;
  onInsertPrompt?: (content: string) => void;
  onReusePrompt?: (text: string) => void;
  onNewChatFromPrompt?: (text: string) => Promise<unknown>;
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

export function PromptHistory({
  active,
  onOpenSession,
  onInsertPrompt,
  onReusePrompt,
  onNewChatFromPrompt,
}: Props) {
  const { prompts, loading, query, setQuery, sortOrder, setSortOrder, refresh, promote } =
    usePromptHistory(active);

  async function handlePromote(messageId: string, sessionId: string, promptText: string) {
    const input: PromotePromptInput = {
      sourceMessageId: messageId,
      sessionId,
      promptText,
      starred: false,
      pinned: false,
      tags: [],
    };
    await promote(input);
  }

  return (
    <div className="prompt-history">
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
            <div className="prompt-card-content">{p.promptText}</div>
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
                  onClick={() => onInsertPrompt(p.promptText)}
                  aria-label="Insert prompt into composer"
                >
                  Insert
                </button>
              )}
              {onReusePrompt && (
                <button
                  className="prompt-card-btn"
                  onClick={() => onReusePrompt(p.promptText)}
                  aria-label="Reuse prompt in current chat"
                >
                  Reuse
                </button>
              )}
              {onNewChatFromPrompt && (
                <button
                  className="prompt-card-btn"
                  onClick={() => onNewChatFromPrompt(p.promptText)}
                  aria-label="Start new chat with this prompt"
                >
                  New Chat
                </button>
              )}
              {!p.assetId && (
                <button
                  className="prompt-card-btn prompt-card-btn--save"
                  onClick={() => handlePromote(p.messageId, p.sessionId, p.promptText)}
                  aria-label="Save to prompt library"
                  title="Save to library"
                >
                  ★ Save
                </button>
              )}
              {p.assetId && (
                <span className="prompt-card-saved" title="Already in library">✓ Saved</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
