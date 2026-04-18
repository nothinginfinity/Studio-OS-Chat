import type { ChatSettings } from "../lib/types";
import { ModelSelector } from "./ModelSelector";

interface SidebarProps {
  settings: ChatSettings;
  setSettings: React.Dispatch<React.SetStateAction<ChatSettings>>;
  onClearChat: () => void;
}

export function Sidebar({ settings, setSettings, onClearChat }: SidebarProps) {
  return (
    <aside className="sidebar">
      <h1>Local AI</h1>
      <label className="field">
        <span>Ollama URL</span>
        <input
          value={settings.ollamaBaseUrl}
          onChange={(e) => setSettings((prev) => ({ ...prev, ollamaBaseUrl: e.target.value }))}
        />
      </label>
      <ModelSelector settings={settings} setSettings={setSettings} />
      <label className="field">
        <span>System Prompt</span>
        <textarea
          rows={6}
          value={settings.systemPrompt}
          onChange={(e) => setSettings((prev) => ({ ...prev, systemPrompt: e.target.value }))}
        />
      </label>
      <button onClick={onClearChat}>Clear Chat</button>
    </aside>
  );
}
