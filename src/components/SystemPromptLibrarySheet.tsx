import { useState, useEffect, useRef } from "react";
import { ActionSheetBase } from "./ActionSheetBase";
import { useLongPress } from "../hooks/useLongPress";
import type { SystemPromptRecord } from "../lib/types";
import type { ChatSettings } from "../lib/types";
import {
  listSystemPrompts,
  putSystemPrompt,
  updateSystemPrompt,
  deleteSystemPrompt,
} from "../lib/db";

// ── Types ─────────────────────────────────────────────────────────────────────

type SheetMode = "library" | "create" | "edit" | "ai-assist";

interface SystemPromptLibrarySheetProps {
  open: boolean;
  onClose: () => void;
  /** Called when user taps a prompt to apply it to the current session */
  onSelectPrompt: (content: string) => void;
  /** Current settings — needed for the AI-assist LLM call */
  settings: ChatSettings;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function newRecord(name: string, content: string): SystemPromptRecord {
  const now = Date.now();
  return { id: crypto.randomUUID(), name, content, isPinned: false, createdAt: now, updatedAt: now };
}

// ── Row component (long-press to edit/delete) ─────────────────────────────────

function PromptLibraryRow({
  record,
  onSelect,
  onLongPress,
}: {
  record: SystemPromptRecord;
  onSelect: (r: SystemPromptRecord) => void;
  onLongPress: (r: SystemPromptRecord) => void;
}) {
  const { bind, isPressed, longPressTriggeredRef } = useLongPress({
    onLongPress: () => onLongPress(record),
  });

  return (
    <div
      className={["sys-prompt-row", isPressed ? "lp-item--pressed" : "", "lp-item"].filter(Boolean).join(" ")}
      role="button"
      tabIndex={0}
      aria-label={`Select system prompt: ${record.name}`}
      onClick={() => { if (!longPressTriggeredRef.current) onSelect(record); }}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSelect(record); }}
      {...bind}
    >
      <div className="sys-prompt-row-header">
        <span className="sys-prompt-row-name">
          {record.isPinned && <span className="sys-prompt-pin" aria-label="Pinned">📌</span>}
          {record.name}
        </span>
        <span className="sys-prompt-row-date">
          {new Date(record.updatedAt).toLocaleDateString()}
        </span>
      </div>
      <p className="sys-prompt-row-preview">
        {record.content.slice(0, 120)}{record.content.length > 120 ? "…" : ""}
      </p>
    </div>
  );
}

// ── Row action sheet (shown after long-press) ─────────────────────────────────

function RowActionSheet({
  record,
  onEdit,
  onTogglePin,
  onDelete,
  onClose,
}: {
  record: SystemPromptRecord;
  onEdit: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <ActionSheetBase onBackdropClick={onClose} zIndex={1200} ariaLabel="Prompt actions">
      <div className="action-sheet-handle" />
      <div className="action-sheet-title">{record.name}</div>
      <div className="action-sheet-actions">
        <button className="action-sheet-btn" onClick={onEdit}>✏️ Edit</button>
        <button className="action-sheet-btn" onClick={onTogglePin}>
          {record.isPinned ? "📌 Unpin" : "📌 Pin to top"}
        </button>
        <button className="action-sheet-btn action-sheet-btn--destructive" onClick={onDelete}>
          🗑️ Delete
        </button>
        <button className="action-sheet-btn action-sheet-btn--cancel" onClick={onClose}>Cancel</button>
      </div>
    </ActionSheetBase>
  );
}

// ── AI Assist panel ───────────────────────────────────────────────────────────

function AiAssistPanel({
  settings,
  onDraft,
  onBack,
}: {
  settings: ChatSettings;
  onDraft: (draft: string) => void;
  onBack: () => void;
}) {
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    if (!description.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const draft = await generateSystemPromptWithLLM(description.trim(), settings);
      onDraft(draft);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed. Check your provider settings.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="sys-prompt-ai-panel">
      <div className="sys-prompt-panel-header">
        <button className="sys-prompt-back-btn" onClick={onBack} aria-label="Back">← Back</button>
        <span className="sys-prompt-panel-title">AI Assist</span>
      </div>
      <p className="sys-prompt-ai-hint">
        Describe the role or behaviour you want the AI to have, and we'll draft a system prompt for you.
      </p>
      <label className="field">
        <span>What should the AI do?</span>
        <textarea
          className="sys-prompt-ai-textarea"
          rows={4}
          placeholder="e.g. Act as a senior TypeScript code reviewer who is concise and focuses on correctness…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={loading}
        />
      </label>
      {error && <p className="sys-prompt-error">{error}</p>}
      <button
        className="sys-prompt-primary-btn"
        onClick={handleGenerate}
        disabled={loading || !description.trim()}
      >
        {loading ? "Generating…" : "Generate Draft"}
      </button>
    </div>
  );
}

// ── LLM call for AI-assist ────────────────────────────────────────────────────

async function generateSystemPromptWithLLM(
  description: string,
  settings: ChatSettings
): Promise<string> {
  const systemInstruction = `You are an expert prompt engineer. 
The user will describe the role or behaviour they want an AI assistant to have.
Your job is to write a clear, concise, effective system prompt for that AI assistant.
Return ONLY the system prompt text — no explanations, no markdown fences, no preamble.`;

  const userMessage = `Write a system prompt for an AI assistant that does the following:\n\n${description}`;

  // ── OpenAI-compatible providers (openai, openrouter, etc.) ────────────────
  if (settings.provider === "openai" || settings.provider === "openrouter") {
    const baseUrl =
      settings.provider === "openrouter"
        ? "https://openrouter.ai/api/v1"
        : "https://api.openai.com/v1";
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: userMessage },
        ],
        max_tokens: 800,
        temperature: 0.7,
      }),
    });
    if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return (data.choices?.[0]?.message?.content ?? "").trim();
  }

  // ── Anthropic ─────────────────────────────────────────────────────────────
  if (settings.provider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": settings.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: settings.model,
        system: systemInstruction,
        messages: [{ role: "user", content: userMessage }],
        max_tokens: 800,
      }),
    });
    if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return (data.content?.[0]?.text ?? "").trim();
  }

  // ── Ollama ────────────────────────────────────────────────────────────────
  if (settings.provider === "ollama") {
    const base = settings.ollamaBaseUrl.replace(/\/$/, "");
    const res = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: settings.model,
        stream: false,
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: userMessage },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Ollama error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return (data.message?.content ?? "").trim();
  }

  throw new Error(`AI Assist is not supported for provider "${settings.provider}". Use OpenAI, Anthropic, OpenRouter, or Ollama.`);
}

// ── Create / Edit form ────────────────────────────────────────────────────────

function PromptForm({
  initial,
  onSave,
  onBack,
  onAiAssist,
  showAiAssist,
}: {
  initial?: { name: string; content: string };
  onSave: (name: string, content: string) => void;
  onBack: () => void;
  onAiAssist?: () => void;
  showAiAssist?: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [content, setContent] = useState(initial?.content ?? "");

  function handleSave() {
    if (!name.trim() || !content.trim()) return;
    onSave(name.trim(), content.trim());
  }

  return (
    <div className="sys-prompt-form">
      <div className="sys-prompt-panel-header">
        <button className="sys-prompt-back-btn" onClick={onBack} aria-label="Back">← Back</button>
        <span className="sys-prompt-panel-title">{initial ? "Edit Prompt" : "New Prompt"}</span>
        {showAiAssist && onAiAssist && (
          <button className="sys-prompt-ai-btn" onClick={onAiAssist} aria-label="AI Assist">
            ✨ AI
          </button>
        )}
      </div>
      <label className="field">
        <span>Name</span>
        <input
          type="text"
          placeholder="e.g. Code Reviewer"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="field">
        <span>System Prompt</span>
        <textarea
          rows={8}
          placeholder="You are a…"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
      </label>
      <button
        className="sys-prompt-primary-btn"
        onClick={handleSave}
        disabled={!name.trim() || !content.trim()}
      >
        Save
      </button>
    </div>
  );
}

// ── Main sheet ────────────────────────────────────────────────────────────────

export function SystemPromptLibrarySheet({
  open,
  onClose,
  onSelectPrompt,
  settings,
}: SystemPromptLibrarySheetProps) {
  const [mode, setMode] = useState<SheetMode>("library");
  const [records, setRecords] = useState<SystemPromptRecord[]>([]);
  const [search, setSearch] = useState("");
  const [rowActionRecord, setRowActionRecord] = useState<SystemPromptRecord | null>(null);
  const [editingRecord, setEditingRecord] = useState<SystemPromptRecord | null>(null);
  // Draft from AI assist, passed into the form
  const [aiDraft, setAiDraft] = useState<string | null>(null);

  // Load records whenever the sheet opens
  useEffect(() => {
    if (open) {
      listSystemPrompts().then(setRecords).catch(console.error);
      setMode("library");
      setSearch("");
      setAiDraft(null);
    }
  }, [open]);

  if (!open) return null;

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filtered = search.trim()
    ? records.filter(
        (r) =>
          r.name.toLowerCase().includes(search.toLowerCase()) ||
          r.content.toLowerCase().includes(search.toLowerCase())
      )
    : records;

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleSaveNew(name: string, content: string) {
    const record = aiDraft !== null
      ? newRecord(name, content)
      : newRecord(name, content);
    await putSystemPrompt(record);
    const updated = await listSystemPrompts();
    setRecords(updated);
    setAiDraft(null);
    setMode("library");
  }

  async function handleSaveEdit(name: string, content: string) {
    if (!editingRecord) return;
    await updateSystemPrompt(editingRecord.id, { name, content });
    const updated = await listSystemPrompts();
    setRecords(updated);
    setEditingRecord(null);
    setMode("library");
  }

  async function handleTogglePin(record: SystemPromptRecord) {
    await updateSystemPrompt(record.id, { isPinned: !record.isPinned });
    const updated = await listSystemPrompts();
    setRecords(updated);
    setRowActionRecord(null);
  }

  async function handleDelete(record: SystemPromptRecord) {
    if (!window.confirm(`Delete "${record.name}"?`)) return;
    await deleteSystemPrompt(record.id);
    const updated = await listSystemPrompts();
    setRecords(updated);
    setRowActionRecord(null);
  }

  function handleSelect(record: SystemPromptRecord) {
    onSelectPrompt(record.content);
    onClose();
  }

  function handleAiDraftReady(draft: string) {
    setAiDraft(draft);
    setMode("create");
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <ActionSheetBase onBackdropClick={onClose} zIndex={1100} ariaLabel="System prompt library">
        <div className="action-sheet-handle" />

        {/* ── Library view ── */}
        {mode === "library" && (
          <div className="sys-prompt-library">
            <div className="sys-prompt-library-header">
              <span className="sys-prompt-library-title">System Prompts</span>
              <div className="sys-prompt-library-actions">
                <button
                  className="sys-prompt-icon-btn"
                  onClick={() => { setAiDraft(null); setMode("ai-assist"); }}
                  aria-label="Create with AI"
                  title="Create with AI"
                >
                  ✨
                </button>
                <button
                  className="sys-prompt-icon-btn"
                  onClick={() => { setAiDraft(null); setMode("create"); }}
                  aria-label="New prompt"
                  title="New prompt"
                >
                  ＋
                </button>
              </div>
            </div>

            <input
              type="search"
              className="sys-prompt-search"
              placeholder="Search prompts…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search system prompts"
            />

            <div className="sys-prompt-list">
              {filtered.length === 0 && (
                <div className="sys-prompt-empty">
                  {search ? "No prompts match your search." : (
                    <>
                      <p>No system prompts yet.</p>
                      <p>Tap <strong>＋</strong> to create one, or <strong>✨</strong> to draft one with AI.</p>
                    </>
                  )}
                </div>
              )}
              {filtered.map((r) => (
                <PromptLibraryRow
                  key={r.id}
                  record={r}
                  onSelect={handleSelect}
                  onLongPress={(rec) => setRowActionRecord(rec)}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Create view ── */}
        {mode === "create" && (
          <PromptForm
            initial={aiDraft ? { name: "", content: aiDraft } : undefined}
            onSave={handleSaveNew}
            onBack={() => setMode("library")}
            onAiAssist={() => setMode("ai-assist")}
            showAiAssist
          />
        )}

        {/* ── Edit view ── */}
        {mode === "edit" && editingRecord && (
          <PromptForm
            initial={{ name: editingRecord.name, content: editingRecord.content }}
            onSave={handleSaveEdit}
            onBack={() => { setEditingRecord(null); setMode("library"); }}
          />
        )}

        {/* ── AI Assist view ── */}
        {mode === "ai-assist" && (
          <AiAssistPanel
            settings={settings}
            onDraft={handleAiDraftReady}
            onBack={() => setMode(mode === "ai-assist" && aiDraft === null ? "library" : "create")}
          />
        )}
      </ActionSheetBase>

      {/* Row action sheet (long-press) */}
      {rowActionRecord && (
        <RowActionSheet
          record={rowActionRecord}
          onEdit={() => {
            setEditingRecord(rowActionRecord);
            setRowActionRecord(null);
            setMode("edit");
          }}
          onTogglePin={() => handleTogglePin(rowActionRecord)}
          onDelete={() => handleDelete(rowActionRecord)}
          onClose={() => setRowActionRecord(null)}
        />
      )}
    </>
  );
}
