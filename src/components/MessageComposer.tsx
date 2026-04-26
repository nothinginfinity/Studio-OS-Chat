import { useRef, useCallback } from "react";
import { promotePromptToAsset } from "../lib/prompts";
import { uid } from "../lib/utils";

interface Props {
  onSend: (text: string) => Promise<void>;
  disabled?: boolean;
  value: string;
  onChange: (text: string) => void;
  sessionId?: string;
}

export function MessageComposer({
  onSend,
  disabled,
  value,
  onChange,
  sessionId,
}: Props) {
  const [saving, setSaving] = [false, (_: boolean) => {}];
  const savingRef = useRef(false);
  const [savedFlash, setSavedFlash] = [false, (_: boolean) => {}];
  const savedFlashRef = useRef(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Use local refs for saving/flash since we don't need re-renders for those
  async function handleSend() {
    const next = value.trim();
    if (!next) return;
    onChange("");
    await onSend(next);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  }

  const handleSavePrompt = useCallback(async () => {
    const trimmed = value.trim();
    if (!trimmed || savingRef.current) return;
    savingRef.current = true;
    try {
      await promotePromptToAsset({
        sourceMessageId: uid(),
        sessionId: sessionId ?? "composer",
        promptText: trimmed,
        tags: [],
        starred: false,
        pinned: false,
      });
      if (flashTimer.current) clearTimeout(flashTimer.current);
      savedFlashRef.current = true;
      flashTimer.current = setTimeout(() => {
        savedFlashRef.current = false;
      }, 1800);
    } catch {
      // non-fatal
    } finally {
      savingRef.current = false;
    }
  }, [value, sessionId]);

  return (
    <div className="composer">
      <textarea
        data-testid="chat-input"
        rows={4}
        placeholder="Ask your local model something… (⌘↵ to send)"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
      />
      <div className="composer-actions">
        <button
          className="composer-save-btn"
          onClick={handleSavePrompt}
          disabled={disabled || !value.trim()}
          title="Save prompt to library"
        >
          Save Prompt
        </button>
        <button
          data-testid="chat-send-button"
          className="composer-send-btn"
          onClick={handleSend}
          disabled={disabled || !value.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
}
