import { useState, useRef, useEffect } from "react";

interface Props {
  title: string;
  onSave: (title: string) => void;
}

export function deriveSessionTitle(
  messages: { role: string; content: string }[]
): string {
  const firstUser =
    messages.find((m) => m.role === "user")?.content ?? "New Chat";
  return firstUser
    .replace(/^(can you|help me|please|i need|i want|could you)[,\s]*/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

export function SessionTitleEditor({ title, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(title);
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing, title]);

  function commit() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== title) onSave(trimmed);
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="session-title-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
      />
    );
  }

  return (
    <span className="session-title" onDoubleClick={() => setEditing(true)}>
      {title}
      <button
        className="rename-btn"
        title="Rename"
        onClick={(e) => { e.stopPropagation(); setEditing(true); }}
      >
        ✏️
      </button>
    </span>
  );
}
