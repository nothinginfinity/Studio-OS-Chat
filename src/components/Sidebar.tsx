import { useState } from "react";
import type { ChatSettings, ChatSession } from "../lib/types";
import { ModelSelector } from "./ModelSelector";
import { SessionTitleEditor } from "./SessionTitleEditor";
import { FilesPanel } from "./FilesPanel";
import { OllamaStatus } from "./OllamaStatus";
import ProviderSettings from "./ProviderSettings";
import { IngestDropZone } from "./IngestDropZone";
import { ExportChatButton } from "./ExportChatButton";
import { GitHubSettings } from "./GitHubSettings";
import { SpacesPanel } from "./SpacesPanel";

interface SidebarProps {
  settings: ChatSettings;
  setSettings: React.Dispatch<React.SetStateAction<ChatSettings>>;
  onClearChat: () => void;
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onRenameSession: (id: string, title: string) => void;
}

type Tab = "chats" | "files" | "spaces" | "settings";

export function Sidebar({
  settings,
  setSettings,
  onClearChat,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onRenameSession,
}: SidebarProps) {
  const [tab, setTab] = useState<Tab>("chats");

  // Active session object — passed to ExportChatButton
  const activeSession =
    sessions.find((s) => s.id === activeSessionId) ?? null;

  function handleSettingsChange(next: ChatSettings) {
    setSettings(next);
  }

  return (
    <aside className="sidebar">
      <h1>Studio OS Chat</h1>

      <OllamaStatus settings={settings} />

      {/* Tab bar — now includes Spaces */}
      <div className="sidebar-tabs">
        <button
          className={tab === "chats" ? "tab active" : "tab"}
          onClick={() => setTab("chats")}
        >
          Chats
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
                <SessionTitleEditor
                  title={session.title}
                  onSave={(title) => onRenameSession(session.id, title)}
                />
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

          {/* Export current chat — shown in Chats tab for quick access */}
          <div className="sidebar-section-divider" />
          <ExportChatButton session={activeSession} settings={settings} />
        </>
      )}

      {/* Files tab — FilesPanel + IngestDropZone */}
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

          {/* Ollama-specific URL — only when Ollama is active */}
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

          {/* ModelSelector only for Ollama */}
          {settings.provider === "ollama" && (
            <ModelSelector settings={settings} setSettings={setSettings} />
          )}

          {/* GitHub PAT */}
          <div className="sidebar-section-divider" />
          <GitHubSettings />
        </>
      )}
    </aside>
  );
}
