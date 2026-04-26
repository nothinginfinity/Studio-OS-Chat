import { useState } from "react";
import type { ChatMessage, ChartSpec } from "../lib/types";
import { extractChartSpecResults } from "../lib/chartSpecParser";
import type { ParseError } from "../lib/chartSpecParser";
import { InlineCsvChart } from "./InlineCsvChart";

interface Props {
  messages: ChatMessage[];
  /** Called when LLM-emitted ChartSpecs are found in an assistant message. */
  onChartSpecsFound?: (specs: ChartSpec[]) => void;
  /** CSV rows for the currently attached file — needed to render inline charts. */
  csvRows?: Record<string, string>[];
}

/** Strip ```chartspec...``` blocks before markdown rendering so raw JSON is hidden. */
function stripChartSpecBlocks(text: string): string {
  return text.replace(/```chartspec[\s\S]*?```/gi, '').trim();
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

/**
 * Friendly error card rendered in place of a chart when the LLM emits a
 * ```chartspec block that fails JSON parsing or schema validation.
 */
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
          {/* Valid specs: render chart. Empty csvRows → Chart.js renders with no data,
              which is correct per AC: "works when no file is attached". */}
          {specs.map((spec) => (
            <InlineCsvChart key={spec.id} spec={spec} rows={csvRows} />
          ))}
          {/* Parse errors: friendly card, not a crash */}
          {errors.map((err) => (
            <ChartParseErrorCard key={`parse-error-${err.blockIndex}`} error={err} />
          ))}
        </div>
      )}
    </>
  );
}

export function MessageList({ messages, onChartSpecsFound, csvRows = [] }: Props) {
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
        );
      })}
    </div>
  );
}
