import { Sidebar } from "./components/Sidebar";
import { ChatWindow } from "./components/ChatWindow";
import { useChat } from "./hooks/useChat";

export default function App() {
  const {
    sessions,
    activeSessionId,
    createSession,
    setActiveSession,
    renameSession,
    messages,
    settings,
    setSettings,
    sendMessage,
    clearChat,
    isLoading,
    error,
    dbReady
  } = useChat();

  if (!dbReady) {
    return (
      <div className="app-loading">
        <span>Loading…</span>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar
        settings={settings}
        setSettings={setSettings}
        onClearChat={clearChat}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={setActiveSession}
        onNewSession={() => createSession()}
        onRenameSession={renameSession}
      />
      <ChatWindow
        messages={messages}
        onSend={sendMessage}
        isLoading={isLoading}
        error={error}
      />
    </div>
  );
}
