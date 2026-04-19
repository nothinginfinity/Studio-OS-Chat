import { useState, useCallback } from "react";
import { Sidebar } from "./components/Sidebar";
import { ChatWindow } from "./components/ChatWindow";
import { useChat } from "./hooks/useChat";

export default function App() {
  const {
    sessions,
    activeSession,
    activeSessionId,
    createSession,
    setActiveSession,
    renameSession,
    markSessionExported,
    messages,
    settings,
    setSettings,
    sendMessage,
    clearChat,
    isLoading,
    error,
    dbReady
  } = useChat();

  // Composer insert-prompt bridge: ChatWindow exposes a setter so panels
  // can inject text into the textarea without prop-drilling through Sidebar.
  const [pendingInsert, setPendingInsert] = useState<string | null>(null);
  const handleInsertPrompt = useCallback((content: string) => {
    setPendingInsert(content);
  }, []);
  const handleInsertConsumed = useCallback(() => {
    setPendingInsert(null);
  }, []);

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
        onSessionExported={markSessionExported}
        onInsertPrompt={handleInsertPrompt}
      />
      <ChatWindow
        messages={messages}
        onSend={sendMessage}
        isLoading={isLoading}
        error={error}
        sessionId={activeSession?.id}
        pendingInsert={pendingInsert}
        onInsertConsumed={handleInsertConsumed}
      />
    </div>
  );
}
