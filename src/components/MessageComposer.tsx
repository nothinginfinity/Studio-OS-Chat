import { useState, useRef, useCallback, useEffect } from "react";
import { promotePromptToAsset } from "../lib/prompts";
import { uid } from "../lib/utils";

interface Props {
  onSend: (text: string) => Promise<void>;
  disabled?: boolean;
  sessionId?: string;
  externalText?: string;
  onExternalTextConsumed?: () => void;
}

export function MessageComposer({
  onSend,
  disabled,
  sessionId,
  externalText,
  onExternalTextConsumed,
}: Props) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (externalText) {
      setText(externalText);
      onExternalTextConsumed?.();
    }
  }, [externalText, onExternalTextConsumed]);

  async function handleSend() {
    const value = text.trim();
    if (!value) return;
    setText("");
    await onSend(value);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  }

  const handleSavePrompt = useCallback(async () => {
    const value = text.trim();
    if (!value || saving) return;
    setSaving(true);
    try {
      await promotePromptToAsset({
        sourceMessageId: uid(),
        sessionId: sessionId ?? "composer",
        promptText: value,
        tags: [],
        starred: false,
        pinned: false,
      });
      if (flashTimer.current) clearTimeout(flashTimer.current);
      setSavedFlash(true);
      flashTimer.current = setTimeout(() => setSavedFlash(false), 1800);
    } catch {
      // non-fatal
    } finally {
      setSaving(false);
    }
  }, [text, saving, sessionId]);

  return (
    <div className="composer">
      <textarea
        rows={4}
        placeholder="Ask your local model something… (⌘↵ to send)"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
      />
      <div className="composer-actions">
        <button
          className="composer-save-btn"
          onClick={handleSavePrompt}
          disabled={disabled || saving || !text.trim()}
          title="Save prompt to library"
        >
          {savedFlash ? "✓ Saved" : saving ? "Saving…" : "Save Prompt"}
        </button>
        <button
          className="composer-send-btn"
          onClick={handleSend}
          disabled={disabled || !text.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
}
