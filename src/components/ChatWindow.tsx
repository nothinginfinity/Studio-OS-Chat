import { useCallback, useRef } from "react";
import type { ChatMessage, ChartSpec } from "../lib/types";
import { MessageList } from "./MessageList";
import { MessageComposer } from "./MessageComposer";
import { listAllFiles, putFile } from "../lib/db";

interface Props {
  messages: ChatMessage[];
  onSend: (text: string) => Promise<void>;
  isLoading: boolean;
  error: string;
  sessionId?: string;
  /** ID of the CSV file attached to this session (if any). */
  attachedFileId?: string;
  /** CSV rows pre-loaded from the attached file for inline chart rendering. */
  csvRows?: Record<string, string>[];
  draftText: string;
  onDraftChange: (text: string) => void;
  /** Optional override for handling suggested prompt chip taps. */
  onSuggestedPrompt?: (text: string) => void;
}

export function ChatWindow({
  messages,
  onSend,
  isLoading,
  error,
  sessionId,
  attachedFileId,
  csvRows = [],
  draftText,
  onDraftChange,
  onSuggestedPrompt,
}: Props) {
  // Track which spec ids we've already persisted so we don't double-write
  const persistedIds = useRef<Set<string>>(new Set());

  const handleChartSpecsFound = useCallback(
    async (specs: ChartSpec[]) => {
      if (!attachedFileId) return;
      const novel = specs.filter((s) => !persistedIds.current.has(s.id));
      if (novel.length === 0) return;

      try {
        const allFiles = await listAllFiles();
        const file = allFiles.find((f) => f.id === attachedFileId);
        if (!file) return;
        const existing = file.chartSpecs ?? [];
        const existingIds = new Set(existing.map((s: ChartSpec) => s.id));
        const toAdd = novel.filter((s) => !existingIds.has(s.id));
        if (toAdd.length === 0) return;
        await putFile({ ...file, chartSpecs: [...existing, ...toAdd] });
        toAdd.forEach((s) => persistedIds.current.add(s.id));
      } catch {
        // persistence failure is non-fatal — chart still renders in UI
      }
    },
    [attachedFileId],
  );

  // Default chip handler: populate the draft composer
  const handleSuggestedPrompt = useCallback(
    (text: string) => {
      if (onSuggestedPrompt) {
        onSuggestedPrompt(text);
      } else {
        onDraftChange(text);
      }
    },
    [onSuggestedPrompt, onDraftChange],
  );

  return (
    <section className="chat-window">
      <MessageList
        messages={messages}
        csvRows={csvRows}
        onChartSpecsFound={handleChartSpecsFound}
        onSuggestedPrompt={handleSuggestedPrompt}
      />
      {error ? <div className="error-banner">{error}</div> : null}
      {isLoading ? <div className="status">Thinking…</div> : null}
      <MessageComposer
        onSend={onSend}
        disabled={isLoading}
        value={draftText}
        onChange={onDraftChange}
        sessionId={sessionId}
      />
    </section>
  );
}
