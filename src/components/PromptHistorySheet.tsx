import { useState } from "react";
import { createPortal } from "react-dom";
import { usePromptHistory } from "../hooks/usePromptHistory";
import { PromptSearchBar } from "./PromptSearchBar";
import { PromptRow } from "./PromptRow";
import { PromptActionSheet } from "./PromptActionSheet";
import type { PromptHistoryItem } from "../lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onOpenSession: (sessionId: string) => void;
  onReusePrompt: (text: string) => void;
  onCreateSessionWithDraft: (text: string) => void;
}

export function PromptHistorySheet({
  open,
  onClose,
  onOpenSession,
  onReusePrompt,
  onCreateSessionWithDraft,
}: Props) {
  const { prompts, loading, query, setQuery, refresh } = usePromptHistory(open);
  const [activePrompt, setActivePrompt] = useState<PromptHistoryItem | null>(null);

  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  function handleTap(prompt: PromptHistoryItem) {
    onReusePrompt(prompt.promptText);
    onClose();
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text).catch(() => {});
  }

  function handleOpenSession(sessionId: string) {
    onOpenSession(sessionId);
    onClose();
  }

  if (!open) return null;

  return createPortal(
    <div
      className="sheet-backdrop"
      onClick={handleBackdrop}
      role="dialog"
      aria-modal="true"
      aria-label="Prompt history"
    >
      <div className="sheet">
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h2 className="sheet-title">Prompt History</h2>
          <button className="sheet-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <PromptSearchBar query={query} onChange={setQuery} onRefresh={refresh} />

        <div className="sheet-count">
          {loading
            ? "Loading…"
            : `${prompts.length} prompt${prompts.length !== 1 ? "s" : ""}`}
        </div>

        <div className="sheet-list" role="list">
          {!loading && prompts.length === 0 && (
            <div className="sheet-empty">
              {query ? "No prompts match your search." : "No prompts yet. Start a chat!"}
            </div>
          )}
          {prompts.map((p) => (
            <PromptRow
              key={p.messageId}
              prompt={p}
              onTap={handleTap}
              onLongPress={setActivePrompt}
            />
          ))}
        </div>
      </div>

      <PromptActionSheet
        prompt={activePrompt}
        onClose={() => setActivePrompt(null)}
        onReuse={(text) => { onReusePrompt(text); onClose(); }}
        onNewChat={(text) => { onCreateSessionWithDraft(text); onClose(); }}
        onCopy={handleCopy}
        onOpenSession={handleOpenSession}
      />
    </div>,
    document.body
  );
}
