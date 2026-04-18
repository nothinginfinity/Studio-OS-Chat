import type { ChatSettings, ChatSession } from "../lib/types";
import { ModelSelector } from "./ModelSelector";

interface SidebarProps {
  settings: ChatSettings;
  setSettings: React.Dispatch<React.SetStateAction<ChatSettings>>;
  onClearChat: () => void;
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
}

export function Sidebar({
  settings,
  setSettings,
  onClearChat,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <h1>Local AI</h1>

      <button onClick={onNewSession}>New Chat</button>

      <div className="session-list">
        {sessions.map((session) => (
          <button
            key={session.id}
            className={session.id === activeSessionId ? "session active" : "session"}
            onClick={() => onSelectSession(session.id)}
          >
            {session.title}
          </button>
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
    </aside>
  );
}
