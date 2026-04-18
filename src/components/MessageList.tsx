import type { ChatMessage } from "../lib/types";

interface Props {
  messages: ChatMessage[];
}

export function MessageList({ messages }: Props) {
  return (
    <div className="message-list">
      {messages.map((message) => (
        <div key={message.id} className={`message message-${message.role}`}>
          <div className="message-role">{message.role}</div>
          <div className="message-content">{message.content}</div>
        </div>
      ))}
    </div>
  );
}
