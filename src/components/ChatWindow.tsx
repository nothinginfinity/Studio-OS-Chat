import type { ChatMessage } from "../lib/types";
import { MessageList } from "./MessageList";
import { MessageComposer } from "./MessageComposer";

interface Props {
  messages: ChatMessage[];
  onSend: (text: string) => Promise<void>;
  isLoading: boolean;
  error: string;
}

export function ChatWindow({ messages, onSend, isLoading, error }: Props) {
  return (
    <section className="chat-window">
      <MessageList messages={messages} />
      {error ? <div className="error-banner">{error}</div> : null}
      {isLoading ? <div className="status">Thinking...</div> : null}
      <MessageComposer onSend={onSend} disabled={isLoading} />
    </section>
  );
}
