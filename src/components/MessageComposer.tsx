import { useState } from "react";

interface Props {
  onSend: (text: string) => Promise<void>;
  disabled?: boolean;
}

export function MessageComposer({ onSend, disabled }: Props) {
  const [text, setText] = useState("");

  async function handleSend() {
    const value = text.trim();
    if (!value) return;
    setText("");
    await onSend(value);
  }

  return (
    <div className="composer">
      <textarea
        rows={4}
        placeholder="Ask your local model something..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={disabled}
      />
      <button onClick={handleSend} disabled={disabled}>
        Send
      </button>
    </div>
  );
}
