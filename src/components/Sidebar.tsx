import { useState, useRef } from "react";
import type { ChatSettings, ChatSession, ChatExportRef } from "../lib/types";
import { ModelSelector } from "./ModelSelector";
import { SessionTitleEditor } from "./SessionTitleEditor";
import { FilesPanel } from "./FilesPanel";
import { OllamaStatus } from "./OllamaStatus";
import ProviderSettings from "./ProviderSettings";
import { IngestDropZone } from "./IngestDropZone";
import { ExportChatButton } from "./ExportChatButton";
import { GitHubSettings } from "./GitHubSettings";
import { SpacesPanel } from "./SpacesPanel";
import { PromptHistorySheet } from "./PromptHistorySheet";
import { PromptLibrary } from "./PromptLibrary";
import { ChatActionSheet } from "./ChatActionSheet";
import { SystemPromptLibrarySheet } from "./SystemPromptLibrarySheet";
import { useLongPress } from "../hooks/useLongPress";

type Tab = "chats" | "library" | "files" | "spaces" | "settings";

interface SidebarProps {
  settings: ChatSettings;
  setSettings: React.Dispatch<React.SetStateAction<ChatSettings>>;
  onClearChat: () => void;
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onRenameSession: (id: string, title: string) => void;
  onSessionExported: (sessionId: string, exportRef: ChatExportRef) => void;
  onInsertPrompt?: (content: string) => void;
  onReusePrompt: (text: string) => void;
  onCreateSessionWithDraft: (text: string) => Promise<unknown>;
  onDeleteSession?: (sessionId: string) => void;
  activeTab?: Tab;
  onTabChange?: (tab: Tab) => void;
}

// ── Session row ────────────────────────────────────────────────────────────────────
function SessionRow({
  session,
  isActive,
  onTap,
  onLongPress,
}: {
  session: ChatSession;
  isActive: boolean;
  onTap: (session: ChatSession) => void;
  onLongPress: (session: ChatSession) => void;
}) {
  const { bind, isPressed, longPressTriggeredRef } = useLongPress({
    onLongPress: () => onLongPress(session),
  });

  function handleClick() {
    if (longPressTriggeredRef.current) return;
    onTap(session);
  }

  return (
    <div
      className={[
        "session",
        isActive ? "active" : "",
        isPressed ? "lp-item--pressed" : "",
        "lp-item",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={`Open chat: ${session.title}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") handleClick();
      }}
      {...bind}
    >
      <div className="session-row-meta">
        <SessionTitleEditor
          title={session.title}
          onSave={(_title) => { /* handled via sheet rename */ }}
        />
        {session.exportRef?.exportPath ? (
          <span className="session-export-badge" title={session.exportRef.exportPath}>
            Exported
          </span>
        ) : null}
      </div>
    </div>
  );
}

// ── System prompt field ──────────────────────────────────────────────────────────
//
// KEY FIX: the long-press gesture bind goes on the outer <div>, NOT on the
// <textarea>. On iOS/mobile Safari, spreading pointer-event handlers directly
// onto a textarea causes the browser to swallow the pointerdown (it grabs
// focus for text insertion) and the long-press timer never fires.
// The wrapper div receives all gesture events; the textarea stays fully editable.

function SystemPromptField({
  value,
  onChange,
  onLongPress,
}: {
  value: string;
  onChange: (v: string) => void;
  onLongPress: () => void;
}) {
  const { bind, isPressed } = useLongPress({ onLongPress, delay: 500 });

  return (
    <div
      className={["sys-prompt-field-wrap", isPressed ? "lp-item--pressed" : ""].filter(Boolean).join(" ")}
      {...bind}
      // Prevent the wrapper's contextmenu suppression from killing textarea
      // right-click — only suppress on non-textarea targets.
      onContextMenu={(e) => {
        if ((e.target as HTMLElement).tagName === "TEXTAREA") return;
        e.preventDefault();
      }}
    >
      <label className="field" style={{ pointerEvents: "none", userSelect: "none" }}>
        <span className="sys-prompt-field-label">
          System Prompt
          <span className="sys-prompt-field-hint"> — hold to browse library</span>
        </span>
      </label>
      {/* Textarea is outside the label so pointer-events work normally */}
      <textarea
        rows={4}
        value={value}
        style={{ pointerEvents: "auto" }}
        onChange={(e) => onChange(e.target.value)}
        aria-label="System prompt — long-press background to open library"
        // Stop pointer events on the textarea from bubbling up and
        // re-triggering the wrapper's long-press timer.
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        onPointerMove={(e) => e.stopPropagation()}
        onPointerCancel={(e) => e.stopPropagation()}
      />
      <button
        className="sys-prompt-library-btn"
        type="button"
        onClick={onLongPress}
        aria-label="Open system prompt library"
        title="Browse system prompt library"
      >
        📚 Library
      </button>
    </div>
  );
}

// ── Main sidebar ────────────────────────────────────────────────────────────────
export function Sidebar({
  settings,
  setSettings,
  onClearChat,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onRenameSession,
  onSessionExported,
  onInsertPrompt,
  onReusePrompt,
  onCreateSessionWithDraft,
  onDeleteSession,
  activeTab,
  onTabChange,
}: SidebarProps) {
  const [internalTab, setInternalTab] = useState<Tab>("chats");
  const tab: Tab = activeTab ?? internalTab;
  function setTab(next: Tab) {
    if (onTabChange) onTabChange(next);
    else setInternalTab(next);
  }

  const [historyOpen, setHistoryOpen] = useState(false);
  const [activeSheetSession, setActiveSheetSession] = useState<ChatSession | null>(null);
  const [sysPromptLibraryOpen, setSysPromptLibraryOpen] = useState(false);

  const exportTriggerRef = useRef<{ export: (sessionId: string) => void } | null>(null);

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;

  function handleNewSession() {
    if (activeSession && activeSession.messages.length === 0) return;
    onNewSession();
  }

  function handleSettingsChange(next: ChatSettings) {
    setSettings(next);
  }

  function handleOpenSessionFromHistory(sessionId: string) {
    onSelectSession(sessionId);
    setHistoryOpen(false);
  }

  async function handleNewChatFromPrompt(text: string) {
    await onCreateSessionWithDraft(text);
    setHistoryOpen(false);
  }

  function handleSheetRename(sessionId: string) {
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return;
    const next = window.prompt("Rename chat:", session.title);
    if (next && next.trim()) onRenameSession(sessionId, next.trim());
  }

  function handleSheetDelete(sessionId: string) {
    if (onDeleteSession) onDeleteSession(sessionId);
  }

  function handleSelectSession(id: string) {
    if (activeSession && activeSession.id !== id && activeSession.messages.length === 0) {
      if (onDeleteSession) onDeleteSession(activeSession.id);
    }
    onSelectSession(id);
  }

  function handleSelectSystemPrompt(content: string) {
    setSettings((prev) => ({ ...prev, systemPrompt: content }));
  }

  return (
    <aside className="sidebar">
      <h1>Studio OS Chat</h1>

      <OllamaStatus settings={settings} />

      <div className="sidebar-tabs">
        <button className={tab === "chats" ? "tab active" : "tab"} onClick={() => setTab("chats")}>Chats</button>
        <button className="tab" onClick={() => setHistoryOpen(true)} aria-label="Prompt history">History</button>
        <button className={tab === "library" ? "tab active" : "tab"} onClick={() => setTab("library")}>Library</button>
        <button className={tab === "files" ? "tab active" : "tab"} onClick={() => setTab("files")}>Files</button>
        <button className={tab === "spaces" ? "tab active" : "tab"} onClick={() => setTab("spaces")}>Spaces</button>
        <button className={tab === "settings" ? "tab active" : "tab"} onClick={() => setTab("settings")} aria-label="Settings">⚙️</button>
      </div>

      {tab === "chats" && (
        <div className="sidebar-chats-content">
          <button onClick={handleNewSession}>New Chat</button>

          <div className="session-list">
            {sessions.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                isActive={session.id === activeSessionId}
                onTap={(s) => handleSelectSession(s.id)}
                onLongPress={(s) => setActiveSheetSession(s)}
              />
            ))}
          </div>

          <SystemPromptField
            value={settings.systemPrompt}
            onChange={(v) => setSettings((prev) => ({ ...prev, systemPrompt: v }))}
            onLongPress={() => setSysPromptLibraryOpen(true)}
          />

          <button onClick={onClearChat}>Clear Chat</button>

          <div className="sidebar-section-divider" />

          <div className="session-export-panel">
            <ExportChatButton
              session={activeSession}
              settings={settings}
              onExported={onSessionExported}
            />
            {activeSession?.exportRef ? (
              <div className="export-status-detail">
                <div><strong>Format:</strong> {activeSession.exportRef.format}</div>
                <div><strong>Path:</strong> <span className="export-path-text">{activeSession.exportRef.exportPath}</span></div>
                <div><strong>Exported:</strong> {new Date(activeSession.exportRef.exportedAt).toLocaleString()}</div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {tab === "library" && <PromptLibrary active={tab === "library"} onInsertPrompt={onInsertPrompt} />}

      {tab === "files" && (
        <>
          <FilesPanel />
          <div className="sidebar-section-divider" />
          <IngestDropZone />
        </>
      )}

      {tab === "spaces" && <SpacesPanel />}

      {tab === "settings" && (
        <>
          <ProviderSettings settings={settings} onSettingsChange={handleSettingsChange} />
          {settings.provider === "ollama" && (
            <label className="field">
              <span>Ollama URL</span>
              <input
                value={settings.ollamaBaseUrl}
                onChange={(e) => setSettings((prev) => ({ ...prev, ollamaBaseUrl: e.target.value }))}
              />
            </label>
          )}
          {settings.provider === "ollama" && <ModelSelector settings={settings} setSettings={setSettings} />}
          <div className="sidebar-section-divider" />
          <GitHubSettings />
        </>
      )}

      <PromptHistorySheet
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onOpenSession={handleOpenSessionFromHistory}
        onReusePrompt={onReusePrompt}
        onCreateSessionWithDraft={handleNewChatFromPrompt}
      />

      <ChatActionSheet
        session={activeSheetSession}
        settings={settings}
        onClose={() => setActiveSheetSession(null)}
        onOpen={(id) => onSelectSession(id)}
        onRename={handleSheetRename}
        onExport={(id) => { onSelectSession(id); setTab("chats"); }}
        onCopyExportPath={(path) => navigator.clipboard.writeText(path).catch(() => {})}
        onDelete={handleSheetDelete}
      />

      <SystemPromptLibrarySheet
        open={sysPromptLibraryOpen}
        onClose={() => setSysPromptLibraryOpen(false)}
        onSelectPrompt={handleSelectSystemPrompt}
        settings={settings}
      />
    </aside>
  );
}
