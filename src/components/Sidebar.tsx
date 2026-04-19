import { useState } from "react";
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
import { PromptHistory } from "./PromptHistory";
import { PromptLibrary } from "./PromptLibrary";

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
}

type Tab = "chats" | "prompts" | "library" | "files" | "spaces" | "settings";

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
}: SidebarProps) {
  const [tab, setTab] = useState<Tab>("chats");

  const activeSession =
    sessions.find((s) => s.id === activeSessionId) ?? null;

  function handleSettingsChange(next: ChatSettings) {
    setSettings(next);
  }

  function handleOpenSessionFromHistory(sessionId: string) {
    onSelectSession(sessionId);
    setTab("chats");
  }

  async function handleNewChatFromPrompt(text: string) {
    await onCreateSessionWithDraft(text);
    setTab("chats");
  }

  return (
    <aside className="sidebar">
      <h1>Studio OS Chat</h1>

      <OllamaStatus settings={settings} />

      {/* Tab bar */}
      <div className="sidebar-tabs">
        <button
          className={tab === "chats" ? "tab active" : "tab"}
          onClick={() => setTab("chats")}
        >
          Chats
        </button>
        <button
          className={tab === "prompts" ? "tab active" : "tab"}
          onClick={() => setTab("prompts")}
          aria-label="Prompt history"
        >
          History
        </button>
        <button
          className={tab === "library" ? "tab active" : "tab"}
          onClick={() => setTab("library")}
          aria-label="Prompt library"
        >
          Library
        </button>
        <button
          className={tab === "files" ? "tab active" : "tab"}
          onClick={() => setTab("files")}
        >
          Files
        </button>
        <button
          className={tab === "spaces" ? "tab active" : "tab"}
          onClick={() => setTab("spaces")}
        >
          Spaces
        </button>
        <button
          className={tab === "settings" ? "tab active" : "tab"}
          onClick={() => setTab("settings")}
          aria-label="Settings"
        >
          ⚙️
        </button>
      </div>

      {/* Chats tab */}
      {tab === "chats" && (
        <>
          <button onClick={onNewSession}>New Chat</button>

          <div className="session-list">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={
                  session.id === activeSessionId ? "session active" : "session"
                }
                onClick={() => onSelectSession(session.id)}
              >
                <div className="session-row-meta">
                  <SessionTitleEditor
                    title={session.title}
                    onSave={(title) => onRenameSession(session.id, title)}
                  />
                  {session.exportRef?.exportPath ? (
                    <span
                      className="session-export-badge"
                      title={session.exportRef.exportPath}
                    >
                      Exported
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          <label className="field">
            <span>System Prompt</span>
            <textarea
              rows={4}
              value={settings.systemPrompt}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  systemPrompt: e.target.value,
                }))
              }
            />
          </label>

          <button onClick={onClearChat}>Clear Chat</button>

          <div className="sidebar-section-divider" />

          {/* Export panel */}
          <div className="session-export-panel">
            <ExportChatButton
              session={activeSession}
              settings={settings}
              onExported={onSessionExported}
            />
            {activeSession?.exportRef ? (
              <div className="export-status-detail">
                <div>
                  <strong>Format:</strong> {activeSession.exportRef.format}
                </div>
                <div>
                  <strong>Path:</strong>{" "}
                  <span className="export-path-text">
                    {activeSession.exportRef.exportPath}
                  </span>
                </div>
                <div>
                  <strong>Exported:</strong>{" "}
                  {new Date(activeSession.exportRef.exportedAt).toLocaleString()}
                </div>
              </div>
            ) : null}
          </div>
        </>
      )}

      {/* Prompt History tab */}
      {tab === "prompts" && (
        <PromptHistory
          active={tab === "prompts"}
          onOpenSession={handleOpenSessionFromHistory}
          onInsertPrompt={onInsertPrompt}
          onReusePrompt={onReusePrompt}
          onNewChatFromPrompt={handleNewChatFromPrompt}
        />
      )}

      {/* Prompt Library tab */}
      {tab === "library" && (
        <PromptLibrary
          active={tab === "library"}
          onInsertPrompt={onInsertPrompt}
        />
      )}

      {/* Files tab */}
      {tab === "files" && (
        <>
          <FilesPanel />
          <div className="sidebar-section-divider" />
          <IngestDropZone />
        </>
      )}

      {/* Spaces tab */}
      {tab === "spaces" && <SpacesPanel />}

      {/* Settings tab */}
      {tab === "settings" && (
        <>
          <ProviderSettings
            settings={settings}
            onSettingsChange={handleSettingsChange}
          />

          {settings.provider === "ollama" && (
            <label className="field">
              <span>Ollama URL</span>
              <input
                value={settings.ollamaBaseUrl}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    ollamaBaseUrl: e.target.value,
                  }))
                }
              />
            </label>
          )}

          {settings.provider === "ollama" && (
            <ModelSelector settings={settings} setSettings={setSettings} />
          )}

          <div className="sidebar-section-divider" />
          <GitHubSettings />
        </>
      )}
    </aside>
  );
}
