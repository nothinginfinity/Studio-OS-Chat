import { useCallback } from "react";
import { Sidebar } from "./components/Sidebar";
import { ChatWindow } from "./components/ChatWindow";
import { useChat } from "./hooks/useChat";

export default function App() {
  const {
    sessions,
    activeSession,
    activeSessionId,
    createSession,
    createSessionWithDraft,
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
    dbReady,
    draftText,
    setDraftText,
    reusePromptText,
  } = useChat();

  const handleInsertPrompt = useCallback((content: string) => {
    reusePromptText(content);
  }, [reusePromptText]);

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
        onReusePrompt={reusePromptText}
        onCreateSessionWithDraft={createSessionWithDraft}
      />
      <ChatWindow
        messages={messages}
        onSend={sendMessage}
        isLoading={isLoading}
        error={error}
        sessionId={activeSession?.id}
        draftText={draftText}
        onDraftChange={setDraftText}
      />
    </div>
  );
}
