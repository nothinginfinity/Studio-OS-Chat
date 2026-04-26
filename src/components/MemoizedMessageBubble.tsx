/**
 * A-3: React.memo wrapper for individual message bubbles.
 * Prevents re-render when sibling messages update during streaming.
 */
import React, { memo } from "react";

export interface MessageBubbleProps {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: number;
}

const MessageBubbleInner: React.FC<MessageBubbleProps> = ({ id, role, content }) => (
  <div
    data-testid="message-bubble"
    data-role={role}
    data-id={id}
    className={`message-bubble message-bubble--${role}`}
  >
    <span className="message-bubble__content">{content}</span>
  </div>
);

MessageBubbleInner.displayName = "MessageBubble";

/**
 * Memoized: only re-renders when id, role, or content changes.
 * Streaming updates are scoped to the last bubble only — siblings are stable.
 */
export const MemoizedMessageBubble = memo(
  MessageBubbleInner,
  (prev, next) =>
    prev.id === next.id &&
    prev.role === next.role &&
    prev.content === next.content
);

MemoizedMessageBubble.displayName = "MemoizedMessageBubble";
