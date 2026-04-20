import { useState } from "react";
import type { ChatMessage } from "../lib/types";

interface Props {
  messages: ChatMessage[];
}

// Lightweight markdown → HTML (no external dependency)
function renderMarkdown(text: string): string {
  return text
    // fenced code blocks
    .replace(/```[\w]*\n?([\s\S]*?)```/g, "<pre><code>$1</code></pre>")
    // inline code
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    // bold
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // italic
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // h3
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    // h2
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    // h1
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    // unordered list items
    .replace(/^[-*] (.+)$/gm, "<li>$1</li>")
    // wrap consecutive <li> blocks in <ul>
    .replace(/(<li>[\s\S]*?<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
    // numbered list items
    .replace(/^\d+\. (.+)$/gm, "<li>$1</li>")
    // double newline → paragraph break
    .replace(/\n\n+/g, "</p><p>")
    // single newline → line break
    .replace(/\n/g, "<br/>");
}

function ToolPill({ message }: { message: ChatMessage }) {
  const [open, setOpen] = useState(false);

  const label =
    message.toolName === "file_search"
      ? "\uD83D\uDCC4 File search"
      : `\uD83D\uDD27 ${message.toolName ?? "tool"}`;

  const data: unknown = message.toolData ?? (() => {
    try { return JSON.parse(message.content); } catch { return message.content; }
  })();

  const resultCount: number | null =
    data !== null && typeof data === "object" && "count" in (data as object)
      ? (data as { count: number }).count
      : Array.isArray(data)
      ? data.length
      : null;

  return (
    <div className="tool-pill-wrapper">
      <button className="tool-pill" onClick={() => setOpen((o) => !o)}>
        <span>{label}</span>
        {resultCount !== null && (
          <span className="tool-pill-count">
            {resultCount} result{resultCount !== 1 ? "s" : ""}
          </span>
        )}
        <span className="tool-pill-chevron">{open ? "\u25B2" : "\u25BC"}</span>
      </button>
      {open && (
        <div className="tool-pill-body">
          <pre>
            {typeof data === "string" ? data : JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function AssistantBubble({ message }: { message: ChatMessage }) {
  const html = renderMarkdown(message.content);
  return (
    <div
      className="message-content md-body"
      dangerouslySetInnerHTML={{ __html: `<p>${html}</p>` }}
    />
  );
}

export function MessageList({ messages }: Props) {
  return (
    <div className="message-list">
      {messages.map((message) => {
        if (message.role === "tool") {
          return (
            <div key={message.id} className="message message-tool">
              <ToolPill message={message} />
            </div>
          );
        }
        return (
          <div key={message.id} className={`message message-${message.role}`}>
            <div className="message-role">
              {message.role === "assistant" ? "Studio OS" : "You"}
            </div>
            {message.role === "assistant" ? (
              <>
                <AssistantBubble message={message} />
                {message.status === "streaming" && (
                  <span className="streaming-cursor">\u258C</span>
                )}
              </>
            ) : (
              <div className="message-content">{message.content}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
