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
  const savingRef = useRef(false);
  const savedFlashRef = useRef(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        {/* Wrap in a span so hover still fires on disabled button */}
        <span
          className="send-btn-wrap"
          style={{ position: 'relative', display: 'inline-block' }}
        >
          <button
            data-testid="chat-send-button"
            className="composer-send-btn"
            onClick={handleSend}
            disabled={disabled || !value.trim()}
          >
            Send
          </button>
          {disabled && (
            <span
              role="tooltip"
              className="send-offline-tip"
              style={{
                position: 'absolute',
                bottom: 'calc(100% + 6px)',
                right: 0,
                background: '#1c1b19',
                color: '#f9f8f5',
                fontSize: '0.75rem',
                padding: '4px 8px',
                borderRadius: '4px',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                opacity: 0,
                transition: 'opacity 120ms ease',
              }}
            >
              Requires an internet connection
            </span>
          )}
        </span>
      </div>
      {/* CSS to show tooltip on wrapper hover */}
      <style>{`.send-btn-wrap:hover .send-offline-tip { opacity: 1 !important; }`}</style>
    </div>
  );
}
