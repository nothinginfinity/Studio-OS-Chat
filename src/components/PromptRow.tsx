import { useRef } from "react";
import { useLongPress } from "../hooks/useLongPress";
import type { PromptHistoryItem } from "../lib/types";

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

interface Props {
  prompt: PromptHistoryItem;
  onTap: (prompt: PromptHistoryItem) => void;
  onLongPress: (prompt: PromptHistoryItem) => void;
}

export function PromptRow({ prompt, onTap, onLongPress }: Props) {
  const { bind, isPressed, longPressTriggeredRef } = useLongPress({
    onLongPress: () => onLongPress(prompt),
  });

  function handleClick() {
    if (longPressTriggeredRef.current) return;
    onTap(prompt);
  }

  return (
    <div
      className={`prompt-history-item${
        isPressed ? " prompt-history-item--pressed" : ""
      }`}
      role="button"
      tabIndex={0}
      aria-label={prompt.promptText.slice(0, 80)}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") handleClick();
      }}
      {...bind}
    >
      <div className="prompt-history-item-text">{prompt.promptText}</div>
      <div className="prompt-history-item-meta">
        <span className="prompt-history-item-session">{prompt.sessionTitle}</span>
        <span className="prompt-history-item-time">{relativeTime(prompt.createdAt)}</span>
      </div>
    </div>
  );
}
