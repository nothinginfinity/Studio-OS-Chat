import type { ChatMessage, SearchResult } from "../lib/types";
import { ToolResultCard } from "./ToolResultCard";

interface Props {
  messages: ChatMessage[];
}

function FileSearchResultCard({ data }: { data: unknown }) {
  const parsed = data as {
    query?: string;
    count?: number;
    results?: SearchResult[];
  };

  if (!parsed?.results?.length) {
    return <div className="snippet-card snippet-empty">No results found.</div>;
  }

  return (
    <div className="file-search-results">
      <div className="file-search-header">
        🔍 <strong>{parsed.query}</strong> — {parsed.count} result{parsed.count !== 1 ? "s" : ""}
      </div>
      {parsed.results.map((r) => (
        <div key={r.chunkId} className="snippet-card">
          <div className="snippet-path">{r.filePath}</div>
          <div className="snippet-score">score: {r.score.toFixed(3)}</div>
          <pre className="snippet-text">{r.snippet}</pre>
        </div>
      ))}
    </div>
  );
}

export function MessageList({ messages }: Props) {
  return (
    <div className="message-list">
      {messages.map((message) => (
        <div key={message.id} className={`message message-${message.role}`}>
          <div className="message-role">{message.role}</div>
          {message.role === "tool" ? (
            message.toolName === "file_search" ? (
              <FileSearchResultCard data={message.toolData ?? message.content} />
            ) : (
              <ToolResultCard
                name={message.toolName ?? "tool"}
                data={message.toolData ?? message.content}
              />
            )
          ) : (
            <div className="message-content">
              {message.content}
              {message.status === "streaming" && (
                <span className="streaming-cursor">▍</span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
