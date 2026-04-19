import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "../lib/types";
import { MessageList } from "./MessageList";
import { MessageComposer } from "./MessageComposer";

interface Props {
  messages: ChatMessage[];
  onSend: (text: string) => Promise<void>;
  isLoading: boolean;
  error: string;
  sessionId?: string;
  /** Text to inject into the composer from an external panel (e.g. PromptLibrary) */
  pendingInsert?: string | null;
  /** Called once the pending insert has been consumed so App can clear it */
  onInsertConsumed?: () => void;
}

export function ChatWindow({
  messages,
  onSend,
  isLoading,
  error,
  sessionId,
  pendingInsert,
  onInsertConsumed,
}: Props) {
  const [composerText, setComposerText] = useState("");

  // Consume pendingInsert whenever App sets one
  useEffect(() => {
    if (pendingInsert) {
      setComposerText(pendingInsert);
      onInsertConsumed?.();
    }
  }, [pendingInsert, onInsertConsumed]);

  return (
    <section className="chat-window">
      <MessageList messages={messages} />
      {error ? <div className="error-banner">{error}</div> : null}
      {isLoading ? <div className="status">Thinking…</div> : null}
      <MessageComposer
        onSend={onSend}
        disabled={isLoading}
        sessionId={sessionId}
        externalText={composerText}
        onExternalTextConsumed={() => setComposerText("")}
      />
    </section>
  );
}
