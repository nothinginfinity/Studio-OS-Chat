import { useState } from "react";
import type { ChatSettings, ChatSession } from "../lib/types";
import { ModelSelector } from "./ModelSelector";
import { SessionTitleEditor } from "./SessionTitleEditor";
import { FilesPanel } from "./FilesPanel";
import { OllamaStatus } from "./OllamaStatus";

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

type Tab = "chats" | "files";

export function Sidebar({
  settings,
  setSettings,
  onClearChat,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onRenameSession
}: SidebarProps) {
  const [tab, setTab] = useState<Tab>("chats");

  return (
    <aside className="sidebar">
      <h1>Local AI</h1>

      <OllamaStatus settings={settings} />

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
      </div>

      {tab === "chats" && (
        <>
          <button onClick={onNewSession}>New Chat</button>

          <div className="session-list">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={session.id === activeSessionId ? "session active" : "session"}
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
            <span>Ollama URL</span>
            <input
              value={settings.ollamaBaseUrl}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, ollamaBaseUrl: e.target.value }))
              }
            />
          </label>
          <ModelSelector settings={settings} setSettings={setSettings} />
          <label className="field">
            <span>System Prompt</span>
            <textarea
              rows={6}
              value={settings.systemPrompt}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, systemPrompt: e.target.value }))
              }
            />
          </label>
          <button onClick={onClearChat}>Clear Chat</button>
        </>
      )}

      {tab === "files" && <FilesPanel />}
    </aside>
  );
}
