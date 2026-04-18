import type { ChatMessage } from "../lib/types";
import { ToolResultCard } from "./ToolResultCard";

interface Props {
  messages: ChatMessage[];
}

export function MessageList({ messages }: Props) {
  return (
    <div className="message-list">
      {messages.map((message) => (
        <div key={message.id} className={`message message-${message.role}`}>
          <div className="message-role">{message.role}</div>
          {message.role === "tool" ? (
            <ToolResultCard
              name={message.toolName ?? "tool"}
              data={message.toolData ?? message.content}
            />
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
