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
    deleteSession,
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
    dbError,
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

  if (dbError) {
    return (
      <div className="app-loading" style={{ flexDirection: "column", gap: "12px", padding: "24px", textAlign: "center" }}>
        <span style={{ fontSize: "18px" }}>⚠️ Database error</span>
        <span style={{ fontSize: "13px", color: "#e08080", maxWidth: "480px" }}>{dbError}</span>
        <span style={{ fontSize: "12px", color: "#666" }}>
          Try clearing site data: Settings → Privacy → Clear browsing data → Cached images and files + Cookies.
        </span>
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
        onDeleteSession={deleteSession}
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
