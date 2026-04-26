import { useState, useEffect, useRef } from "react";
import type { ChatMessage, ChartSpec } from "../lib/types";
import { extractChartSpecResults } from "../lib/chartSpecParser";
import type { ParseError } from "../lib/chartSpecParser";
import { InlineCsvChart } from "./InlineCsvChart";
import "../phase4.css";

interface Props {
  messages: ChatMessage[];
  onChartSpecsFound?: (specs: ChartSpec[]) => void;
  csvRows?: Record<string, string>[];
  /** Optional: called when a suggested prompt chip is tapped */
  onSuggestedPrompt?: (text: string) => void;
}

const SUGGESTED_PROMPTS = [
  "Summarise the attached file",
  "What are the key insights?",
  "Compare columns and identify trends",
];

function stripChartSpecBlocks(text: string): string {
  return text.replace(/```chartspec[\s\S]*?```/gi, '').trim();
}

function renderMarkdown(text: string): string {
  return text
    .replace(/```[\w]*\n?([\s\S]*?)```/g, "<pre><code>$1</code></pre>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/^[-*] (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>[\s\S]*?<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
    .replace(/^\d+\. (.+)$/gm, "<li>$1</li>")
    .replace(/\n\n+/g, "</p><p>")
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

function ChartParseErrorCard({ error }: { error: ParseError }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="chart-parse-error"
      role="alert"
      aria-label="Chart specification error"
    >
      <div className="chart-parse-error-header">
        <span className="chart-parse-error-icon" aria-hidden="true">⚠️</span>
        <span className="chart-parse-error-title">Chart could not be rendered</span>
        <button
          className="chart-parse-error-toggle"
          aria-expanded={open}
          aria-controls={`chart-error-detail-${error.blockIndex}`}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "Hide details" : "Show details"}
        </button>
      </div>
      <p className="chart-parse-error-reason">{error.reason}</p>
      {open && (
        <pre
          id={`chart-error-detail-${error.blockIndex}`}
          className="chart-parse-error-raw"
        >
          {error.rawContent.trim()}
        </pre>
      )}
    </div>
  );
}

function AssistantBubble({
  message,
  csvRows,
  onChartSpecsFound,
}: {
  message: ChatMessage;
  csvRows: Record<string, string>[];
  onChartSpecsFound?: (specs: ChartSpec[]) => void;
}) {
  const { specs, errors } = extractChartSpecResults(message.content);
  if (specs.length > 0) onChartSpecsFound?.(specs);

  const cleaned = stripChartSpecBlocks(message.content);
  const html = renderMarkdown(cleaned);
  const hasChartContent = specs.length > 0 || errors.length > 0;

  return (
    <>
      <div
        className="message-content md-body"
        dangerouslySetInnerHTML={{ __html: `<p>${html}</p>` }}
      />
      {hasChartContent && (
        <div className="inline-chart-list">
          {specs.map((spec) => (
            <InlineCsvChart key={spec.id} spec={spec} rows={csvRows} />
          ))}
          {errors.map((err) => (
            <ChartParseErrorCard key={`parse-error-${err.blockIndex}`} error={err} />
          ))}
        </div>
      )}
    </>
  );
}

// C-3: animated message bubble wrapper — slide-up + fade on first mount only
function AnimatedBubble({ id, role, children }: { id: string; role?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    const el = ref.current;
    if (!el) return;
    // Respect prefers-reduced-motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    el.classList.add('message-bubble-enter');
    const onEnd = () => el.classList.remove('message-bubble-enter');
    el.addEventListener('animationend', onEnd, { once: true });
  }, []);

  return (
    <div
      ref={ref}
      data-bubble-id={id}
      data-testid="message-bubble"
      data-role={role}
    >
      {children}
    </div>
  );
}

// B-3: MessageList empty state
function MessageListEmptyState({ onSuggestedPrompt }: { onSuggestedPrompt?: (text: string) => void }) {
  return (
    <div className="message-list-empty" role="region" aria-label="No messages yet">
      <span className="message-list-empty-icon" aria-hidden="true">💬</span>
      <h3 className="message-list-empty-heading">Start a conversation</h3>
      <p className="message-list-empty-subtext">
        Ask anything, or attach a file to analyse it.
      </p>
      {onSuggestedPrompt && (
        <div className="message-list-empty-chips" role="list" aria-label="Suggested prompts">
          {SUGGESTED_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              role="listitem"
              className="message-list-empty-chip"
              data-testid="prompt-chip"
              onClick={() => onSuggestedPrompt(prompt)}
              aria-label={`Use suggested prompt: ${prompt}`}
            >
              {prompt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function MessageList({ messages, onChartSpecsFound, csvRows = [], onSuggestedPrompt }: Props) {
  // B-3: show empty state when no messages
  if (messages.length === 0) {
    return <MessageListEmptyState onSuggestedPrompt={onSuggestedPrompt} />;
  }

  return (
    <div className="message-list">
      {messages.map((message) => {
        if (message.role === "tool") {
          return (
            <AnimatedBubble key={message.id} id={message.id} role="tool">
              <div className="message message-tool">
                <ToolPill message={message} />
              </div>
            </AnimatedBubble>
          );
        }
        return (
          <AnimatedBubble key={message.id} id={message.id} role={message.role}>
            <div className={`message message-${message.role}`}>
              <div className="message-role">
                {message.role === "assistant" ? "Studio OS" : "You"}
              </div>
              {message.role === "assistant" ? (
                <>
                  <AssistantBubble
                    message={message}
                    csvRows={csvRows}
                    onChartSpecsFound={onChartSpecsFound}
                  />
                  {message.status === "streaming" && (
                    <span className="streaming-cursor">\u258C</span>
                  )}
                </>
              ) : (
                <div className="message-content">{message.content}</div>
              )}
            </div>
          </AnimatedBubble>
        );
      })}
    </div>
  );
}
